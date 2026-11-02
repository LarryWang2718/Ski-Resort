// The real model behind the assistant. Agent code depends only on `streamTurn`, so tests
// and mock mode swap in the stand-ins from fakeModel.js.
const Anthropic = require('@anthropic-ai/sdk');

// Output usage only arrives at the end of a stream, so a call cut short estimates it from the
// characters that streamed, at a rate that errs on the high side for prose and JSON
const CHARS_PER_TOKEN = 3;

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
      let streamedChars = 0;
      stream.on('streamEvent', (event) => {
        onActivity?.();
        const delta = event.type === 'content_block_delta' ? event.delta : undefined;
        streamedChars += (delta?.text || delta?.thinking || delta?.partial_json || '').length;
      });
      stream.on('text', (delta) => onText?.(delta));
      try {
        return await stream.finalMessage();
      } catch (error) {
        // Stop, a timeout or a dropped connection doesn't undo the tokens already processed. The
        // input was reported when the message started; the error carries it to the cost total.
        const usage = stream.currentMessage?.usage;
        if (usage && error && typeof error === 'object') {
          error.partialMessage = {
            model: stream.currentMessage.model,
            usage: {
              input_tokens: usage.input_tokens,
              cache_read_input_tokens: usage.cache_read_input_tokens,
              cache_creation_input_tokens: usage.cache_creation_input_tokens,
              output_tokens: Math.max(usage.output_tokens || 0, Math.ceil(streamedChars / CHARS_PER_TOKEN))
            }
          };
        }
        throw error;
      }
    }
  };
};

module.exports = { createAnthropicModel };
