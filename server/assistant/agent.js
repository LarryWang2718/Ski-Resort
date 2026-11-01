// One assistant turn: the model/tool loop with its limits. It knows nothing about HTTP or MongoDB;
// it reports progress through `emit` and returns the messages to commit, so the route, the tests
// and the eval all drive the same code.
const { SYSTEM_PROMPT } = require('./prompt');
const { TurnError, classifyError } = require('./errors');
const { emptyUsage, addUsage, contextTokens } = require('./cost');
const tools = require('./tools');
const { logEvent } = require('./log');

const BETAS = ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01'];
const LAST_CALL_NOTE = 'Tool budget used up: answer now with what you have.';

// Identical on every call of a conversation except for `messages`, which only ever grows.
// That keeps the prompt cache warm and earlier thinking blocks valid.
const buildRequest = ({ settings, limits, definitions, messages }) => ({
  model: settings.model,
  max_tokens: limits.maxTokensPerCall,
  system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
  tools: definitions,
  messages,
  // Also cache the growing conversation, not just the static prefix
  cache_control: { type: 'ephemeral' },
  output_config: { effort: settings.effort },
  // Thinking is always on for this model. If the prompt or tools change after deploy, stale
  // thinking blocks in old conversations are dropped instead of failing the request.
  thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
  // A safety-classifier decline is re-run on Anthropic's recommended fallback model
  fallbacks: 'default',
  betas: BETAS
});

// After a fallback mid-answer, blocks before the last `fallback` marker came from the model that
// declined: its thinking and tool calls must not be run or sent back; its text stays.
const withoutDeclinedAttempt = (content) => {
  const boundary = content.map((block) => block.type).lastIndexOf('fallback');
  if (boundary === -1) return content;
  return content.filter((block, index) => index > boundary || block.type === 'text');
};

const raceAbort = (promise, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const onAbort = () => reject(signal.reason);
  signal.addEventListener('abort', onAbort, { once: true });
  promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
});

const withTimeout = (promise, ms, onTimeout) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => { timer = setTimeout(() => resolve(onTimeout()), ms); })
  ]).finally(() => clearTimeout(timer));
};

const runTurn = async ({
  model,
  history = [],
  userContent,
  settings,
  limits,
  signal,
  emit = () => {},
  toolbox = tools,
  log = logEvent,
  logContext = {}
}) => {
  const startedAt = Date.now();
  const turnMessages = [{ role: 'user', content: userContent }];
  const usage = emptyUsage();
  const display = { text: '', tools: [], resorts: new Map(), mapLinks: [] };
  const metrics = { modelCalls: 0, toolCalls: 0, ttftMs: null, inputTransformations: 0, servedBy: [] };
  let lastContextTokens = 0;

  // Everything that can end the turn early aborts this one controller
  const controller = new AbortController();
  const abort = (reason) => { if (!controller.signal.aborted) controller.abort(reason); };
  const deadline = setTimeout(() => abort(new TurnError('timeout', 'turn deadline')), limits.turnDeadlineMs);
  let idleTimer;
  const touch = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => abort(new TurnError('timeout', 'no stream activity')), limits.idleTimeoutMs);
  };
  const onOuterAbort = () => abort(signal.reason);
  if (signal?.aborted) onOuterAbort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  const snapshot = () => ({
    display: { ...display, resorts: [...display.resorts.values()] },
    metrics: { ...metrics, ...usage, durationMs: Date.now() - startedAt },
    lastContextTokens
  });
  const finish = (status) => ({ status, messages: status === 'refused' ? [] : turnMessages, ...snapshot() });

  const runToolCall = async (block, index) => {
    emit('tool_start', { id: block.id, label: toolbox.describeToolCall(block.name, block.input) });
    const started = Date.now();
    const output = index < limits.maxToolsPerCall
      ? await withTimeout(toolbox.runTool(block.name, block.input), limits.toolTimeoutMs, () => ({
        isError: true, content: 'The lookup took too long. Narrow it down and try again.', summary: 'timed out'
      }))
      : { isError: true, content: `At most ${limits.maxToolsPerCall} tools per step; call this one again next.`, summary: 'skipped' };

    metrics.toolCalls += 1;
    for (const resort of output.resorts || []) display.resorts.set(resort.id, resort);
    if (output.mapLink) display.mapLinks.push(output.mapLink);
    display.tools.push({
      id: block.id, name: block.name, label: toolbox.describeToolCall(block.name, block.input),
      ok: !output.isError, summary: output.summary, ms: Date.now() - started
    });
    emit('tool_end', { id: block.id, ok: !output.isError, summary: output.summary, mapLink: output.mapLink });

    return { type: 'tool_result', tool_use_id: block.id, content: output.content, ...(output.isError && { is_error: true }) };
  };

  try {
    for (let call = 1; call <= limits.maxModelCalls; call += 1) {
      emit('status', { phase: 'thinking' });
      touch();
      const callStarted = Date.now();
      let callFirstText = null;
      // Text from an earlier step (rare: the model mostly thinks between tool calls) gets a paragraph break
      let needsBreak = display.text.length > 0 && !display.text.endsWith('\n');

      const message = await model.streamTurn(
        buildRequest({ settings, limits, definitions: toolbox.toolDefinitions, messages: [...history, ...turnMessages] }),
        {
          signal: controller.signal,
          onActivity: touch,
          onText: (delta) => {
            touch();
            callFirstText ??= Date.now();
            metrics.ttftMs ??= Date.now() - startedAt;
            const text = needsBreak ? `\n\n${delta}` : delta;
            needsBreak = false;
            display.text += text;
            emit('text', { delta: text });
          }
        }
      );
      clearTimeout(idleTimer);

      metrics.modelCalls = call;
      addUsage(usage, message, settings.model);
      lastContextTokens = contextTokens(message);
      if (message.model && !metrics.servedBy.includes(message.model)) metrics.servedBy.push(message.model);
      metrics.inputTransformations += message.input_transformations?.length || 0;
      log('assistant.model_call', {
        ...logContext,
        call,
        ms: Date.now() - callStarted,
        ttftMs: callFirstText && callFirstText - callStarted,
        stopReason: message.stop_reason,
        model: message.model,
        usage: message.usage && {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens,
          cacheWrite: message.usage.cache_creation_input_tokens
        },
        inputTransformations: message.input_transformations?.length || undefined
      });

      const content = withoutDeclinedAttempt(message.content || []);
      switch (message.stop_reason) {
        case 'end_turn':
        case 'stop_sequence':
          turnMessages.push({ role: 'assistant', content });
          return finish('complete');

        case 'max_tokens':
          // A cut-off tool call can't be run; cut-off text is still worth keeping
          if (content.some((block) => block.type === 'tool_use')) throw new TurnError('too_complex', 'max_tokens in tool call');
          turnMessages.push({ role: 'assistant', content });
          return finish('truncated');

        case 'refusal':
          return finish('refused');

        case 'pause_turn':
          turnMessages.push({ role: 'assistant', content });
          break;

        case 'tool_use': {
          turnMessages.push({ role: 'assistant', content });
          const calls = content.filter((block) => block.type === 'tool_use');
          // Parallel calls run together; every result goes back in one user message, in call order
          const results = await raceAbort(Promise.all(calls.map(runToolCall)), controller.signal);
          if (call === limits.maxModelCalls - 1) results.push({ type: 'text', text: LAST_CALL_NOTE });
          turnMessages.push({ role: 'user', content: results });
          break;
        }

        default:
          throw new TurnError('internal', `unexpected stop reason ${message.stop_reason}`);
      }

      if (usage.outputTokens > limits.maxOutputTokensPerTurn) throw new TurnError('too_complex', 'output budget');
    }
    throw new TurnError('too_complex', 'model call limit');
  } catch (error) {
    const failure = classifyError(error, controller.signal);
    Object.assign(failure, snapshot());
    throw failure;
  } finally {
    clearTimeout(deadline);
    clearTimeout(idleTimer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
};

module.exports = { runTurn, buildRequest, withoutDeclinedAttempt, BETAS, LAST_CALL_NOTE };
