// The real model behind the assistant. Agent code depends only on `streamTurn`, so tests
// and mock mode swap in the stand-ins from fakeModel.js.
const Anthropic = require('@anthropic-ai/sdk');

// One streamed call. `onText` gets each text delta, `onActivity` any stream event (for the idle
// watchdog). Resolves to the final message; rejects with the SDK's typed errors.
const createAnthropicModel = ({ apiKey, timeoutMs, maxRetries }) => {
  let client;

  return {
    name: 'anthropic',
    async streamTurn(params, { signal, onText, onActivity } = {}) {
      // Created on first use, so a missing key only matters once someone asks a question
      client ??= new Anthropic({ apiKey, timeout: timeoutMs, maxRetries });

      const stream = client.beta.messages.stream(params, { signal });
      stream.on('streamEvent', () => onActivity?.());
      stream.on('text', (delta) => onText?.(delta));
      return stream.finalMessage();
    }
  };
};

module.exports = { createAnthropicModel };
