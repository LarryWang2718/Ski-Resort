// Pieces shared by the assistant's tools
const { stringParam } = require('../../utils/query');
const { resolveResort } = require('../../services/resortQueries');

// Every tool query gets a server-side time limit
const QUERY_TIME_MS = 3000;

const RESORT_FIELDS = 'name rank location_country location_region stats';

// The import names unnamed OSM ways "Trail 123456" / "Lift 123456"; tools count them instead of listing them
const SYNTHETIC_TRAIL = /^Trail \d+$/;
const SYNTHETIC_LIFT = /^Lift \d+$/;

// A problem with the model's input. It goes back to the model as an is_error result so it can correct itself.
class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolInputError';
  }
}

// Strict schemas guarantee types but can't express ranges, so tools clamp numbers themselves
const clamp = (value, { min, max, fallback, integer = false }) => {
  const number = integer ? Math.trunc(Number(value)) : Number(value);
  if (value === undefined || value === null || !Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
};

const optionalNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

// Results leave out empty fields to keep the model's input small
const compact = (object) => Object.fromEntries(
  Object.entries(object).filter(([, value]) => value !== null && value !== undefined)
);

const round1 = (number) => Math.round(number * 10) / 10;

const resortRow = (resort) => compact({
  id: String(resort._id),
  name: resort.name,
  rank: resort.rank,
  country: resort.location_country,
  region: resort.location_region,
  slope_km: resort.stats?.slope_km,
  lifts: resort.stats?.lifts,
  top_elevation_m: resort.stats?.top_elevation_m,
  vertical_m: resort.stats?.vertical_m,
  snowfall_cm: resort.stats?.snowfall_cm
});

// For activity labels: a name the model typed, but not an id (the result summary names the resort)
const refLabel = (ref) => (typeof ref === 'string' && !/^[0-9a-f]{24}$/i.test(ref.trim()) ? ref.trim() : undefined);

const otherMatches = (alternatives) => (alternatives.length > 0
  ? alternatives.map((resort) => ({ id: String(resort._id), name: resort.name }))
  : undefined);

// For tools that work on one resort: an unknown name is an input error the model can recover from
const requireResort = async (ref, { select = RESORT_FIELDS } = {}) => {
  const text = stringParam(ref);
  if (!text) throw new ToolInputError('Give a resort id or name.');
  const match = await resolveResort(text, { select, maxTimeMS: QUERY_TIME_MS });
  if (!match.resort) {
    throw new ToolInputError(`No resort matches "${text}". Try search_resorts with part of the name.`);
  }
  return match;
};

module.exports = {
  QUERY_TIME_MS,
  RESORT_FIELDS,
  SYNTHETIC_TRAIL,
  SYNTHETIC_LIFT,
  ToolInputError,
  clamp,
  optionalNumber,
  compact,
  round1,
  resortRow,
  otherMatches,
  refLabel,
  requireResort
};
