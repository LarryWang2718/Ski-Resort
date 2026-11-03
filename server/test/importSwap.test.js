const test = require('node:test');
const assert = require('node:assert/strict');
const { swapIn, PartialSwapError } = require('../scripts/importData');

// A database holding the live and staged collections, whose renames fail as scripted:
// an error message, or 'lost reply' for a rename that happened but whose reply never came
const fakeDb = (failures = {}) => {
  const names = new Set(['resorts', 'trails', 'lifts', 'resorts_import', 'trails_import', 'lifts_import']);
  const renames = [];
  return {
    names,
    renames,
    listCollections: ({ name }) => ({ toArray: async () => (names.has(name) ? [{ name }] : []) }),
    collection: (from) => ({
      rename: async (to, { dropTarget }) => {
        renames.push(from);
        const failure = failures[from]?.shift();
        if (failure && failure !== 'lost reply') throw new Error(failure);
        if (!names.has(from)) throw new Error('source namespace does not exist');
        assert.ok(dropTarget);
        names.delete(from);
        names.add(to);
        if (failure) throw new Error('connection reset');
      }
    })
  };
};

const swapOptions = (waits = []) => ({ attempts: 3, wait: async (ms) => { waits.push(ms); } });

test('swapIn swaps resorts, trails and lifts in that order', async () => {
  const db = fakeDb();
  await swapIn(db, swapOptions());
  assert.deepEqual(db.renames, ['resorts_import', 'trails_import', 'lifts_import']);
  assert.deepEqual([...db.names].filter((name) => name.endsWith('_import')), []);
});

test('a swap that fails briefly is tried again', async () => {
  const db = fakeDb({ trails_import: ['not primary'] });
  const waits = [];
  await swapIn(db, swapOptions(waits));
  assert.deepEqual(db.renames, ['resorts_import', 'trails_import', 'trails_import', 'lifts_import']);
  assert.deepEqual(waits, [1000]);
});

test('a swap whose reply was lost is not repeated', async () => {
  const db = fakeDb({ trails_import: ['lost reply'] });
  await swapIn(db, swapOptions());
  assert.deepEqual(db.renames, ['resorts_import', 'trails_import', 'lifts_import']);
  assert.equal(db.names.has('trails_import'), false);
});

test('a swap that keeps failing after the first stops with what is live, and the rest stay staged', async () => {
  const db = fakeDb({ trails_import: ['not primary', 'not primary', 'not primary'] });
  const waits = [];
  const error = await swapIn(db, swapOptions(waits)).then(() => null, (failure) => failure);
  assert.ok(error instanceof PartialSwapError);
  assert.deepEqual(error.swapped, ['resorts']);
  assert.equal(error.cause.message, 'not primary');
  assert.deepEqual(waits, [1000, 2000]);
  assert.ok(db.names.has('trails_import') && db.names.has('lifts_import'));
  assert.equal(db.renames.includes('lifts_import'), false);
});

test('a first swap that keeps failing leaves the live data untouched', async () => {
  const db = fakeDb({ resorts_import: ['not primary', 'not primary', 'not primary'] });
  const error = await swapIn(db, swapOptions()).then(() => null, (failure) => failure);
  assert.equal(error instanceof PartialSwapError, false);
  assert.equal(error.message, 'not primary');
  assert.ok(db.names.has('resorts_import'));
});

test('a first swap whose last reply was lost is not reported as untouched', async () => {
  const db = fakeDb({ resorts_import: ['not primary', 'not primary', 'lost reply'] });
  const error = await swapIn(db, swapOptions()).then(() => null, (failure) => failure);
  assert.ok(error instanceof PartialSwapError);
  assert.deepEqual(error.swapped, []);
});
