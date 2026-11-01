// An error that carries the HTTP status the client should receive, plus an optional
// machine-readable code and extra fields (for example when a quota resets)
class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = HttpError;
