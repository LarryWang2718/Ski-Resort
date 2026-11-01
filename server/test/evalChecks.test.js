const test = require('node:test');
const assert = require('node:assert/strict');
const { linkedIds, idsFromTools, mentionsNumber, commonChecks, precisionRecall } = require('../eval/checks');

const A = '690b05deb76e84f97dfd4b28';
const B = '690b05e8b76e84f97dfd6064';

test('linked ids are read from resort links only', () => {
  assert.deepEqual(linkedIds(`[Verbier](/resorts/${A}), [map](/resorts/${A}?difficulty=advanced) and [Zermatt](/resorts/${B})`), [A, B]);
  assert.deepEqual(linkedIds('[x](https://example.com)'), []);
});

test('ids are collected from successful tool results only', () => {
  const ids = idsFromTools([
    { isError: false, content: JSON.stringify({ resorts: [{ id: A, name: 'Verbier' }] }) },
    { isError: true, content: `No resort ${B}` },
    { isError: false, content: 'not json' }
  ]);
  assert.deepEqual([...ids], [A]);
});

test('numbers match with or without thousands separators, but not inside other numbers', () => {
  assert.ok(mentionsNumber('a vertical drop of 1,980 m', 1980));
  assert.ok(mentionsNumber('1980 m', 1980));
  assert.ok(mentionsNumber('412 km of slopes', 412));
  assert.ok(!mentionsNumber('4120 km', 412));
  assert.ok(!mentionsNumber('1412 km', 412));
});

test('common checks catch ungrounded links, bare ids and cold cache calls', () => {
  const checks = commonChecks({
    turns: [{ status: 'complete', text: `[Verbier](/resorts/${A}) and [Made up](/resorts/${B}), id ${B}`, modelCalls: 2 }],
    calls: [{ isError: false, content: JSON.stringify({ resorts: [{ id: A }] }) }],
    modelCalls: [{ index: 1, cacheRead: 0 }, { index: 2, cacheRead: 0 }]
  });
  const failed = Object.fromEntries(checks.filter((c) => !c.pass).map((c) => [c.name, c.detail]));
  assert.deepEqual(failed['links grounded in tool results'], [B]);
  assert.deepEqual(failed['no bare ids in text'], [B]);
  assert.equal(failed['cache read after the first call'], '1 cold calls');
  assert.equal(failed.completed, undefined);
});

test('precision and recall against the expected resorts', () => {
  assert.deepEqual(precisionRecall([A], [A, B]), { precision: 1, recall: 0.5 });
  assert.deepEqual(precisionRecall([], []), { precision: 1, recall: 1 });
});
