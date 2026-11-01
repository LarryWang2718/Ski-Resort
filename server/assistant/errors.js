// Every way a turn can fail, mapped to what the user sees, whether a retry can help,
// and whether the turn is given back to the user's daily quota (failures that weren't their doing)
const Anthropic = require('@anthropic-ai/sdk');
const { DatabaseUnavailableError } = require('./tools');

const FAILURES = {
  stopped: { message: 'Stopped.', retryable: false, refund: false },
  timeout: { message: 'That took too long. Try a narrower question.', retryable: true, refund: true },
  server_restarting: { message: 'The server is restarting. Try again.', retryable: true, refund: true },
  rate_limited: { message: 'The AI service is busy. Try again in a moment.', retryable: true, refund: true },
  overloaded: { message: 'The AI service is busy. Try again in a moment.', retryable: true, refund: true },
  upstream_error: { message: 'The AI service had a problem. Try again.', retryable: true, refund: true },
  connection_error: { message: 'Couldn\'t reach the AI service. Try again.', retryable: true, refund: true },
  configuration: { message: 'The assistant is unavailable right now.', retryable: false, refund: true },
  db_unavailable: { message: 'Resort data is temporarily unavailable. Try again shortly.', retryable: true, refund: true },
  too_complex: { message: 'I couldn\'t finish that one. Try splitting it into smaller questions.', retryable: false, refund: false },
  conflict: { message: 'Something went wrong saving the answer. Try again.', retryable: true, refund: true },
  internal: { message: 'Something went wrong. Try again.', retryable: true, refund: true }
};

class TurnError extends Error {
  constructor(code, detail) {
    const failure = FAILURES[code] || FAILURES.internal;
    super(failure.message);
    this.name = 'TurnError';
    this.code = FAILURES[code] ? code : 'internal';
    this.retryable = failure.retryable;
    this.refund = failure.refund;
    this.detail = detail;
  }
}

// Turn any error from the model call or the tools into a TurnError. An aborted signal wins,
// because the SDK reports our own aborts as generic abort errors.
const classifyError = (error, signal) => {
  if (signal?.aborted && signal.reason instanceof TurnError) return signal.reason;
  if (error instanceof TurnError) return error;
  if (error instanceof DatabaseUnavailableError) return new TurnError('db_unavailable', error.cause?.message);

  if (error instanceof Anthropic.APIConnectionError) return new TurnError('connection_error', error.message);
  if (error instanceof Anthropic.RateLimitError) return new TurnError('rate_limited', error.message);
  if (error instanceof Anthropic.APIError) {
    const { status } = error;
    if (status === 529) return new TurnError('overloaded', error.message);
    if (status >= 500) return new TurnError('upstream_error', error.message);
    // Bad request, auth, permission, unknown model: a bug or a deployment problem, not the user's
    if (status >= 400) return new TurnError('configuration', `${status} ${error.message}`);
  }
  return new TurnError('internal', error?.message);
};

module.exports = { TurnError, classifyError, FAILURES };
