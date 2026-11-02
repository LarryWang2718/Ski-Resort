// Assistant tools over the resort directory
const Resort = require('../../models/Resort');
const Trail = require('../../models/Trail');
const Lift = require('../../models/Lift');
const { stringParam, escapeRegex } = require('../../utils/query');
const { foldText } = require('../../utils/resortFields');
const { resolveResort, resolveCountry, knownCountries, listCountries } = require('../../services/resortQueries');
const { PASSENGER_LIFTS } = require('./features');
const {
  QUERY_TIME_MS, RESORT_FIELDS, ToolInputError, clamp, optionalNumber, compact, round1,
  resortRow, otherMatches, refLabel, requireResort
} = require('./shared');

const SORT_FIELDS = ['rank', 'slope_km', 'top_elevation_m', 'vertical_m', 'lifts', 'snowfall_cm'];

// [input key, stats field, operator]
const RANGE_FILTERS = [
  ['min_slope_km', 'slope_km', '$gte'],
  ['max_slope_km', 'slope_km', '$lte'],
  ['min_top_elevation_m', 'top_elevation_m', '$gte'],
  ['min_vertical_m', 'vertical_m', '$gte'],
  ['min_lifts', 'lifts', '$gte'],
  ['min_snowfall_cm', 'snowfall_cm', '$gte']
];

// Country is resolved separately because it needs the database
const buildSearchFilter = (input) => {
  const filter = {};
  const name = foldText(stringParam(input.name)).slice(0, 100);
  if (name) filter.search_name = { $regex: escapeRegex(name) };

  const region = stringParam(input.region);
  if (region) filter.location_region = { $regex: `^${escapeRegex(region)}$`, $options: 'i' };

  for (const [key, field, operator] of RANGE_FILTERS) {
    const value = optionalNumber(input[key]);
    if (value !== undefined) {
      filter[`stats.${field}`] = { ...filter[`stats.${field}`], [operator]: value };
    }
  }
  return filter;
};

const requireCountry = async (text) => {
  const country = await resolveCountry(text);
  if (!country) {
    const covered = await knownCountries();
    throw new ToolInputError(`The directory has no resorts in "${text}". Countries covered: ${covered.join(', ')}.`);
  }
  return country;
};

const searchResorts = {
  name: 'search_resorts',
  description: 'Find ski resorts by name, country, region and statistics, sorted by rank or by one statistic (largest first). '
    + 'Returns the number of matches and up to `limit` resorts with their ids. Rank 1 is the highest-rated resort. '
    + 'Statistics come from the resort directory; a missing value means the directory has no figure.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Part of the resort name, e.g. "Verbier"' },
      country: { type: 'string', description: 'Country name in English, e.g. "Austria" or "USA"' },
      region: { type: 'string', description: 'Region exactly as list_regions returns it' },
      min_slope_km: { type: 'number', description: 'Minimum total slope length in km' },
      max_slope_km: { type: 'number', description: 'Maximum total slope length in km' },
      min_top_elevation_m: { type: 'number', description: 'Minimum top elevation in metres' },
      min_vertical_m: { type: 'number', description: 'Minimum vertical drop in metres' },
      min_lifts: { type: 'number', description: 'Minimum number of lifts' },
      min_snowfall_cm: { type: 'number', description: 'Minimum average annual snowfall in cm' },
      sort_by: { type: 'string', enum: SORT_FIELDS, description: 'Sort order, default rank' },
      limit: { type: 'integer', description: 'Resorts to return, 1-20, default 10' }
    },
    additionalProperties: false
  },
  label: (input) => ['Searching resorts',
    input.name && `"${input.name}"`,
    input.country,
    input.region,
    input.min_slope_km && `≥${input.min_slope_km} km of slopes`,
    input.min_vertical_m && `≥${input.min_vertical_m} m vertical`,
    input.min_top_elevation_m && `top ≥${input.min_top_elevation_m} m`,
    input.min_snowfall_cm && `≥${input.min_snowfall_cm} cm snow`,
    input.sort_by && input.sort_by !== 'rank' && `by ${input.sort_by.replace(/_/g, ' ')}`
  ].filter(Boolean).join(' · '),

  async run(input) {
    const filter = buildSearchFilter(input);
    const notes = [];
    if (stringParam(input.country)) {
      filter.location_country = await requireCountry(input.country);
      if (filter.location_country !== input.country) notes.push(`Country matched as ${filter.location_country}`);
    }

    const limit = clamp(input.limit, { min: 1, max: 20, fallback: 10, integer: true });
    const sortBy = SORT_FIELDS.includes(input.sort_by) ? input.sort_by : 'rank';
    // Resorts without the figure sort last
    const sort = sortBy === 'rank' ? { rank: 1 } : { [`stats.${sortBy}`]: -1, rank: 1 };

    const [resorts, total] = await Promise.all([
      Resort.find(filter).select(RESORT_FIELDS).sort(sort).limit(limit).maxTimeMS(QUERY_TIME_MS).lean(),
      Resort.countDocuments(filter).maxTimeMS(QUERY_TIME_MS)
    ]);
    if (total === 0 && filter.location_region) {
      notes.push('No resorts in that region; list_regions gives the exact region names.');
    }

    const rows = resorts.map(resortRow);
    return {
      result: compact({ total, returned: rows.length, sorted_by: sortBy, resorts: rows, notes: notes.length ? notes : undefined }),
      summary: `${total} found`,
      resorts: rows
    };
  }
};

const countBy = (groups) => Object.fromEntries(groups.map(({ _id, count }) => [_id || 'unknown', count]));

const describeResort = async (ref) => {
  const { resort, matchedBy, alternatives } = await resolveResort(ref, { select: RESORT_FIELDS, maxTimeMS: QUERY_TIME_MS });
  if (!resort) return { input: ref, error: 'not_found' };

  const [trails, lifts] = await Promise.all([
    Trail.aggregate([
      { $match: { resort: resort._id } },
      { $group: { _id: '$difficulty', count: { $sum: 1 }, lit: { $sum: { $cond: ['$lit', 1, 0] } } } },
      { $sort: { count: -1 } }
    ]).option({ maxTimeMS: QUERY_TIME_MS }),
    Lift.aggregate([
      { $match: { resort: resort._id, aerialway: { $in: PASSENGER_LIFTS } } },
      { $group: { _id: '$aerialway', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).option({ maxTimeMS: QUERY_TIME_MS })
  ]);

  const sum = (groups, field) => groups.reduce((total, group) => total + group[field], 0);
  return compact({
    ...resortRow(resort),
    slopes: resort.stats?.slopes,
    matched_by: matchedBy === 'id' ? undefined : matchedBy,
    other_matches: otherMatches(alternatives),
    mapped_trails: { segments: sum(trails, 'count'), lit_segments: sum(trails, 'lit'), by_difficulty: countBy(trails) },
    mapped_lifts: { total: sum(lifts, 'count'), by_type: countBy(lifts) }
  });
};

const getResortDetails = {
  name: 'get_resort_details',
  description: 'Statistics for one to four resorts, by id or name; pass several to compare them. '
    + 'Includes the directory figures plus counts of the trails and lifts mapped in OpenStreetMap. '
    + 'OpenStreetMap splits runs into segments, so mapped trail counts are segments and can differ from the directory\'s slope count. '
    + 'A name that matches several resorts returns the best-ranked one and lists the others.',
  input_schema: {
    type: 'object',
    properties: {
      resorts: {
        type: 'array',
        items: { type: 'string' },
        description: 'One to four resort ids (preferred, from earlier results) or names'
      }
    },
    required: ['resorts'],
    additionalProperties: false
  },
  label: (input) => {
    const refs = Array.isArray(input.resorts) ? input.resorts.slice(0, 4) : [];
    const names = refs.map(refLabel);
    return names.length > 0 && names.every(Boolean) ? `Looking up ${names.join(', ')}` : `Looking up ${refs.length === 1 ? 'the resort' : `${refs.length} resorts`}`;
  },

  async run(input) {
    const refs = (Array.isArray(input.resorts) ? input.resorts : []).map(stringParam).filter(Boolean).slice(0, 4);
    if (refs.length === 0) throw new ToolInputError('Give one to four resort ids or names.');

    const details = await Promise.all(refs.map(describeResort));
    const found = details.filter((detail) => !detail.error);
    return {
      result: { resorts: details },
      summary: found.length > 0 ? found.map((resort) => resort.name).join(', ') : 'not found',
      // The page shows these side by side under a comparison
      resorts: found.map(({ id, name, country, region, slope_km, lifts, top_elevation_m, vertical_m }) => compact({
        id, name, country, region, slope_km, lifts, top_elevation_m, vertical_m
      }))
    };
  }
};

const findResortsNear = {
  name: 'find_resorts_near',
  description: 'Resorts within a distance of another resort or of a point, nearest first, with straight-line distance in km. '
    + 'Nearby entries can be parts of the same linked ski area.',
  input_schema: {
    type: 'object',
    properties: {
      resort: { type: 'string', description: 'Resort id or name to search around' },
      latitude: { type: 'number', description: 'Latitude of a point to search around, instead of a resort' },
      longitude: { type: 'number', description: 'Longitude of a point to search around, instead of a resort' },
      radius_km: { type: 'number', description: 'Search radius in km, 1-250, default 50' },
      limit: { type: 'integer', description: 'Resorts to return, 1-20, default 10' }
    },
    additionalProperties: false
  },
  label: (input) => `Finding resorts within ${clamp(input.radius_km, { min: 1, max: 250, fallback: 50 })} km`
    + (refLabel(input.resort) ? ` of ${refLabel(input.resort)}` : ''),

  async run(input) {
    let origin;
    if (stringParam(input.resort)) {
      const { resort } = await requireResort(input.resort, { select: `${RESORT_FIELDS} location` });
      if (!resort.location) throw new ToolInputError(`${resort.name} has no coordinates in the directory.`);
      origin = { id: resort._id, name: resort.name, point: resort.location };
    } else {
      const latitude = optionalNumber(input.latitude);
      const longitude = optionalNumber(input.longitude);
      if (latitude === undefined || longitude === undefined) {
        throw new ToolInputError('Give a resort, or both latitude and longitude.');
      }
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new ToolInputError('Latitude must be within ±90 and longitude within ±180.');
      }
      origin = { point: { type: 'Point', coordinates: [longitude, latitude] } };
    }

    const radiusKm = clamp(input.radius_km, { min: 1, max: 250, fallback: 50 });
    const limit = clamp(input.limit, { min: 1, max: 20, fallback: 10, integer: true });
    const nearby = await Resort.aggregate([
      {
        $geoNear: {
          near: origin.point,
          distanceField: 'distance_m',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: origin.id ? { _id: { $ne: origin.id } } : {}
        }
      },
      { $limit: limit },
      { $project: { name: 1, rank: 1, location_country: 1, location_region: 1, stats: 1, distance_m: 1 } }
    ]).option({ maxTimeMS: QUERY_TIME_MS });

    const rows = nearby.map((resort) => ({ ...resortRow(resort), distance_km: round1(resort.distance_m / 1000) }));
    const [longitude, latitude] = origin.point.coordinates;
    return {
      result: {
        origin: compact({ id: origin.id && String(origin.id), name: origin.name, latitude, longitude }),
        radius_km: radiusKm,
        resorts: rows
      },
      summary: `${rows.length} found${origin.name ? ` near ${origin.name}` : ''}`,
      resorts: rows
    };
  }
};

const listRegions = {
  name: 'list_regions',
  description: 'Without a country: the countries the directory covers, with resort counts. '
    + 'With a country: its regions with resort counts, spelled as search_resorts expects them.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name in English' }
    },
    additionalProperties: false
  },
  label: (input) => (input.country ? `Listing regions in ${input.country}` : 'Listing countries'),

  async run(input) {
    if (!stringParam(input.country)) {
      const countries = await listCountries();
      return {
        result: { countries: countries.map(({ country, resorts }) => ({ country, resorts })) },
        summary: `${countries.length} countries`
      };
    }

    const country = await requireCountry(input.country);
    const regions = await Resort.aggregate([
      { $match: { location_country: country } },
      { $group: { _id: '$location_region', resorts: { $sum: 1 } } },
      { $sort: { resorts: -1, _id: 1 } }
    ]).option({ maxTimeMS: QUERY_TIME_MS });
    return {
      result: { country, regions: regions.map(({ _id, resorts }) => ({ region: _id || 'unknown', resorts })) },
      summary: `${regions.length} regions`
    };
  }
};

module.exports = { searchResorts, getResortDetails, findResortsNear, listRegions, buildSearchFilter, SORT_FIELDS };
