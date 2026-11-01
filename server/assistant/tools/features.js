// Assistant tools over the OpenStreetMap trails and lifts of one resort
const Trail = require('../../models/Trail');
const Lift = require('../../models/Lift');
const { stringParam, containsText } = require('../../utils/query');
const {
  QUERY_TIME_MS, SYNTHETIC_TRAIL, SYNTHETIC_LIFT, clamp, compact, resortRow, otherMatches, requireResort
} = require('./shared');

const DIFFICULTIES = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride', 'extreme'];

// OSM aerialways that carry skiers; goods lifts, zip lines and avalanche-control ropeways are left out
const PASSENGER_LIFTS = [
  'gondola', 'cable_car', 'chair_lift', 'mixed_lift', 'funicular',
  'drag_lift', 't-bar', 'j-bar', 'platter', 'rope_tow', 'magic_carpet'
];

// The resort page reads these parameters and highlights the matching runs on its map
const buildMapLink = (resortId, { difficulty, lit, name }) => {
  const params = new URLSearchParams();
  if (difficulty) params.set('difficulty', difficulty);
  if (lit !== undefined) params.set('lit', lit ? '1' : '0');
  if (name) params.set('name', name);
  const query = params.toString();
  return query ? `/resorts/${resortId}?${query}` : undefined;
};

const mapLinkLabel = ({ difficulty, lit, name }) => {
  const runs = [lit === true && 'floodlit', lit === false && 'unlit', difficulty, 'runs'].filter(Boolean).join(' ');
  return `Show ${runs}${name ? ` matching "${name}"` : ''} on the map`;
};

// Names are matched literally; segments with the same name and difficulty are one run
const facetPipeline = (match, syntheticName, rowsStages, extraFacets = {}) => [
  { $match: match },
  {
    $facet: {
      named: [{ $match: { name: { $not: syntheticName } } }, ...rowsStages],
      unnamed: [{ $match: { name: syntheticName } }, { $count: 'segments' }],
      ...extraFacets
    }
  }
];

const listTrails = {
  name: 'list_trails',
  description: 'Named runs at one resort from OpenStreetMap, optionally filtered by difficulty, name or floodlighting. '
    + 'OpenStreetMap splits runs into segments: segments with the same name and difficulty are merged into one run, '
    + 'and many segments have no name, so they are only counted. '
    + 'When a filter is used, map_link is a page that highlights the matching runs on the resort\'s trail map.',
  input_schema: {
    type: 'object',
    properties: {
      resort: { type: 'string', description: 'Resort id (preferred) or name' },
      difficulty: {
        type: 'string',
        enum: DIFFICULTIES,
        description: 'OpenStreetMap piste difficulty. Europe: blue = easy, red = intermediate, black = advanced. '
          + 'North America: green = easy, blue = intermediate, black = advanced, double black = expert. '
          + 'freeride = off-piste routes.'
      },
      name: { type: 'string', description: 'Part of the run name' },
      lit: { type: 'boolean', description: 'true for floodlit runs only, false for unlit only' },
      limit: { type: 'integer', description: 'Runs to return, 1-30, default 20' }
    },
    required: ['resort'],
    additionalProperties: false
  },
  label: (input) => ['Listing', input.lit === true && 'floodlit', input.difficulty, 'runs',
    input.name && `named "${input.name}"`, input.resort && `at ${input.resort}`].filter(Boolean).join(' '),

  async run(input) {
    const { resort, matchedBy, alternatives } = await requireResort(input.resort);
    const filters = {
      difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : undefined,
      lit: typeof input.lit === 'boolean' ? input.lit : undefined,
      name: stringParam(input.name)?.slice(0, 100)
    };
    const limit = clamp(input.limit, { min: 1, max: 30, fallback: 20, integer: true });

    const match = { resort: resort._id };
    if (filters.difficulty) match.difficulty = filters.difficulty;
    if (filters.lit !== undefined) match.lit = filters.lit;
    if (filters.name) match.name = containsText(filters.name);

    const [facet] = await Trail.aggregate(facetPipeline(match, SYNTHETIC_TRAIL, [
      { $group: { _id: { name: '$name', difficulty: '$difficulty' }, segments: { $sum: 1 }, lit: { $max: '$lit' } } },
      { $sort: { '_id.name': 1 } },
      { $group: { _id: null, total: { $sum: 1 }, rows: { $push: '$$ROOT' } } },
      { $project: { total: 1, rows: { $slice: ['$rows', limit] } } }
    ])).option({ maxTimeMS: QUERY_TIME_MS });

    const named = facet.named[0] || { total: 0, rows: [] };
    const runs = named.rows.map((row) => compact({
      name: row._id.name,
      difficulty: row._id.difficulty,
      segments: row.segments > 1 ? row.segments : undefined,
      lit: row.lit || undefined
    }));
    const unnamed = facet.unnamed[0]?.segments || 0;
    // Only offer the map when it will highlight something
    const mapLink = named.total + unnamed > 0 ? buildMapLink(resort._id, filters) : undefined;

    return {
      result: compact({
        resort: { id: String(resort._id), name: resort.name },
        matched_by: matchedBy === 'id' ? undefined : matchedBy,
        other_matches: otherMatches(alternatives),
        named_runs: named.total,
        returned: runs.length,
        unnamed_segments: unnamed,
        runs,
        map_link: mapLink
      }),
      summary: `${named.total} named runs`,
      resorts: [resortRow(resort)],
      mapLink: mapLink && { href: mapLink, label: mapLinkLabel(filters) }
    };
  }
};

const listLifts = {
  name: 'list_lifts',
  description: 'Passenger lifts at one resort from OpenStreetMap, with counts by type and, where mapped, '
    + 'capacity in people per hour, ride time in minutes and length in metres. Unnamed lifts are only counted.',
  input_schema: {
    type: 'object',
    properties: {
      resort: { type: 'string', description: 'Resort id (preferred) or name' },
      type: { type: 'string', enum: PASSENGER_LIFTS, description: 'OpenStreetMap aerialway type' },
      limit: { type: 'integer', description: 'Lifts to return, 1-30, default 20' }
    },
    required: ['resort'],
    additionalProperties: false
  },
  label: (input) => ['Listing', input.type ? input.type.replace(/_/g, ' ') : '', 'lifts',
    input.resort && `at ${input.resort}`].filter(Boolean).join(' '),

  async run(input) {
    const { resort, matchedBy, alternatives } = await requireResort(input.resort);
    const type = PASSENGER_LIFTS.includes(input.type) ? input.type : undefined;
    const limit = clamp(input.limit, { min: 1, max: 30, fallback: 20, integer: true });
    const match = { resort: resort._id, aerialway: type || { $in: PASSENGER_LIFTS } };

    const [facet] = await Lift.aggregate(facetPipeline(match, SYNTHETIC_LIFT, [
      { $sort: { name: 1 } },
      { $limit: limit },
      { $project: { name: 1, aerialway: 1, capacity: 1, duration: 1, length: 1 } }
    ], {
      byType: [{ $group: { _id: '$aerialway', count: { $sum: 1 } } }, { $sort: { count: -1 } }]
    })).option({ maxTimeMS: QUERY_TIME_MS });

    const lifts = facet.named.map((lift) => compact({
      name: lift.name,
      type: lift.aerialway,
      capacity_per_hour: lift.capacity,
      duration_min: lift.duration,
      length_m: lift.length
    }));
    const byType = Object.fromEntries(facet.byType.map(({ _id, count }) => [_id, count]));
    const total = facet.byType.reduce((sum, { count }) => sum + count, 0);

    return {
      result: compact({
        resort: { id: String(resort._id), name: resort.name },
        matched_by: matchedBy === 'id' ? undefined : matchedBy,
        other_matches: otherMatches(alternatives),
        total,
        by_type: byType,
        unnamed: facet.unnamed[0]?.segments || 0,
        lifts
      }),
      summary: `${total} lifts`,
      resorts: [resortRow(resort)]
    };
  }
};

module.exports = { listTrails, listLifts, buildMapLink, PASSENGER_LIFTS, DIFFICULTIES };
