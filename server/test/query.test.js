const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, stringParam, booleanParam, escapeRegex, containsText } = require('../utils/query');

test('parsePagination uses defaults for missing or invalid values', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(parsePagination({ page: 'abc', limit: 'abc' }), { page: 1, limit: 20, skip: 0 });
});

test('parsePagination clamps page and limit', () => {
  assert.deepEqual(parsePagination({ page: '-3', limit: '-5' }), { page: 1, limit: 1, skip: 0 });
  assert.equal(parsePagination({ limit: '0' }).limit, 20);
  assert.deepEqual(parsePagination({ page: '3', limit: '5000' }), { page: 3, limit: 100, skip: 200 });
  assert.equal(parsePagination({}, { defaultLimit: 10 }).limit, 10);
});

test('stringParam only accepts non-empty strings', () => {
  assert.equal(stringParam('  France '), 'France');
  assert.equal(stringParam('   '), undefined);
  assert.equal(stringParam(['a', 'b']), undefined);
  assert.equal(stringParam({ $ne: null }), undefined);
});

test('booleanParam parses only true and false', () => {
  assert.equal(booleanParam('true'), true);
  assert.equal(booleanParam('false'), false);
  assert.equal(booleanParam('yes'), undefined);
});

test('search text is matched literally', () => {
  assert.equal(escapeRegex('(a+)+$'), '\\(a\\+\\)\\+\\$');
  const { $regex, $options } = containsText('4 Vallées (Verbier)');
  assert.equal($options, 'i');
  assert.ok(new RegExp($regex, $options).test('4 VALLÉES (verbier)'));
  assert.equal(containsText('x'.repeat(500)).$regex.length, 100);
});
