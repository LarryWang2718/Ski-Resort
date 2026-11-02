const test = require('node:test');
const assert = require('node:assert/strict');
const { admissionQueries, explainRejection, settlementOperations, userKey, leaseKey, globalKey, nextReset } = require('../assistant/quota');
const { commitQuery, replayHistory, MAX_STORED_TURNS } = require('../assistant/store');
const { createTurnRegistry } = require('../assistant/concurrency');
const { TurnError } = require('../assistant/errors');

const LIMITS = { dailyTurnsPerUser: 40, dailyCostPerUserUsd: 1, dailyGlobalCostUsd: 20, leaseMs: 90000 };
const NOW = new Date('2026-11-01T23:59:30.000Z');

test('usage is keyed per user per UTC day and resets at midnight UTC; the lease is per user only', () => {
  assert.equal(userKey('abc', NOW), 'u:abc:2026-11-01');
  assert.equal(globalKey(NOW), 'global:2026-11-01');
  assert.equal(nextReset(NOW).toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(leaseKey('abc'), 'lease:abc');
});

test('admission takes the user\'s lease, then counts the turn under both daily limits', () => {
  const { lease, count } = admissionQueries({ userId: 'abc', requestId: 'r1', now: NOW, limits: LIMITS });

  assert.equal(lease.filter._id, 'lease:abc');
  assert.deepEqual(lease.filter.$or, [{ activeUntil: { $exists: false } }, { activeUntil: null }, { activeUntil: { $lte: NOW } }]);
  assert.equal(lease.update.$set.activeRequestId, 'r1');
  assert.equal(lease.update.$set.activeUntil.getTime(), NOW.getTime() + 90000);
  assert.ok(lease.update.$set.expiresAt > nextReset(NOW));

  assert.equal(count.filter._id, 'u:abc:2026-11-01');
  assert.deepEqual(count.filter.turns, { $lt: 40 });
  assert.deepEqual(count.filter.costMicroUsd, { $lt: 1000000 });
  assert.deepEqual(count.update.$inc, { turns: 1 });
  assert.ok(count.update.$setOnInsert.expiresAt > nextReset(NOW));
});

test('an answer that runs past midnight still holds the lease for the next day\'s questions', () => {
  const before = admissionQueries({ userId: 'abc', requestId: 'r1', now: NOW, limits: LIMITS });
  const after = admissionQueries({ userId: 'abc', requestId: 'r2', now: new Date('2026-11-02T00:00:10.000Z'), limits: LIMITS });
  assert.equal(after.lease.filter._id, before.lease.filter._id);
  assert.notEqual(after.count.filter._id, before.count.filter._id);
});

test('a failed admission is explained from the current document', () => {
  const overTurns = explainRejection({ turns: 40, costMicroUsd: 0 }, NOW, LIMITS);
  assert.equal(overTurns.status, 429);
  assert.equal(overTurns.code, 'quota_exceeded');
  assert.equal(overTurns.details.resetsAt, '2026-11-02T00:00:00.000Z');

  assert.equal(explainRejection({ turns: 3, costMicroUsd: 1000000 }, NOW, LIMITS).code, 'quota_exceeded');

  const busy = explainRejection({ turns: 3, costMicroUsd: 0, activeUntil: new Date(NOW.getTime() + 1000) }, NOW, LIMITS);
  assert.equal(busy.status, 409);
  assert.equal(busy.code, 'busy');
});

test('settlement records cost, refunds only when asked, and releases only its own lease', () => {
  const usage = { costMicroUsd: 1234, inputTokens: 10, outputTokens: 5, cacheReadTokens: 2 };
  const kept = settlementOperations({ userId: 'abc', requestId: 'r1', now: NOW, usage, refund: false });
  assert.deepEqual(kept.user[0].updateOne.update.$inc, { costMicroUsd: 1234, inputTokens: 10, outputTokens: 5, cacheReadTokens: 2 });
  assert.deepEqual(kept.user[1].updateOne.filter, { _id: 'lease:abc', activeRequestId: 'r1' });
  assert.equal(kept.global.update.$inc.turns, 1);

  const refunded = settlementOperations({ userId: 'abc', requestId: 'r1', now: NOW, usage, refund: true });
  assert.equal(refunded.user[0].updateOne.update.$inc.turns, -1);
  assert.equal(refunded.global.update.$inc.turns, 0);
  assert.equal(refunded.global.update.$inc.costMicroUsd, 1234, 'spend counts even when the turn is refunded');
});

test('a turn commit is guarded on the committed count and on room left', () => {
  const { filter, update } = commitQuery({
    conversationId: 'c1', userId: 'u1', expectedTurns: 3,
    turn: { turnId: 't', apiJson: '[]' }, costMicroUsd: 50, lastContextTokens: 9000, title: 'x'.repeat(100)
  });
  assert.deepEqual(filter, { _id: 'c1', userId: 'u1', committedTurns: 3, [`turns.${MAX_STORED_TURNS - 1}`]: { $exists: false } });
  assert.deepEqual(update.$inc, { committedTurns: 1, totalCostMicroUsd: 50 });
  assert.equal(update.$set.lastContextTokens, 9000);
  assert.equal(update.$set.title.length, 60);

  const failed = commitQuery({ conversationId: 'c1', userId: 'u1', expectedTurns: 3, turn: { turnId: 't', apiJson: '' } });
  assert.deepEqual(failed.update.$inc, { committedTurns: 0, totalCostMicroUsd: 0 });
  assert.equal(failed.update.$set, undefined);
});

test('only completed turns are replayed to the model', () => {
  const history = replayHistory({
    turns: [
      { apiJson: JSON.stringify([{ role: 'user', content: 'a' }, { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'x', input: {} }] }]) },
      { apiJson: '' },
      { apiJson: JSON.stringify([{ role: 'user', content: 'b' }]) }
    ]
  });
  assert.deepEqual(history.map((m) => m.content[0]?.input ?? m.content), ['a', {}, 'b']);
});

test('the turn registry sheds load and stops turns on shutdown', async () => {
  const registry = createTurnRegistry({ maxConcurrent: 1 });
  const controller = new AbortController();
  assert.equal(registry.tryAcquire('a', controller), 'ok');
  assert.equal(registry.tryAcquire('b', new AbortController()), 'full');

  controller.signal.addEventListener('abort', () => registry.release('a'));
  await registry.drain(50);
  assert.ok(controller.signal.reason instanceof TurnError);
  assert.equal(controller.signal.reason.code, 'server_restarting');
  assert.equal(registry.tryAcquire('c', new AbortController()), 'draining');
  assert.equal(registry.size, 0);
});
