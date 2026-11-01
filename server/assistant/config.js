// Assistant settings, read once from the environment.
// Defaults keep a single instance safe; tune them per deployment in server/.env.

const positiveNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// USD per million tokens (5-minute cache writes). Unknown models (for example a
// refusal fallback) are priced at the most expensive known rate so cost is never underestimated.
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // The rule-based stand-in (ASSISTANT_PROVIDER=mock) costs nothing
  mock: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
};
const FALLBACK_PRICE = PRICES['claude-opus-5'];

const config = Object.freeze({
  provider: process.env.ASSISTANT_PROVIDER === 'mock' ? 'mock' : 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ASSISTANT_MODEL || 'claude-opus-5-5',
  effort: process.env.ASSISTANT_EFFORT || 'low',
  // Development only: makes the mock model fail in a chosen way (rate_limit, overloaded, slow, refusal, tool_error)
  mockFailure: process.env.NODE_ENV === 'production' ? '' : (process.env.MOCK_FAILURE || ''),

  limits: Object.freeze({
    maxModelCalls: 5,
    maxToolsPerCall: 4,
    maxTokensPerCall: 8192,
    maxOutputTokensPerTurn: 16000,
    turnDeadlineMs: 60000,
    idleTimeoutMs: 20000,
    toolTimeoutMs: 5000,
    sdkTimeoutMs: 30000,
    sdkMaxRetries: 2,
    leaseMs: 90000,
    maxTurnsPerConversation: 20,
    maxContextTokens: 60000,
    maxMessageLength: 2000,
    dailyTurnsPerUser: positiveNumber('ASSISTANT_DAILY_TURNS', 40),
    dailyCostPerUserUsd: positiveNumber('ASSISTANT_DAILY_USER_BUDGET_USD', 1),
    dailyGlobalCostUsd: positiveNumber('ASSISTANT_DAILY_BUDGET_USD', 20),
    maxConcurrentTurns: positiveNumber('ASSISTANT_MAX_CONCURRENT_TURNS', 8)
  })
});

const priceFor = (model) => PRICES[model] || FALLBACK_PRICE;

module.exports = { config, priceFor };
