const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveResortFields, foldText, toStat, toLocation } = require('../utils/resortFields');

test('toStat parses directory figures and treats zero or junk as missing', () => {
  assert.equal(toStat('412.0'), 412);
  assert.equal(toStat('1,234.5'), 1234.5);
  assert.equal(toStat(68), 68);
  assert.equal(toStat('0.0'), null);
  assert.equal(toStat('-5'), null);
  assert.equal(toStat('unknown'), null);
  assert.equal(toStat(undefined), null);
});

test('toLocation builds a GeoJSON point in [long, lat] order', () => {
  assert.deepEqual(toLocation({ lat: '46.1013', long: '7.2263' }), { type: 'Point', coordinates: [7.2263, 46.1013] });
});

test('toLocation rejects missing, out-of-range and placeholder coordinates', () => {
  assert.equal(toLocation(undefined), undefined);
  assert.equal(toLocation({ lat: 'x', long: '7' }), undefined);
  assert.equal(toLocation({ lat: '91', long: '7' }), undefined);
  assert.equal(toLocation({ lat: '46', long: '181' }), undefined);
  assert.equal(toLocation({ lat: 0, long: 0 }), undefined);
});

test('foldText lowercases and removes accents and punctuation', () => {
  assert.equal(foldText(' Zürs am Arlberg '), 'zurs am arlberg');
  assert.equal(foldText('Les 3 Vallées'), 'les 3 vallees');
  assert.equal(foldText('Ski Arlberg (St.Anton)'), 'ski arlberg st anton');
  assert.equal(foldText(undefined), '');
});

test('deriveResortFields maps every stat and keeps missing ones as null', () => {
  const fields = deriveResortFields({
    name: '4 Vallées (Verbier)',
    location_coordinate: { lat: '46.1013', long: '7.2263' },
    total_slope_length_km: '412.0',
    number_of_lifts: '68.0',
    number_of_slopes: 'unknown',
    elevation_top_m: '3330.0',
    elevation_difference_m: '1980.0',
    annual_snowfall_cm: '0.0'
  });

  assert.deepEqual(fields.stats, {
    slope_km: 412, lifts: 68, slopes: null, top_elevation_m: 3330, vertical_m: 1980, snowfall_cm: null
  });
  assert.deepEqual(fields.location.coordinates, [7.2263, 46.1013]);
  assert.equal(fields.search_name, '4 vallees verbier');
});
