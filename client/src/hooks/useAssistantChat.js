import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConversation, getConversation, getQuota, streamTurn, toTurnFailure } from '../api/assistant';
import { getErrorMessage } from '../api/client';

// crypto.randomUUID needs a secure context; getRandomValues works everywhere
const newTurnId = () => (window.crypto.randomUUID
  ? window.crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const random = window.crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    return (c === 'x' ? random : (random % 4) + 8).toString(16);
  }));

const plainError = (failure) => ({
  message: failure.message, code: failure.code, retryable: failure.retryable, resetsAt: failure.resetsAt
});

// A stored turn from the server, in the shape the page renders
const fromServer = (turn) => ({
  id: turn.turnId,
  userText: turn.userText,
  status: turn.status,
  phase: null,
  text: turn.text,
  tools: turn.tools.map((tool) => ({ id: tool.id, label: tool.label, summary: tool.summary, state: tool.ok ? 'ok' : 'error' })),
  resorts: turn.resorts,
  mapLinks: turn.mapLinks,
  error: turn.error ? { ...turn.error, retryable: turn.status === 'failed' } : null
});

const updateTurn = (turn, action) => {
  if (action.type === 'text') return { ...turn, text: turn.text + action.delta, phase: null };
  if (action.type === 'failed') return { ...turn, status: 'failed', phase: null, error: action.error };
  if (action.type === 'stopped') return { ...turn, status: 'stopped', phase: null };

  const { event, data } = action;
  switch (event) {
    case 'status':
      return { ...turn, phase: data.phase };
    case 'tool_start':
      return { ...turn, phase: 'tools', tools: [...turn.tools, { id: data.id, label: data.label, state: 'running' }] };
    case 'tool_end':
      return {
        ...turn,
        tools: turn.tools.map((tool) => (tool.id === data.id ? { ...tool, state: data.ok ? 'ok' : 'error', summary: data.summary } : tool))
      };
    case 'done':
      // A refusal replaces whatever partial text arrived
      return { ...turn, status: data.status, phase: null, text: data.text ?? turn.text, resorts: data.resorts || [], mapLinks: data.mapLinks || [] };
    case 'error':
      return { ...turn, status: data.code === 'stopped' ? 'stopped' : 'failed', phase: null, error: data };
    default:
      return turn;
  }
};

const initialState = { conversation: null, turns: [] };

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialState;
    case 'loaded':
      return { conversation: action.conversation, turns: action.conversation.turns.map(fromServer) };
    case 'conversation':
      return { ...state, conversation: action.conversation };
    case 'start':
      return {
        ...state,
        turns: [...state.turns, {
          id: action.id, userText: action.text, status: 'streaming', phase: 'thinking',
          text: '', tools: [], resorts: [], mapLinks: [], error: null
        }]
      };
    case 'remove':
      return { ...state, turns: state.turns.filter((turn) => turn.id !== action.id) };
    default:
      return { ...state, turns: state.turns.map((turn) => (turn.id === action.id ? updateTurn(turn, action) : turn)) };
  }
}

// One assistant conversation: loads it from the URL, creates it on the first question,
// streams answers, and supports Stop, Retry and starting over
export default function useAssistantChat({ conversationId, resortId }) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const conversationRef = useRef(null);
  conversationRef.current = state.conversation;
  const abortRef = useRef(null);
  // Text deltas are applied once per animation frame instead of re-rendering on every token
  const pending = useRef({ id: null, text: '' });
  const frame = useRef(null);

  const flush = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    const { id, text } = pending.current;
    if (text) {
      pending.current = { id, text: '' };
      dispatch({ type: 'text', id, delta: text });
    }
  }, []);

  const refreshQuota = useCallback(() => {
    getQuota().then(setQuota).catch(() => {});
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // Load the conversation in the URL, unless it is the one this page just created
  useEffect(() => {
    if (!conversationId) {
      if (conversationRef.current) {
        abortRef.current?.abort();
        dispatch({ type: 'reset' });
      }
      return undefined;
    }
    if (conversationRef.current?.id === conversationId) return undefined;

    let cancelled = false;
    setLoadError(null);
    getConversation(conversationId)
      .then((conversation) => {
        if (!cancelled) dispatch({ type: 'loaded', conversation });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.response?.status === 404 || error.response?.status === 400
          ? "That conversation doesn't exist."
          : getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Leaving the page stops the answer, which also stops it being billed
  useEffect(() => () => {
    abortRef.current?.abort();
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const send = useCallback(async (text) => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    const id = newTurnId();
    dispatch({ type: 'start', id, text });

    try {
      let conversation = conversationRef.current;
      if (!conversation) {
        conversation = await createConversation(resortId);
        conversationRef.current = conversation;
        dispatch({ type: 'conversation', conversation });
        // A reload now restores this conversation
        navigate(`/assistant/${conversation.id}`, { replace: true });
      }

      pending.current = { id, text: '' };
      await streamTurn(conversation.id, { turnId: id, message: text }, {
        signal: controller.signal,
        onEvent: (event, data) => {
          if (event === 'text') {
            pending.current.text += data.delta;
            frame.current ??= requestAnimationFrame(flush);
            return;
          }
          flush();
          dispatch({ type: 'event', id, event, data });
        }
      });
    } catch (error) {
      flush();
      if (error.name === 'AbortError') {
        dispatch({ type: 'stopped', id });
      } else {
        dispatch({ type: 'failed', id, error: plainError(toTurnFailure(error)) });
      }
    } finally {
      flush();
      abortRef.current = null;
      setBusy(false);
      refreshQuota();
    }
  }, [flush, navigate, refreshQuota, resortId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Ask the same question again in place of the failed turn
  const retry = useCallback((turn) => {
    dispatch({ type: 'remove', id: turn.id });
    send(turn.userText);
  }, [send]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationRef.current = null;
    dispatch({ type: 'reset' });
    setLoadError(null);
    navigate('/assistant');
  }, [navigate]);

  return { conversation: state.conversation, turns: state.turns, busy, quota, loadError, send, stop, retry, reset };
}
