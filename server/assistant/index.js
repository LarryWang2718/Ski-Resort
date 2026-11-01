// The assistant's shared pieces for this instance, built once from config
const { config } = require('./config');
const { createAnthropicModel } = require('./model');
const { createDemoModel } = require('./fakeModel');
const { createStore } = require('./store');
const { createQuota } = require('./quota');
const { createTurnRegistry } = require('./concurrency');

const { limits } = config;
let model;

// null when the assistant isn't configured: the route answers 503 and the rest of the site is unaffected
const getModel = () => {
  if (model) return model;
  if (config.provider === 'mock') {
    model = createDemoModel({ failure: config.mockFailure });
  } else if (config.apiKey) {
    model = createAnthropicModel({ apiKey: config.apiKey, timeoutMs: limits.sdkTimeoutMs, maxRetries: limits.sdkMaxRetries });
  }
  return model || null;
};

const registry = createTurnRegistry({ maxConcurrent: limits.maxConcurrentTurns });

module.exports = {
  settings: { model: config.provider === 'mock' ? 'mock' : config.model, effort: config.effort },
  limits,
  getModel,
  store: createStore(),
  quota: createQuota({ limits }),
  registry,
  // On shutdown: refuse new turns, let running ones finish briefly, then stop them
  drain: (graceMs = 5000) => registry.drain(graceMs)
};
