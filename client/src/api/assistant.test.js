import { streamTurn } from './assistant';

// The axios client isn't needed: a refused turn never reaches the event stream
jest.mock('./client', () => ({
  __esModule: true,
  default: {},
  getErrorMessage: () => '',
  handleUnauthorized: () => {},
  loadStoredUser: () => null
}));

// What the page gets when the request is refused before any answer starts
const refusal = async (status, body) => {
  global.fetch = async () => ({
    ok: false,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('not JSON');
      return body;
    }
  });
  try {
    await streamTurn('c1', { turnId: 't1', message: 'hi' }, { onEvent: () => {} });
  } catch (error) {
    return error;
  }
  throw new Error('expected the turn to fail');
};

afterEach(() => {
  delete global.fetch;
});

test('a busy or restarting server can be retried', async () => {
  expect((await refusal(503, { message: 'Busy', code: 'at_capacity' })).retryable).toBe(true);
  expect((await refusal(503, { message: 'Restarting', code: 'server_restarting' })).retryable).toBe(true);
});

test('limits and configuration problems are not offered a retry', async () => {
  expect((await refusal(429, { message: 'Used up', code: 'quota_exceeded' })).retryable).toBe(false);
  expect((await refusal(503, { message: 'Paused', code: 'assistant_paused' })).retryable).toBe(false);
  expect((await refusal(400, { message: 'Too long' })).retryable).toBe(false);
});

test('an error page from the proxy can be retried', async () => {
  for (const status of [502, 503, 504]) {
    const failure = await refusal(status);
    expect(failure.retryable).toBe(true);
    expect(failure.message).toBe('Something went wrong. Try again.');
  }
});
