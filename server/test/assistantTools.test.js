const test = require('node:test');
const assert = require('node:assert/strict');
const { toolDefinitions, runTool, describeToolCall, fitResult, MAX_RESULT_CHARS } = require('../assistant/tools');
const { buildSearchFilter } = require('../assistant/tools/resorts');
const { buildMapLink } = require('../assistant/tools/features');
const { clamp, compact } = require('../assistant/tools/shared');

// Keywords strict tool schemas reject
const UNSUPPORTED = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems'];

const checkSchema = (schema, path) => {
  for (const keyword of UNSUPPORTED) {
    assert.equal(schema[keyword], undefined, `${path} uses unsupported keyword ${keyword}`);
  }
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${path} must set additionalProperties: false`);
    for (const [key, child] of Object.entries(schema.properties || {})) checkSchema(child, `${path}.${key}`);
  }
  if (schema.items) checkSchema(schema.items, `${path}[]`);
};

test('the tool list is fixed and every tool is strict', () => {
  assert.deepEqual(toolDefinitions.map((tool) => tool.name), [
    'search_resorts', 'get_resort_details', 'list_trails', 'list_lifts', 'find_resorts_near', 'list_regions'
  ]);
  for (const tool of toolDefinitions) {
    assert.equal(tool.strict, true);
    assert.ok(tool.description.length > 40, `${tool.name} needs a real description`);
    checkSchema(tool.input_schema, tool.name);
  }
});

test('tool definitions serialise identically every time, so the prompt cache holds', () => {
  assert.equal(JSON.stringify(toolDefinitions), JSON.stringify(require('../assistant/tools').toolDefinitions));
  assert.ok(Object.isFrozen(toolDefinitions));
});

test('buildSearchFilter maps inputs onto the derived fields', () => {
  assert.deepEqual(buildSearchFilter({
    name: 'Zürs',
    region: 'Tyrol',
    min_slope_km: 100,
    max_slope_km: 300,
    min_vertical_m: 1000
  }), {
    search_name: { $regex: 'zurs' },
    location_region: { $regex: '^Tyrol$', $options: 'i' },
    'stats.slope_km': { $gte: 100, $lte: 300 },
    'stats.vertical_m': { $gte: 1000 }
  });
});

test('buildSearchFilter treats names literally and ignores empty or non-numeric input', () => {
  assert.deepEqual(buildSearchFilter({ name: 'a.*(b' }), { search_name: { $regex: 'a b' } });
  assert.deepEqual(buildSearchFilter({ name: '  ', min_slope_km: '200', min_lifts: Number.NaN }), {});
});

test('clamp keeps numbers in range and falls back when missing', () => {
  assert.equal(clamp(500, { min: 1, max: 20, fallback: 10, integer: true }), 20);
  assert.equal(clamp(-3, { min: 1, max: 20, fallback: 10, integer: true }), 1);
  assert.equal(clamp(7.9, { min: 1, max: 20, fallback: 10, integer: true }), 7);
  assert.equal(clamp(undefined, { min: 1, max: 20, fallback: 10 }), 10);
  assert.equal(clamp('x', { min: 1, max: 250, fallback: 50 }), 50);
});

test('compact drops empty fields only', () => {
  assert.deepEqual(compact({ a: 0, b: null, c: undefined, d: '', e: false }), { a: 0, d: '', e: false });
});

test('fitResult cuts rows from a long list and says so', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: String(i).padStart(24, '0'), name: `Resort ${i}` }));
  const text = fitResult({ total: 200, resorts: rows });
  const parsed = JSON.parse(text);

  assert.ok(text.length <= MAX_RESULT_CHARS);
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.total, 200);
  assert.ok(parsed.resorts.length > 0 && parsed.resorts.length < 200);
  assert.match(parsed.note, /narrow the filters/);
  assert.equal(fitResult({ total: 1, resorts: [rows[0]] }), JSON.stringify({ total: 1, resorts: [rows[0]] }));
});

test('buildMapLink only links when a filter would highlight something specific', () => {
  const id = '690b060fb76e84f97dfdecbb';
  assert.equal(buildMapLink(id, { difficulty: 'advanced', lit: true }), `/resorts/${id}?difficulty=advanced&lit=1`);
  assert.equal(buildMapLink(id, { name: 'Vallée Blanche' }), `/resorts/${id}?name=Vall%C3%A9e+Blanche`);
  assert.equal(buildMapLink(id, {}), undefined);
});

test('tool calls get readable activity labels', () => {
  assert.equal(
    describeToolCall('search_resorts', { country: 'Austria', min_slope_km: 200 }),
    'Searching resorts · Austria · ≥200 km of slopes'
  );
  assert.equal(describeToolCall('list_trails', { resort: 'Chamonix', difficulty: 'advanced' }), 'Listing advanced runs at Chamonix');
  assert.equal(describeToolCall('no_such_tool', {}), 'no_such_tool');
});

test('an unknown tool is reported to the model instead of throwing', async () => {
  const result = await runTool('drop_database', {});
  assert.equal(result.isError, true);
  assert.match(result.content, /Unknown tool/);
});
