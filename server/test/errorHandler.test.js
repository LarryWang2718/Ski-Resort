const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { errorHandler } = require('../middleware/errorHandler');
const HttpError = require('../utils/httpError');

const run = (err) => {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    errorHandler(err, {}, res, () => {});
  } finally {
    console.error = originalError;
  }
  return res;
};

test('HttpError keeps its status and message', () => {
  const res = run(new HttpError(404, 'Resort not found'));
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { success: false, message: 'Resort not found' });
});

test('invalid ObjectId becomes 400', () => {
  const err = new mongoose.Error.CastError('ObjectId', 'nope', '_id');
  const res = run(err);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Invalid _id');
});

test('schema validation errors become 400 with field details', () => {
  const User = require('../models/User');
  const err = new User({ email: 'not-an-email' }).validateSync();
  const res = run(err);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'email'));
});

test('duplicate key becomes 409', () => {
  const res = run(Object.assign(new Error('E11000'), { code: 11000, keyValue: { email: 'a@b.com' } }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'email already in use');
});

test('database outage becomes 503', () => {
  const err = new Error('Server selection timed out');
  err.name = 'MongoServerSelectionError';
  assert.equal(run(err).statusCode, 503);
});

test('unexpected errors become 500 without leaking the message', () => {
  const res = run(new Error('secret internal detail'));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Internal server error');
  assert.ok(!JSON.stringify(res.body).includes('secret internal detail'));
});

test('HttpError codes and details reach the client', () => {
  const res = run(new HttpError(429, 'Daily limit reached', { code: 'quota_exceeded', details: { resetsAt: '2026-11-02T00:00:00.000Z' } }));
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, {
    success: false, message: 'Daily limit reached', code: 'quota_exceeded', resetsAt: '2026-11-02T00:00:00.000Z'
  });
});

test('errors after a streamed response has started are handed to Express', () => {
  const err = new Error('mid-stream');
  let forwarded;
  const res = { headersSent: true, status() { throw new Error('status must not be set'); } };
  errorHandler(err, {}, res, (error) => { forwarded = error; });
  assert.equal(forwarded, err);
});
