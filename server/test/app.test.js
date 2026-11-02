// HTTP-level checks that need no database: the app is started without connecting to MongoDB
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
};

const postJson = (path, body) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});

test('health reports degraded when the database is down', async () => {
  const { status, body } = await request('/api/health');
  assert.equal(status, 503);
  assert.equal(body.database, 'disconnected');
});

test('unknown routes return 404 JSON', async () => {
  const { status, body } = await request('/api/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.success, false);
});

test('requests from other origins are refused with 403', async () => {
  const { status } = await request('/api/resorts', { headers: { Origin: 'http://evil.example' } });
  assert.equal(status, 403);
});

test('requests from the API\'s own origin are allowed, as the dev proxy sends them', async () => {
  const { status } = await postJson('/api/auth/login', { email: 'x' });
  // On Windows the proxy's Origin ends in a slash
  for (const origin of [baseUrl, `${baseUrl}/`]) {
    const proxied = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ email: 'x' })
    });
    assert.equal(proxied.status, status, origin);
  }
  assert.notEqual(status, 403);
});

test('registration explains which rule failed', async () => {
  const { status, body } = await postJson('/api/auth/register', {
    firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: 'short'
  });
  assert.equal(status, 400);
  assert.match(body.message, /at least 8 characters/);
});

test('login rejects operator objects in place of an email', async () => {
  const { status } = await postJson('/api/auth/login', { email: { $ne: null }, password: 'x' });
  assert.equal(status, 400);
});

test('malformed JSON is a 400, not a 500', async () => {
  const { status } = await postJson('/api/auth/login', '{bad json');
  assert.equal(status, 400);
});

test('protected routes need a token', async () => {
  const { status } = await request('/api/auth/me');
  assert.equal(status, 401);
});

test('expired tokens get a clear message', async () => {
  const token = jwt.sign({ id: 'someone' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const { status, body } = await request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(status, 401);
  assert.match(body.message, /expired/);
});
