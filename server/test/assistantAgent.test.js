const test = require('node:test');
const assert = require('node:assert/strict');
const Anthropic = require('@anthropic-ai/sdk');
const { runTurn, withoutDeclinedAttempt, LAST_CALL_NOTE } = require('../assistant/agent');
const { createScriptedModel, fakeMessage, textMessage, toolUseMessage, apiError } = require('../assistant/fakeModel');
const { TurnError } = require('../assistant/errors');
const { DatabaseUnavailableError, toolDefinitions } = require('../assistant/tools');
const { addUsage, emptyUsage } = require('../assistant/cost');
const { buildUserContent } = require('../assistant/prompt');
const { config } = require('../assistant/config');

const SETTINGS = { model: 'claude-opus-5-5', effort: 'low' };
const LIMITS = { ...config.limits, turnDeadlineMs: 2000, idleTimeoutMs: 1000 };
const RESORT = { id: '690b05deb76e84f97dfd4b28', name: '4 Vallées (Verbier)', country: 'Switzerland', slope_km: 412 };

// Tools without a database: each call is answered by `handler`
const fakeToolbox = (handler = () => ({ isError: false, content: '{"total":1}', summary: '1 found', resorts: [RESORT] })) => {
  const calls = [];
  return {
    calls,
    toolDefinitions,
    describeToolCall: (name) => `Running ${name}`,
    runTool: async (name, input) => {
      calls.push({ name, input });
      return handler(name, input);
    }
  };
};

const turn = (model, overrides = {}) => {
  const events = [];
  const promise = runTurn({
    model,
    userContent: buildUserContent('Big resorts in Switzerland?'),
    settings: SETTINGS,
    limits: LIMITS,
    toolbox: fakeToolbox(),
    log: () => {},
    emit: (event, data) => events.push({ event, ...data }),
    ...overrides
  });
  return { promise, events };
};

const rejectsWith = async (promise, code) => {
  const error = await promise.then(() => assert.fail('expected the turn to fail'), (e) => e);
  assert.ok(error instanceof TurnError, `expected a TurnError, got ${error}`);
  assert.equal(error.code, code);
  return error;
};

test('a plain answer streams text and commits the user and assistant messages', async () => {
  const model = createScriptedModel([{
    chunks: ['Verbier ', 'is the largest.'],
    message: textMessage('Verbier is the largest.', { model: 'claude-opus-5-5', usage: { input_tokens: 1000, output_tokens: 200 } })
  }]);
  const { promise, events } = turn(model);
  const result = await promise;

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(result.display.text, 'Verbier is the largest.');
  assert.deepEqual(events.filter((e) => e.event === 'text').map((e) => e.delta), ['Verbier ', 'is the largest.']);
  assert.equal(events[0].event, 'status');
  // 1000 input tokens at $4/M + 200 output at $20/M = $0.008
  assert.equal(result.metrics.costMicroUsd, 8000);
  assert.equal(result.metrics.modelCalls, 1);
});

test('parallel tool calls run together and return in one user message, in call order', async () => {
  const toolbox = fakeToolbox((name) => (name === 'list_trails'
    ? { isError: false, content: '{"runs":[]}', summary: '0 runs', mapLink: { href: '/resorts/x?difficulty=advanced', label: 'Show' } }
    : { isError: false, content: '{"total":1}', summary: '1 found', resorts: [RESORT] }));
  const model = createScriptedModel([
    { message: toolUseMessage([{ id: 'a', name: 'search_resorts', input: { country: 'Switzerland' } }, { id: 'b', name: 'list_trails', input: { resort: 'x' } }]) },
    { message: textMessage('Done.') }
  ]);
  const { promise, events } = turn(model, { toolbox });
  const result = await promise;

  const toolResults = result.messages[2];
  assert.equal(toolResults.role, 'user');
  assert.deepEqual(toolResults.content.map((block) => block.tool_use_id), ['a', 'b']);
  assert.ok(toolResults.content.every((block) => block.type === 'tool_result' && !block.is_error));
  assert.deepEqual(events.filter((e) => e.event.startsWith('tool_')).map((e) => `${e.event}:${e.id}`).sort(),
    ['tool_end:a', 'tool_end:b', 'tool_start:a', 'tool_start:b']);
  assert.deepEqual(result.display.resorts, [RESORT]);
  assert.equal(result.display.mapLinks[0].href, '/resorts/x?difficulty=advanced');
  assert.equal(result.metrics.toolCalls, 2);
});

test('a failed tool goes back to the model as is_error so it can recover', async () => {
  const toolbox = fakeToolbox(() => ({ isError: true, content: 'No resorts in "Atlantis".', summary: 'input problem' }));
  const model = createScriptedModel([
    { message: toolUseMessage([{ id: 'a', name: 'search_resorts', input: { country: 'Atlantis' } }]) },
    { message: textMessage('There is no such country in the directory.') }
  ]);
  const result = await turn(model, { toolbox }).promise;

  assert.equal(result.status, 'complete');
  assert.equal(result.messages[2].content[0].is_error, true);
  assert.equal(result.display.tools[0].ok, false);
});

test('a database outage during a tool call ends the turn instead of letting the model guess', async () => {
  const toolbox = fakeToolbox(() => { throw new DatabaseUnavailableError(new Error('down')); });
  const model = createScriptedModel([{ message: toolUseMessage([{ name: 'search_resorts', input: {} }]) }]);
  const error = await rejectsWith(turn(model, { toolbox }).promise, 'db_unavailable');
  assert.equal(error.refund, true);
  assert.equal(error.retryable, true);
});

test('the loop stops after the model call limit and warns the model on its last call', async () => {
  const limits = { ...LIMITS, maxModelCalls: 3 };
  const model = createScriptedModel(Array.from({ length: 3 }, () => ({ message: toolUseMessage([{ name: 'search_resorts', input: {} }]) })));
  await rejectsWith(turn(model, { limits }).promise, 'too_complex');

  assert.equal(model.calls.length, 3);
  const lastRequest = model.calls[2].messages.at(-1).content;
  assert.deepEqual(lastRequest.at(-1), { type: 'text', text: LAST_CALL_NOTE });
  assert.ok(!model.calls[1].messages.at(-1).content.some((block) => block.type === 'text'));
});

test('max_tokens keeps cut-off text but fails a cut-off tool call', async () => {
  const truncatedText = createScriptedModel([{ message: fakeMessage({ content: [{ type: 'text', text: 'Partial' }], stop_reason: 'max_tokens' }) }]);
  const result = await turn(truncatedText).promise;
  assert.equal(result.status, 'truncated');
  assert.equal(result.messages.length, 2);

  const truncatedTool = createScriptedModel([{ message: fakeMessage({ content: [{ type: 'tool_use', id: 'a', name: 'search_resorts', input: {} }], stop_reason: 'max_tokens' }) }]);
  await rejectsWith(turn(truncatedTool).promise, 'too_complex');
});

test('a refusal commits nothing', async () => {
  const model = createScriptedModel([{ message: fakeMessage({ content: [], stop_reason: 'refusal' }) }]);
  const result = await turn(model).promise;
  assert.equal(result.status, 'refused');
  assert.deepEqual(result.messages, []);
});

test('pause_turn continues with the paused content sent back', async () => {
  const paused = fakeMessage({ content: [{ type: 'text', text: 'Working' }], stop_reason: 'pause_turn' });
  const model = createScriptedModel([{ message: paused }, { message: textMessage('Finished.') }]);
  const result = await turn(model).promise;

  assert.equal(result.status, 'complete');
  assert.deepEqual(model.calls[1].messages.at(-1), { role: 'assistant', content: paused.content });
});

test('the turn deadline aborts a slow model call', async () => {
  const model = createScriptedModel([{ delayMs: 500, message: textMessage('late') }]);
  const error = await rejectsWith(turn(model, { limits: { ...LIMITS, turnDeadlineMs: 50 } }).promise, 'timeout');
  assert.equal(error.detail, 'turn deadline');
});

test('the idle watchdog aborts a stream that stops sending events', async () => {
  const model = createScriptedModel([{ chunks: ['a', 'b'], delayMs: 300, message: textMessage('ab') }]);
  const error = await rejectsWith(turn(model, { limits: { ...LIMITS, idleTimeoutMs: 50 } }).promise, 'timeout');
  assert.equal(error.detail, 'no stream activity');
});

test('an outside abort (the user left) stops the model call with its reason', async () => {
  const controller = new AbortController();
  const model = createScriptedModel([{ chunks: ['a', 'b', 'c'], delayMs: 50, message: textMessage('abc') }]);
  const { promise, events } = turn(model, { signal: controller.signal });
  setTimeout(() => controller.abort(new TurnError('stopped')), 75);

  const error = await rejectsWith(promise, 'stopped');
  assert.equal(error.refund, false);
  assert.ok(events.some((e) => e.event === 'text'), 'some text streamed before the stop');
  assert.ok(error.display.text.length > 0, 'the partial answer is reported with the error');
});

test('SDK errors map to user-facing failures', async () => {
  const cases = [
    [new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', new Headers()), 'rate_limited'],
    [apiError(529, 'overloaded_error', 'overloaded'), 'overloaded'],
    [apiError(500, 'api_error', 'boom'), 'upstream_error'],
    [apiError(400, 'invalid_request_error', 'bad'), 'configuration'],
    [new Anthropic.APIConnectionError({ message: 'offline' }), 'connection_error'],
    [new Error('bug'), 'internal']
  ];
  for (const [error, code] of cases) {
    await rejectsWith(turn(createScriptedModel([{ error }])).promise, code);
  }
});

test('after a fallback, the declining model\'s thinking and tool calls are dropped', async () => {
  const content = [
    { type: 'thinking', thinking: '', signature: 'declined' },
    { type: 'text', text: 'Let me ' },
    { type: 'tool_use', id: 'declined', name: 'search_resorts', input: {} },
    { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } },
    { type: 'text', text: 'check.' },
    { type: 'tool_use', id: 'kept', name: 'search_resorts', input: {} }
  ];
  assert.deepEqual(withoutDeclinedAttempt(content).map((b) => b.id || b.text), ['Let me ', 'check.', 'kept']);

  const toolbox = fakeToolbox();
  const model = createScriptedModel([
    { message: fakeMessage({ content, stop_reason: 'tool_use' }) },
    { message: textMessage('Answer.') }
  ]);
  await turn(model, { toolbox }).promise;
  assert.equal(toolbox.calls.length, 1);
  assert.deepEqual(model.calls[1].messages.at(-1).content.map((b) => b.tool_use_id), ['kept']);
});

test('requests only ever append to the conversation, and system and tools never change', async () => {
  const firstModel = createScriptedModel([
    { message: toolUseMessage([{ id: 'a', name: 'search_resorts', input: {} }]) },
    { message: toolUseMessage([{ id: 'b', name: 'list_trails', input: { resort: 'x' } }]) },
    { message: textMessage('First answer.') }
  ]);
  const first = await turn(firstModel).promise;

  // The second turn replays the first one exactly as committed
  const history = JSON.parse(JSON.stringify(first.messages));
  const secondModel = createScriptedModel([
    { message: toolUseMessage([{ id: 'c', name: 'search_resorts', input: {} }]) },
    { message: textMessage('Second answer.') }
  ]);
  await turn(secondModel, { history, userContent: buildUserContent('Which is highest?') }).promise;

  const requests = [...firstModel.calls, ...secondModel.calls];
  for (let i = 1; i < requests.length; i += 1) {
    const previous = requests[i - 1].messages;
    assert.deepEqual(requests[i].messages.slice(0, previous.length), previous, `request ${i} rewrote history`);
    assert.ok(requests[i].messages.length > previous.length);
    assert.equal(JSON.stringify(requests[i].system), JSON.stringify(requests[0].system));
    assert.equal(JSON.stringify(requests[i].tools), JSON.stringify(requests[0].tools));
  }
  const request = requests[0];
  assert.equal(request.model, 'claude-opus-5-5');
  assert.deepEqual(request.output_config, { effort: 'low' });
  assert.equal(request.fallbacks, 'default');
  assert.equal(request.thinking.block_binding.prefix_mismatch_behavior, 'drop_block');
  assert.equal(request.tool_choice, undefined);
});

test('usage is summed across fallback attempts and priced per model', () => {
  const total = addUsage(emptyUsage(), {
    model: 'claude-opus-5',
    usage: {
      input_tokens: 10,
      output_tokens: 10,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        { type: 'fallback_message', model: 'claude-opus-5', input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 }
      ]
    }
  }, 'claude-opus-5-5');

  assert.equal(total.inputTokens, 2000);
  assert.equal(total.outputTokens, 100);
  assert.equal(total.cacheReadTokens, 2000);
  // 1000 x $4 + (1000 x $5 + 100 x $25 + 2000 x $0.50), per million tokens
  assert.equal(total.costMicroUsd, 4000 + 5000 + 2500 + 1000);
});

test('the resort the user is viewing is added to the message, not the system prompt', () => {
  const content = buildUserContent('How many lifts?', { resortId: RESORT.id, name: 'Chamonix Mont-Blanc', country: 'France', region: 'Haute-Savoie' });
  assert.equal(content.length, 2);
  assert.match(content[0].text, /^<page_context>.*Chamonix Mont-Blanc \(Haute-Savoie, France\), resort id 690b05deb76e84f97dfd4b28/);
  assert.deepEqual(buildUserContent('Hi'), [{ type: 'text', text: 'Hi' }]);
});

test('a link with a miscopied resort id is repaired in what the page shows, not in the history', async () => {
  const wrongId = '690b05deb76e84f97d0365ed';
  const answer = `The largest is [4 Vallées (Verbier)](/resorts/${wrongId}).`;
  const model = createScriptedModel([
    { message: toolUseMessage([{ name: 'search_resorts', input: { country: 'Switzerland' } }]) },
    { chunks: [answer], message: textMessage(answer) }
  ]);
  const result = await turn(model).promise;

  assert.equal(result.display.text, `The largest is [4 Vallées (Verbier)](/resorts/${RESORT.id}).`);
  assert.equal(result.metrics.repairedLinks, 1);
  // The model's own message is replayed exactly as it was written
  assert.equal(result.messages.at(-1).content[0].text, answer);
});
