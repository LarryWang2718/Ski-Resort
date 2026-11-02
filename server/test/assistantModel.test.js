// The Anthropic adapter against a local stand-in for the API that starts an answer, then stalls
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

test('a call stopped mid-stream reports the tokens Anthropic already processed', async () => {
  const api = http.createServer((req, res) => {
    req.resume();
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    send('message_start', {
      message: {
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 }
      }
    });
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'x'.repeat(300) } });
    // ...and nothing more: output usage only comes at the end, which never arrives
  });
  await new Promise((resolve) => { api.listen(0, '127.0.0.1', resolve); });
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${api.address().port}`;
  const { createAnthropicModel } = require('../assistant/model');

  try {
    const model = createAnthropicModel({ apiKey: 'test-key', timeoutMs: 5000, maxRetries: 0 });
    const controller = new AbortController();
    const error = await model.streamTurn(
      { model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }] },
      { signal: controller.signal, onText: () => controller.abort() }
    ).then(() => assert.fail('expected the call to be stopped'), (e) => e);

    assert.deepEqual(error.partialMessage, {
      model: 'claude-opus-5-5',
      // 300 streamed characters at 3 a token
      usage: { input_tokens: 1200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0, output_tokens: 100 }
    });
  } finally {
    api.closeAllConnections();
    await new Promise((resolve) => { api.close(resolve); });
  }
});
