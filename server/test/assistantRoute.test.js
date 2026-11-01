// The assistant route over real HTTP, with an in-memory store, a fake quota and a scripted model
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');
const { createAssistantRouter } = require('../routes/assistant');
const { errorHandler } = require('../middleware/errorHandler');
const { createScriptedModel, textMessage, toolUseMessage } = require('../assistant/fakeModel');
const { createTurnRegistry } = require('../assistant/concurrency');
const { toolDefinitions } = require('../assistant/tools');
const HttpError = require('../utils/httpError');
const { config } = require('../assistant/config');

const ALICE = new mongoose.Types.ObjectId().toHexString();
const BOB = new mongoose.Types.ObjectId().toHexString();
const RESORT_ID = '690b060fb76e84f97dfdecbb';

const memoryStore = () => {
  const conversations = new Map();
  return {
    conversations,
    async resortContext(id) {
      return id === RESORT_ID ? { resortId: RESORT_ID, name: 'Chamonix Mont-Blanc', country: 'France', region: 'Haute-Savoie' } : null;
    },
    async createConversation({ userId, context, model, effort }) {
      const conversation = {
        _id: new mongoose.Types.ObjectId().toHexString(), userId: String(userId), context, model, effort,
        committedTurns: 0, lastContextTokens: 0, turns: [], updatedAt: new Date()
      };
      conversations.set(conversation._id, conversation);
      return structuredClone(conversation);
    },
    async findConversation(id, userId) {
      const conversation = conversations.get(id);
      return conversation && conversation.userId === String(userId) ? structuredClone(conversation) : null;
    },
    async listConversations(userId) {
      return [...conversations.values()].filter((c) => c.userId === String(userId));
    },
    async commitTurn({ conversationId, expectedTurns, turn, lastContextTokens, title }) {
      const conversation = conversations.get(String(conversationId));
      if (!conversation || conversation.committedTurns !== expectedTurns) return false;
      conversation.turns.push(turn);
      if (turn.apiJson) {
        conversation.committedTurns += 1;
        conversation.lastContextTokens = lastContextTokens;
      }
      if (title && !conversation.title) conversation.title = title;
      return true;
    }
  };
};

const fakeQuota = ({ reject } = {}) => ({
  admitted: [],
  settled: [],
  async admit(userId, requestId) {
    if (reject) throw reject;
    this.admitted.push(requestId);
    return { admittedAt: new Date() };
  },
  async settle(userId, requestId, data) {
    this.settled.push({ requestId, ...data });
  },
  async status() {
    return { turnsUsed: 1, turnsLimit: 40, turnsLeft: 39, resetsAt: '2026-11-02T00:00:00.000Z' };
  }
});

// Stand-in for `protect`: the test names the user in a header
const authenticate = (req, res, next) => {
  const user = req.headers['x-test-user'];
  if (!user) return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  req.user = { _id: user };
  return next();
};

const fakeTools = {
  toolDefinitions,
  describeToolCall: (name) => `Running ${name}`,
  runTool: async () => ({ isError: false, content: '{"total":1}', summary: '1 found', resorts: [{ id: RESORT_ID, name: 'Chamonix Mont-Blanc' }] })
};

const startServer = async ({ model, store = memoryStore(), quota = fakeQuota(), registry = createTurnRegistry({ maxConcurrent: 4 }), getModel } = {}) => {
  const { runTurn } = require('../assistant/agent');
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', createAssistantRouter({
    authenticate,
    getModel: getModel || (() => model),
    store,
    quota,
    registry,
    settings: { model: 'claude-opus-5-5', effort: 'low' },
    limits: { ...config.limits, turnDeadlineMs: 3000, idleTimeoutMs: 2000 },
    runTurn: (options) => runTurn({ ...options, toolbox: fakeTools }),
    log: () => {}
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/assistant`;

  const call = (path, { user = ALICE, method = 'GET', body, signal } = {}) => fetch(`${base}${path}`, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json', ...(user && { 'x-test-user': user }) },
    body: body && JSON.stringify(body)
  });

  return { store, quota, registry, call, close: () => new Promise((resolve) => server.close(resolve)) };
};

const parseEvents = (text) => text.split('\n\n').filter((chunk) => chunk.startsWith('event:')).map((chunk) => {
  const [eventLine, dataLine] = chunk.split('\n');
  return { event: eventLine.slice('event: '.length), data: JSON.parse(dataLine.slice('data: '.length)) };
});

const newConversation = async (server, body = {}) => (await (await server.call('/conversations', { method: 'POST', body })).json()).data;

const ask = (server, id, message, options = {}) => server.call(`/conversations/${id}/turns`, {
  method: 'POST', body: { turnId: crypto.randomUUID(), message }, ...options
});

test('every endpoint needs a logged-in user', async () => {
  const server = await startServer({ model: createScriptedModel([]) });
  try {
    assert.equal((await server.call('/conversations', { user: null })).status, 401);
    assert.equal((await server.call('/quota', { user: null })).status, 401);
  } finally {
    await server.close();
  }
});

test('a conversation can start from a resort page', async () => {
  const server = await startServer({ model: createScriptedModel([]) });
  try {
    const response = await server.call('/conversations', { method: 'POST', body: { resortId: RESORT_ID } });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.context.name, 'Chamonix Mont-Blanc');

    assert.equal((await server.call('/conversations', { method: 'POST', body: { resortId: 'nope' } })).status, 400);
    assert.equal((await server.call('/conversations', { method: 'POST', body: { resortId: '690b060fb76e84f97dfdecbc' } })).status, 404);
  } finally {
    await server.close();
  }
});

test('a turn streams start, progress, text and done, then is saved and settled', async () => {
  const model = createScriptedModel([
    { message: toolUseMessage([{ id: 'a', name: 'search_resorts', input: { country: 'France' } }]) },
    { chunks: ['Try ', 'Chamonix.'], message: textMessage('Try Chamonix.', { usage: { input_tokens: 100, output_tokens: 10 } }) }
  ]);
  const server = await startServer({ model });
  try {
    const conversation = await newConversation(server, { resortId: RESORT_ID });
    const response = await ask(server, conversation.id, 'Where should I go?');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/event-stream/);
    assert.match(response.headers.get('cache-control'), /no-transform/);
    assert.equal(response.headers.get('x-accel-buffering'), 'no');

    const events = parseEvents(await response.text());
    assert.deepEqual(events.map((e) => e.event),
      ['start', 'status', 'tool_start', 'tool_end', 'status', 'text', 'text', 'done']);
    const done = events.at(-1).data;
    assert.equal(done.status, 'complete');
    assert.deepEqual(done.resorts.map((r) => r.id), [RESORT_ID]);

    const saved = server.store.conversations.get(conversation.id);
    assert.equal(saved.committedTurns, 1);
    assert.equal(saved.title, 'Where should I go?');
    assert.equal(saved.turns[0].display.text, 'Try Chamonix.');
    // The resort context went into the first message, as a separate block
    assert.match(model.calls[0].messages[0].content[0].text, /<page_context>.*Chamonix Mont-Blanc/);
    assert.deepEqual(server.quota.settled.map((s) => s.refund), [false]);
    assert.equal(server.registry.size, 0);
  } finally {
    await server.close();
  }
});

test('the next turn replays the saved history exactly, without the context again', async () => {
  const model = createScriptedModel([
    { message: textMessage('First.') },
    { message: textMessage('Second.') }
  ]);
  const server = await startServer({ model });
  try {
    const conversation = await newConversation(server, { resortId: RESORT_ID });
    await (await ask(server, conversation.id, 'One?')).text();
    await (await ask(server, conversation.id, 'Two?')).text();

    const [first, second] = model.calls;
    assert.deepEqual(second.messages.slice(0, 2), [...first.messages, { role: 'assistant', content: [{ type: 'text', text: 'First.' }] }]);
    assert.deepEqual(second.messages[2], { role: 'user', content: [{ type: 'text', text: 'Two?' }] });
  } finally {
    await server.close();
  }
});

test('bad input, foreign conversations and full conversations are refused before streaming', async () => {
  const server = await startServer({ model: createScriptedModel([]) });
  try {
    const conversation = await newConversation(server);
    const path = `/conversations/${conversation.id}/turns`;

    assert.equal((await server.call(path, { method: 'POST', body: { turnId: crypto.randomUUID(), message: '   ' } })).status, 400);
    assert.equal((await server.call(path, { method: 'POST', body: { turnId: crypto.randomUUID(), message: 'x'.repeat(2001) } })).status, 400);
    assert.equal((await server.call(path, { method: 'POST', body: { turnId: 'not-a-uuid', message: 'Hi' } })).status, 400);
    assert.equal((await ask(server, conversation.id, 'Hi', { user: BOB })).status, 404);
    assert.equal((await server.call(`/conversations/${conversation.id}`, { user: BOB })).status, 404);

    server.store.conversations.get(conversation.id).committedTurns = config.limits.maxTurnsPerConversation;
    const full = await ask(server, conversation.id, 'Hi');
    assert.equal(full.status, 409);
    assert.equal((await full.json()).code, 'conversation_full');
    assert.equal(server.quota.admitted.length, 0);
  } finally {
    await server.close();
  }
});

test('quota, capacity and configuration problems come back as JSON with a code', async () => {
  const limited = await startServer({
    model: createScriptedModel([]),
    quota: fakeQuota({ reject: new HttpError(429, 'Used up', { code: 'quota_exceeded', details: { resetsAt: 'tomorrow' } }) })
  });
  try {
    const conversation = await newConversation(limited);
    const response = await ask(limited, conversation.id, 'Hi');
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { success: false, message: 'Used up', code: 'quota_exceeded', resetsAt: 'tomorrow' });
    assert.equal(limited.registry.size, 0, 'the instance slot is released');
  } finally {
    await limited.close();
  }

  const full = await startServer({ model: createScriptedModel([]), registry: createTurnRegistry({ maxConcurrent: 0 }) });
  try {
    const conversation = await newConversation(full);
    const response = await ask(full, conversation.id, 'Hi');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '3');
    assert.equal((await response.json()).code, 'at_capacity');
  } finally {
    await full.close();
  }

  const unconfigured = await startServer({ getModel: () => null });
  try {
    const conversation = await newConversation(unconfigured);
    const response = await ask(unconfigured, conversation.id, 'Hi');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'assistant_not_configured');
  } finally {
    await unconfigured.close();
  }
});

test('a failure mid-stream arrives as an error event, is recorded and refunded, and the server carries on', async () => {
  const model = createScriptedModel([
    { chunks: ['Partial '], error: new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', new Headers()) },
    { message: textMessage('Recovered.') }
  ]);
  const server = await startServer({ model });
  try {
    const conversation = await newConversation(server);
    const events = parseEvents(await (await ask(server, conversation.id, 'Hi')).text());
    assert.deepEqual(events.at(-1), {
      event: 'error',
      data: { code: 'rate_limited', message: 'The AI service is busy. Try again in a moment.', retryable: true }
    });

    const saved = server.store.conversations.get(conversation.id);
    assert.equal(saved.committedTurns, 0);
    assert.equal(saved.turns[0].status, 'failed');
    assert.equal(saved.turns[0].apiJson, '');
    assert.equal(saved.turns[0].display.text, 'Partial ');
    assert.equal(server.quota.settled[0].refund, true);

    // The retry starts from the same (empty) history and succeeds
    const retry = parseEvents(await (await ask(server, conversation.id, 'Hi')).text());
    assert.equal(retry.at(-1).event, 'done');
    assert.equal(model.calls[1].messages.length, 1);
  } finally {
    await server.close();
  }
});

test('closing the connection stops the model, saves the turn as stopped and frees the lease', async () => {
  let sawAbort = false;
  const model = createScriptedModel([async () => ({ chunks: ['a', 'b', 'c', 'd'], delayMs: 150, message: textMessage('abcd') })]);
  const originalStream = model.streamTurn.bind(model);
  model.streamTurn = (params, options) => {
    options.signal.addEventListener('abort', () => { sawAbort = true; });
    return originalStream(params, options);
  };

  const server = await startServer({ model });
  try {
    const conversation = await newConversation(server);
    const controller = new AbortController();
    const response = await ask(server, conversation.id, 'Hi', { signal: controller.signal });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('event: text')) {
      const { value } = await reader.read();
      received += decoder.decode(value, { stream: true });
    }
    controller.abort();

    for (let i = 0; i < 40 && server.quota.settled.length === 0; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 50); });
    }
    assert.ok(sawAbort, 'the model call was aborted');
    const saved = server.store.conversations.get(conversation.id);
    assert.equal(saved.turns[0].status, 'stopped');
    assert.equal(saved.committedTurns, 0);
    assert.equal(server.quota.settled[0].refund, false, 'a turn the user stopped still counts');
    assert.equal(server.registry.size, 0);
  } finally {
    await server.close();
  }
});

test('a reloaded conversation shows display data only', async () => {
  const server = await startServer({ model: createScriptedModel([{ message: textMessage('Hello.') }]) });
  try {
    const conversation = await newConversation(server);
    await (await ask(server, conversation.id, 'Hi')).text();

    const body = await (await server.call(`/conversations/${conversation.id}`)).json();
    assert.equal(body.data.turns[0].text, 'Hello.');
    assert.equal(body.data.turns[0].status, 'complete');
    assert.ok(!JSON.stringify(body).includes('apiJson'));
  } finally {
    await server.close();
  }
});
