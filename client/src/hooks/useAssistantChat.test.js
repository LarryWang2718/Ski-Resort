import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import useAssistantChat from './useAssistantChat';
import { createConversation, getConversation, getQuota, streamTurn } from '../api/assistant';

jest.mock('../api/assistant', () => ({
  createConversation: jest.fn(),
  getConversation: jest.fn(),
  getQuota: jest.fn(),
  streamTurn: jest.fn(),
  toTurnFailure: (error) => error
}));
jest.mock('../api/client', () => ({ getErrorMessage: (error) => error.message }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const conversationView = (id) => ({ id, title: null, context: null, full: false, turns: [] });

// The hook on the assistant's two routes, as the app mounts it, plus a page to leave for
const renderChat = (path) => {
  const chat = { current: null, location: null, navigate: null };
  function Chat() {
    const { conversationId } = useParams();
    chat.current = useAssistantChat({ conversationId });
    return null;
  }
  function Location() {
    chat.location = useLocation();
    chat.navigate = useNavigate();
    return null;
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/assistant" element={<Chat />} />
        <Route path="/assistant/:conversationId" element={<Chat />} />
        <Route path="/resorts" element={null} />
      </Routes>
    </MemoryRouter>
  );
  return chat;
};

// This jsdom has no Web Crypto; turn ids only need to be unique here
let nextId = 0;
Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => `turn-${(nextId += 1)}` } });

// CRA resets mock implementations before every test
beforeEach(() => {
  getQuota.mockResolvedValue(null);
  streamTurn.mockResolvedValue();
});

test('a question asked while the conversation in the URL is loading is not sent anywhere', async () => {
  const loading = deferred();
  getConversation.mockReturnValue(loading.promise);
  const chat = renderChat('/assistant/aaa');

  expect(chat.current.loading).toBe(true);
  await act(async () => { chat.current.send('Hi'); });
  expect(createConversation).not.toHaveBeenCalled();
  expect(streamTurn).not.toHaveBeenCalled();
  expect(chat.current.turns).toEqual([]);

  await act(async () => { loading.resolve(conversationView('aaa')); });
  expect(chat.current.loading).toBe(false);
  await act(async () => { await chat.current.send('Hi'); });
  expect(streamTurn).toHaveBeenCalledWith('aaa', expect.objectContaining({ message: 'Hi' }), expect.anything());
});

test('starting over while the conversation is being created does not bring it back', async () => {
  const creating = deferred();
  createConversation.mockReturnValue(creating.promise);
  const chat = renderChat('/assistant');

  let sent;
  act(() => { sent = chat.current.send('Hi'); });
  act(() => { chat.current.reset(); });
  // The request wasn't cancelled in time and answers anyway
  await act(async () => {
    creating.resolve(conversationView('bbb'));
    await sent;
  });

  expect(chat.location.pathname).toBe('/assistant');
  expect(chat.current.conversation).toBeNull();
  expect(chat.current.busy).toBe(false);
  expect(streamTurn).not.toHaveBeenCalled();
  expect(createConversation.mock.calls[0][1].signal.aborted).toBe(true);
});

test('leaving the page while the conversation is being created does not navigate back to it', async () => {
  const creating = deferred();
  createConversation.mockReturnValue(creating.promise);
  const chat = renderChat('/assistant');

  let sent;
  act(() => { sent = chat.current.send('Hi'); });
  act(() => { chat.navigate('/resorts'); });
  await act(async () => {
    creating.resolve(conversationView('bbb'));
    await sent;
  });

  expect(chat.location.pathname).toBe('/resorts');
  expect(streamTurn).not.toHaveBeenCalled();
});

test('opening a new conversation clears an earlier loading error', async () => {
  getConversation.mockRejectedValue({ response: { status: 404 } });
  const chat = renderChat('/assistant/missing');
  await waitFor(() => expect(chat.current.loadError).toBe("That conversation doesn't exist."));

  act(() => { chat.navigate('/assistant'); });
  expect(chat.current.loadError).toBeNull();
  expect(chat.current.loading).toBe(false);
});

test('moving to another conversation stops showing the previous one while it loads', async () => {
  getConversation.mockResolvedValueOnce({ ...conversationView('aaa'), turns: [{ turnId: 't1', userText: 'One?', status: 'complete', text: 'First.', tools: [], resorts: [], mapLinks: [] }] });
  const chat = renderChat('/assistant/aaa');
  await waitFor(() => expect(chat.current.turns).toHaveLength(1));

  const next = deferred();
  getConversation.mockReturnValueOnce(next.promise);
  act(() => { chat.navigate('/assistant/ccc'); });
  expect(chat.current.turns).toEqual([]);
  expect(chat.current.loading).toBe(true);
  await act(async () => { chat.current.send('Hi'); });
  expect(streamTurn).not.toHaveBeenCalled();
});
