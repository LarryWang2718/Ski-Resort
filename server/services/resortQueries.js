// Resort queries shared by the API routes and the assistant's tools
const Resort = require('../models/Resort');
const { stringParam, containsText, escapeRegex } = require('../utils/query');
const { foldText } = require('../utils/resortFields');

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const MAX_NAME_LENGTH = 100;
const COUNTRY_CACHE_MS = 10 * 60 * 1000;

// Common ways people name the countries the directory stores under a different spelling
const COUNTRY_ALIASES = {
  us: 'USA',
  usa: 'USA',
  america: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  osterreich: 'Austria',
  schweiz: 'Switzerland',
  suisse: 'Switzerland',
  deutschland: 'Germany',
  italia: 'Italy',
  espana: 'Spain'
};

// ?q= matches name, region or country; ?country= and ?region= are exact (dropdown) values
const buildResortFilter = (query) => {
  const filter = {};
  const q = stringParam(query.q);
  const country = stringParam(query.country);
  const region = stringParam(query.region);

  if (q) {
    const pattern = containsText(q);
    filter.$or = [
      { name: pattern },
      { location_region: pattern },
      { location_country: pattern }
    ];
  }
  if (country) filter.location_country = country;
  if (region) filter.location_region = region;

  return filter;
};

// Countries with their resort counts and regions, alphabetically
const listCountries = async () => {
  const countries = await Resort.aggregate([
    { $group: { _id: { country: '$location_country', region: '$location_region' }, resorts: { $sum: 1 } } },
    { $sort: { '_id.region': 1 } },
    { $group: { _id: '$_id.country', regions: { $push: '$_id.region' }, resorts: { $sum: '$resorts' } } },
    { $sort: { _id: 1 } }
  ]);

  return countries.map(({ _id, regions, resorts }) => ({
    country: _id,
    resorts,
    regions: regions.filter(Boolean)
  }));
};

// The country list is static between imports, so each instance caches it briefly
let countryCache = { names: null, expiresAt: 0 };
const knownCountries = async () => {
  if (!countryCache.names || Date.now() > countryCache.expiresAt) {
    const names = (await Resort.distinct('location_country')).filter(Boolean).sort();
    countryCache = { names, expiresAt: Date.now() + COUNTRY_CACHE_MS };
  }
  return countryCache.names;
};

// Free text to the directory's spelling of a country, or null when it isn't covered
const resolveCountry = async (text) => {
  const folded = foldText(text);
  if (!folded) return null;
  const names = await knownCountries();
  const alias = COUNTRY_ALIASES[folded];
  return names.find((name) => foldText(name) === folded || name === alias) || null;
};

// Match a resort name in steps: exact, whole words, prefix, substring, then every word in any order.
// Each step returns the best-ranked matches, so "Verbier" finds "4 Vallées (Verbier)"
// and "st anton" prefers "Ski Arlberg (St.Anton)" over "St. Antönien".
const nameAttempts = (folded) => {
  const words = folded.split(' ').filter(Boolean);
  return [
    ['name', { search_name: folded }],
    ['words in name', { search_name: { $regex: `(^| )${escapeRegex(folded)}( |$)` } }],
    ['name prefix', { search_name: { $regex: `^${escapeRegex(folded)}` } }],
    ['partial name', { search_name: { $regex: escapeRegex(folded) } }],
    ['all words', { search_name: { $regex: words.map((word) => `(?=.*${escapeRegex(word)})`).join('') } }]
  ];
};

const resolveResort = async (ref, { select, maxTimeMS } = {}) => {
  const text = stringParam(ref);
  if (!text) return { resort: null, alternatives: [] };

  if (OBJECT_ID.test(text)) {
    const resort = await Resort.findById(text).select(select).maxTimeMS(maxTimeMS).lean();
    return { resort, matchedBy: 'id', alternatives: [] };
  }

  const folded = foldText(text.slice(0, MAX_NAME_LENGTH));
  if (!folded) return { resort: null, alternatives: [] };

  for (const [matchedBy, filter] of nameAttempts(folded)) {
    const matches = await Resort.find(filter).select(select).sort({ rank: 1 }).limit(4).maxTimeMS(maxTimeMS).lean();
    if (matches.length > 0) {
      return { resort: matches[0], matchedBy, alternatives: matches.slice(1) };
    }
  }
  return { resort: null, alternatives: [] };
};

module.exports = { buildResortFilter, listCountries, knownCountries, resolveCountry, resolveResort, nameAttempts };
