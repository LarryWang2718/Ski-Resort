// Token usage and cost, in integer micro-dollars so totals can be summed exactly in MongoDB.
// A price in USD per million tokens is the same number in micro-dollars per token.
const { priceFor } = require('./config');

const emptyUsage = () => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costMicroUsd: 0
});

const attemptCost = (attempt, model) => {
  const price = priceFor(model);
  return (attempt.input_tokens || 0) * price.input
    + (attempt.output_tokens || 0) * price.output
    + (attempt.cache_read_input_tokens || 0) * price.cacheRead
    + (attempt.cache_creation_input_tokens || 0) * price.cacheWrite;
};

// With refusal fallbacks one call can run several attempts on different models. `usage.iterations`
// lists each one; the top-level usage only covers the attempt that produced the message.
const addUsage = (total, message, requestedModel) => {
  const usage = message.usage || {};
  const attempts = (usage.iterations || []).filter((entry) => entry.type === 'message' || entry.type === 'fallback_message');
  const billed = attempts.length > 0
    ? attempts.map((entry) => ({ entry, model: entry.model || requestedModel }))
    : [{ entry: usage, model: message.model || requestedModel }];

  for (const { entry, model } of billed) {
    total.inputTokens += entry.input_tokens || 0;
    total.outputTokens += entry.output_tokens || 0;
    total.cacheReadTokens += entry.cache_read_input_tokens || 0;
    total.cacheWriteTokens += entry.cache_creation_input_tokens || 0;
    total.costMicroUsd += Math.round(attemptCost(entry, model));
  }
  return total;
};

// Size of the prompt the model last read: what the next call will re-read from cache
const contextTokens = (message) => {
  const usage = message.usage || {};
  return (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
};

const toUsd = (micro) => Math.round(micro) / 1e6;

module.exports = { emptyUsage, addUsage, contextTokens, toUsd };
