const HttpError = require('../utils/httpError');
const { isDatabaseUnavailable } = require('../utils/dbErrors');

const notFound = (req, res, next) => {
  next(new HttpError(404, `Route ${req.originalUrl} not found`));
};

// Map known error types to client-safe responses; anything unexpected becomes a logged 500
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Once a streamed response has started, the status can't change; Express closes the connection
  if (res.headersSent) {
    return next(err);
  }

  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let errors;

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || 'Validation failed';
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {}).join(', ') || 'Value'} already in use`;
  } else if (isDatabaseUnavailable(err)) {
    status = 503;
    message = 'Database temporarily unavailable. Try again shortly.';
  }

  // HttpErrors are deliberate (busy, not configured); anything else at 5xx is worth a log line
  if (status >= 500 && !(err instanceof HttpError)) {
    console.error(err);
  }
  if (status === 500) message = 'Internal server error';

  return res.status(status).json({
    success: false,
    message,
    ...(err instanceof HttpError && err.code && { code: err.code }),
    ...(err instanceof HttpError && err.details),
    ...(errors && { errors }),
    ...(status === 500 && process.env.NODE_ENV === 'development' && { detail: err.message })
  });
};

module.exports = { notFound, errorHandler };
