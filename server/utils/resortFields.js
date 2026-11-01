// Numeric and geo fields derived from the resort directory's text values.
// Shared by the import and the migration so both always produce the same fields.

const STAT_SOURCES = {
  slope_km: 'total_slope_length_km',
  lifts: 'number_of_lifts',
  slopes: 'number_of_slopes',
  top_elevation_m: 'elevation_top_m',
  vertical_m: 'elevation_difference_m',
  snowfall_cm: 'annual_snowfall_cm'
};

// "1,234.0" -> 1234. The directory uses 0 (and sometimes "unknown") for a missing figure.
const toStat = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
};

// GeoJSON order is [longitude, latitude]; (0, 0) is a placeholder, not a ski resort
const toLocation = (coordinate) => {
  const lat = parseFloat(coordinate?.lat);
  const long = parseFloat(coordinate?.long);
  const valid = Number.isFinite(lat) && Number.isFinite(long)
    && Math.abs(lat) <= 90 && Math.abs(long) <= 180
    && !(lat === 0 && long === 0);
  return valid ? { type: 'Point', coordinates: [long, lat] } : undefined;
};

// Lowercase without accents, so "zurs" finds "Zürs" through an index
const foldText = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

const deriveResortFields = (raw) => ({
  stats: Object.fromEntries(
    Object.entries(STAT_SOURCES).map(([field, source]) => [field, toStat(raw[source])])
  ),
  location: toLocation(raw.location_coordinate),
  search_name: foldText(raw.name)
});

module.exports = { deriveResortFields, foldText, toStat, toLocation };
