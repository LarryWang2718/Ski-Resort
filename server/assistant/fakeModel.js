// Stand-ins for the Anthropic model with the same `streamTurn` interface, so the whole assistant
// runs without an API key: a scripted model for tests and a rule-based demo model for development.
// Kept outside test/ because `node --test` runs every file there.
const Anthropic = require('@anthropic-ai/sdk');
const { setTimeout: sleep } = require('node:timers/promises');

let sequence = 0;
const nextId = (prefix) => `${prefix}_mock_${Date.now().toString(36)}${(sequence++).toString(36)}`;

const fakeMessage = ({ content, stop_reason: stopReason, model = 'mock', usage = {} }) => ({
  id: nextId('msg'),
  type: 'message',
  role: 'assistant',
  model,
  content,
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage }
});

const textMessage = (text, options = {}) => fakeMessage({ content: [{ type: 'text', text }], stop_reason: 'end_turn', ...options });

const toolUseMessage = (calls, options = {}) => fakeMessage({
  content: calls.map(({ id = nextId('toolu'), name, input }) => ({ type: 'tool_use', id, name, input })),
  stop_reason: 'tool_use',
  ...options
});

const apiError = (status, type, message) => Anthropic.APIError.generate(
  status, { type: 'error', error: { type, message } }, message, new Headers()
);

// Each step is { chunks?, message?, error?, delayMs?, partialUsage? } or a function of the request
// returning one. `partialUsage` is attached to the error if the call fails or is aborted, as the
// real model does. `calls` keeps a copy of every request, for asserting on what the agent sent.
const createScriptedModel = (steps) => {
  const calls = [];
  let index = 0;

  return {
    name: 'scripted',
    calls,
    async streamTurn(params, { signal, onText, onActivity } = {}) {
      calls.push(structuredClone(params));
      const step = steps[index];
      index += 1;
      if (!step) throw new Error(`Scripted model has no step ${index}`);
      const { chunks = [], message, error, delayMs = 0, partialUsage } = typeof step === 'function' ? await step(params) : step;

      try {
        for (const chunk of chunks) {
          if (delayMs) await sleep(delayMs, undefined, { signal });
          onActivity?.();
          onText?.(chunk);
        }
        if (delayMs && chunks.length === 0) await sleep(delayMs, undefined, { signal });
        if (error) throw error;
      } catch (failure) {
        if (partialUsage) failure.partialMessage = { model: params.model, usage: partialUsage };
        throw failure;
      }
      return message;
    }
  };
};

// ----- Demo model -----

const COUNTRIES = ['Andorra', 'Austria', 'Canada', 'Finland', 'France', 'Germany', 'Italy', 'Japan',
  'Norway', 'Spain', 'Sweden', 'Switzerland', 'USA'];

const textOf = (content) => (Array.isArray(content) ? content : [{ type: 'text', text: content }])
  .filter((block) => block.type === 'text')
  .map((block) => block.text);

const pageContext = (messages) => {
  const first = textOf(messages[0]?.content || []).join('\n');
  const match = first.match(/resort id ([0-9a-f]{24})/);
  return match ? match[1] : undefined;
};

const hasToolResults = (message) => Array.isArray(message.content) && message.content.some((b) => b.type === 'tool_result');

// The messages of the current turn: everything after the last user message that isn't tool results
const currentTurn = (messages) => {
  let start = messages.length - 1;
  while (start > 0 && (messages[start].role !== 'user' || hasToolResults(messages[start]))) start -= 1;
  return { question: textOf(messages[start].content).filter((t) => !t.startsWith('<page_context>')).join(' '), steps: messages.slice(start + 1) };
};

const pickDifficulty = (text) => {
  if (/double black|expert/.test(text)) return 'expert';
  if (/black|advanced|difficult/.test(text)) return 'advanced';
  if (/\bred\b|intermediate/.test(text)) return 'intermediate';
  if (/\bblue\b|\beasy\b|green|beginner/.test(text)) return 'easy';
  return undefined;
};

const pickSort = (text) => {
  if (/biggest|largest|longest|most slopes|size/.test(text)) return 'slope_km';
  if (/highest|elevation/.test(text)) return 'top_elevation_m';
  if (/vertical/.test(text)) return 'vertical_m';
  if (/snow/.test(text)) return 'snowfall_cm';
  return undefined;
};

const withoutEmpty = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

const planToolCall = (question, resortId, failure) => {
  const lower = question.toLowerCase();
  const strip = (text) => text.trim().replace(/[?.!]+$/, '').trim();
  const compare = question.match(/compare\s+(.+?)\s+(?:and|with|vs\.?|to)\s+(.+)$/i) || question.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  const near = question.match(/(?:near|close to|around)\s+(.+)$/i);
  const at = question.match(/\b(?:at|in)\s+([A-Z].+?)[?.!]*$/) || question.match(/\bdoes\s+([A-Z].+?)\s+have\b/);
  const difficulty = pickDifficulty(lower);
  const country = COUNTRIES.find((name) => lower.includes(name.toLowerCase()))
    || (/\b(us|united states|america)\b/.test(lower) ? 'USA' : undefined);

  if (failure === 'tool_error') return { name: 'search_resorts', input: { country: 'Atlantis' } };
  if (compare) return { name: 'get_resort_details', input: { resorts: [strip(compare[1]), strip(compare[2])] } };
  if (near) return { name: 'find_resorts_near', input: { resort: strip(near[1]) } };

  const named = at && strip(at[1]);
  const resort = resortId || (named && !COUNTRIES.some((c) => named.startsWith(c)) ? named : undefined);
  if (resort && /\blifts?\b|gondola|chairlift/.test(lower)) return { name: 'list_lifts', input: { resort } };
  if (resort && /\b(runs?|trails?|pistes?)\b/.test(lower)) {
    return { name: 'list_trails', input: withoutEmpty({ resort, difficulty, lit: /floodlit|\blit\b|night/.test(lower) || undefined }) };
  }
  if (resortId) return { name: 'get_resort_details', input: { resorts: [resortId] } };

  const km = lower.match(/(\d+)\s*km/);
  // Otherwise treat the capitalised words as a resort name ("Tell me about Niseko" -> Niseko)
  const capitalised = question.match(/\b[A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+)*/gu) || [];
  const name = !country && !km
    ? capitalised.map((words) => words.replace(/^(What|Which|Where|Tell|Show|How|Is|Are|Find|Any)\s*/, '')).filter(Boolean).pop()
    : undefined;
  return {
    name: 'search_resorts',
    input: withoutEmpty({ country, name, min_slope_km: km ? Number(km[1]) : undefined, sort_by: pickSort(lower), limit: 5 })
  };
};

const resortLink = (resort) => `[${resort.name}](/resorts/${resort.id})`;
const figures = (resort) => [
  resort.slope_km && `${resort.slope_km} km of slopes`,
  resort.lifts && `${resort.lifts} lifts`,
  resort.top_elevation_m && `top ${resort.top_elevation_m} m`,
  resort.distance_km !== undefined && `${resort.distance_km} km away`
].filter(Boolean).join(', ');

const describeResult = (name, result) => {
  switch (name) {
    case 'search_resorts':
      if (result.total === 0) return 'No resorts match that.';
      return [`I found ${result.total} resorts. The top ${result.returned}:`,
        ...result.resorts.map((r) => `- ${resortLink(r)}: ${figures(r)}`)].join('\n');
    case 'get_resort_details':
      return result.resorts.map((r) => (r.error
        ? `- I couldn't find "${r.input}".`
        : `- ${resortLink(r)}: ${figures(r)}, ${r.mapped_trails.segments} mapped trail segments`)).join('\n');
    case 'list_trails':
      if (result.named_runs === 0) return `${resortLink(result.resort)} has no named runs that match.`;
      return [`${resortLink(result.resort)} has ${result.named_runs} matching named runs:`,
        ...result.runs.map((run) => `- ${run.name} (${run.difficulty})`)].join('\n');
    case 'list_lifts':
      return [`${resortLink(result.resort)} has ${result.total} mapped lifts:`,
        ...result.lifts.map((lift) => `- ${lift.name} (${lift.type.replace(/_/g, ' ')})`)].join('\n');
    case 'find_resorts_near':
      return [`Resorts within ${result.radius_km} km of ${result.origin.name || 'that point'}:`,
        ...result.resorts.map((r) => `- ${resortLink(r)}: ${figures(r)}`)].join('\n');
    case 'list_regions':
      return result.countries
        ? `The directory covers ${result.countries.map((c) => c.country).join(', ')}.`
        : `${result.country} regions: ${result.regions.slice(0, 10).map((r) => r.region).join(', ')}.`;
    default:
      return '';
  }
};

const composeAnswer = (steps) => {
  const calls = new Map();
  const parts = ['**Demo mode:** a rule-based stand-in for the AI model wrote this answer.'];
  for (const message of steps) {
    for (const block of message.content) {
      if (block.type === 'tool_use') calls.set(block.id, block.name);
      if (block.type === 'tool_result') {
        parts.push(block.is_error
          ? `That lookup didn't work: ${block.content}`
          : describeResult(calls.get(block.tool_use_id), JSON.parse(block.content)));
      }
    }
  }
  return parts.filter(Boolean).join('\n\n');
};

const streamText = async (text, { signal, onText, onActivity }) => {
  const words = text.split(/(?<=\s)/);
  for (let i = 0; i < words.length; i += 3) {
    await sleep(25, undefined, { signal });
    onActivity?.();
    onText?.(words.slice(i, i + 3).join(''));
  }
};

// `failure` (MOCK_FAILURE) makes it fail the way the real service can, to show each error path
const createDemoModel = ({ failure = '' } = {}) => ({
  name: 'mock',
  async streamTurn(params, options = {}) {
    const { signal, onActivity } = options;
    onActivity?.();
    if (failure === 'rate_limit') throw new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limited (mock)' } }, 'Rate limited (mock)', new Headers());
    if (failure === 'overloaded') throw apiError(529, 'overloaded_error', 'Overloaded (mock)');
    if (failure === 'slow') await sleep(25000, undefined, { signal });
    if (failure === 'refusal') return fakeMessage({ content: [], stop_reason: 'refusal' });

    await sleep(400, undefined, { signal });
    const { question, steps } = currentTurn(params.messages);
    const results = steps.flatMap((message) => (Array.isArray(message.content) ? message.content : []))
      .filter((block) => block.type === 'tool_result');

    if (results.length === 0) {
      return toolUseMessage([planToolCall(question, pageContext(params.messages), failure)]);
    }
    // Shows recovery from a tool error: look up what the data covers, then answer
    if (results.every((block) => block.is_error) && results.length === 1) {
      return toolUseMessage([{ name: 'list_regions', input: {} }]);
    }

    const answer = composeAnswer(steps);
    await streamText(answer, options);
    return textMessage(answer, { usage: { output_tokens: Math.ceil(answer.length / 4) } });
  }
});

module.exports = { createScriptedModel, createDemoModel, fakeMessage, textMessage, toolUseMessage, apiError, planToolCall };
