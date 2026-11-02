import api, { getErrorMessage, handleUnauthorized, loadStoredUser } from './client';
import { readEventStream } from './sse';

export const createConversation = async (resortId, { signal } = {}) => {
  const response = await api.post('/assistant/conversations', resortId ? { resortId } : {}, { signal });
  return response.data.data;
};

export const getConversation = async (id) => (await api.get(`/assistant/conversations/${id}`)).data.data;

export const getQuota = async () => (await api.get('/assistant/quota')).data.data;

// A turn that didn't produce an answer, with what the page needs to decide what to offer next
export class TurnFailure extends Error {
  constructor(message, { code, retryable = false, resetsAt } = {}) {
    super(message);
    this.name = 'TurnFailure';
    this.code = code;
    this.retryable = retryable;
    this.resetsAt = resetsAt;
  }
}

// Refusals before the stream starts that a retry can fix (busy instance, server restarting)
const RETRYABLE_CODES = new Set(['at_capacity', 'server_restarting', 'busy']);

export const toTurnFailure = (error) => (error instanceof TurnFailure
  ? error
  : new TurnFailure(getErrorMessage(error), { retryable: true }));

const connectionLost = () => new TurnFailure('The connection dropped before the answer finished.', {
  code: 'connection_lost', retryable: true
});

// Asks one question. Uses fetch rather than axios because the answer is a stream of server-sent
// events, and EventSource can't send the Authorization header.
export async function streamTurn(conversationId, { turnId, message }, { signal, onEvent }) {
  const token = loadStoredUser()?.token;
  let response;
  try {
    response = await fetch(`/api/assistant/conversations/${conversationId}/turns`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ turnId, message })
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new TurnFailure("Can't reach the server. Check your connection and try again.", { code: 'connection_lost', retryable: true });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) handleUnauthorized(body.message);
    throw new TurnFailure(body.message || 'Something went wrong. Try again.', {
      code: body.code,
      // A 502-504 without the API's error code came from the proxy: no server took the question
      // (one was stopping, for example), so a retry can work
      retryable: body.code ? RETRYABLE_CODES.has(body.code) : response.status >= 502,
      resetsAt: body.resetsAt
    });
  }

  let finished = false;
  try {
    await readEventStream(response.body, (event, data) => {
      if (event === 'done' || event === 'error') finished = true;
      onEvent(event, data);
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw connectionLost();
  }
  // The server always ends with done or error; anything else means the connection was cut
  if (!finished) throw connectionLost();
}
