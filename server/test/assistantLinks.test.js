const test = require('node:test');
const assert = require('node:assert/strict');
const { repairResortLinks } = require('../assistant/links');

const SCHILTHORN = { id: '690b0826b76e84f97d0365ed', name: 'Schilthorn' };
const ENGELBERG = { id: '690b0758b76e84f97d01aa10', name: 'Engelberg - Titlis' };
// Engelberg's link as the model wrote it in an eval run: the right prefix, Schilthorn's ending
const MISCOPIED = '690b0758b76e84f97d0365ed';

test('links to resorts the tools returned are left as they are', () => {
  const text = `[Schilthorn](/resorts/${SCHILTHORN.id}) and [Engelberg - Titlis](/resorts/${ENGELBERG.id})`;
  assert.deepEqual(repairResortLinks(text, [SCHILTHORN, ENGELBERG]), { text, repaired: 0 });
});

test('a miscopied id is pointed at the returned resort with the same name', () => {
  const { text, repaired } = repairResortLinks(`4. [Engelberg - Titlis](/resorts/${MISCOPIED}), Obwalden`, [SCHILTHORN, ENGELBERG]);
  assert.equal(text, `4. [Engelberg - Titlis](/resorts/${ENGELBERG.id}), Obwalden`);
  assert.equal(repaired, 1);
});

test('the name match ignores case and extra spaces, and keeps a map query', () => {
  const { text } = repairResortLinks(`[engelberg  - titlis](/resorts/${MISCOPIED}?difficulty=expert)`, new Map([[ENGELBERG.id, ENGELBERG]]));
  assert.equal(text, `[engelberg  - titlis](/resorts/${ENGELBERG.id}?difficulty=expert)`);
});

test('an unknown id with an unknown or ambiguous name stays as written', () => {
  const unknown = `[Hogwarts](/resorts/${MISCOPIED})`;
  assert.deepEqual(repairResortLinks(unknown, [SCHILTHORN, ENGELBERG]), { text: unknown, repaired: 0 });

  const twins = [ENGELBERG, { id: '690b0758b76e84f97d01aa11', name: 'Engelberg - Titlis' }];
  const ambiguous = `[Engelberg - Titlis](/resorts/${MISCOPIED})`;
  assert.deepEqual(repairResortLinks(ambiguous, twins), { text: ambiguous, repaired: 0 });
});
