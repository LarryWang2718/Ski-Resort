const express = require('express');
const router = express.Router();
const Trail = require('../models/Trail');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { parsePagination, stringParam, booleanParam, containsText } = require('../utils/query');

const RESORT_SUMMARY = 'name location_country location_region';
// Map geometry is only needed on the resort detail page
const LIST_FIELDS = '-coordinates -__v';

const buildTrailFilter = (query) => {
  const filter = {};
  const q = stringParam(query.q);

  if (q) {
    const pattern = containsText(q);
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  for (const field of ['difficulty', 'status', 'pisteType', 'grooming', 'resort']) {
    const value = stringParam(query[field]);
    if (value) filter[field] = value;
  }
  const lit = booleanParam(query.lit);
  if (lit !== undefined) filter.lit = lit;

  return filter;
};

// GET /api/trails - Get all trails with filtering and pagination
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildTrailFilter(req.query);

  const [trails, total] = await Promise.all([
    Trail.find(filter)
      .select(LIST_FIELDS)
      .populate('resort', RESORT_SUMMARY)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Trail.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: trails,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET /api/trails/search - Search trails
router.get('/search', asyncHandler(async (req, res) => {
  const { limit } = parsePagination(req.query, { defaultLimit: 10 });
  const trails = await Trail.find(buildTrailFilter(req.query))
    .select(LIST_FIELDS)
    .populate('resort', RESORT_SUMMARY)
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: trails
  });
}));

// GET /api/trails/stats/difficulty - Get trail difficulty statistics
router.get('/stats/difficulty', asyncHandler(async (req, res) => {
  const stats = await Trail.aggregate([
    { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: stats
  });
}));

// GET /api/trails/stats/status - Get trail status statistics
router.get('/stats/status', asyncHandler(async (req, res) => {
  const stats = await Trail.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: stats
  });
}));

// GET /api/trails/:id - Get specific trail
router.get('/:id', asyncHandler(async (req, res) => {
  const trail = await Trail.findById(req.params.id).populate('resort', RESORT_SUMMARY).lean();
  if (!trail) {
    throw new HttpError(404, 'Trail not found');
  }

  res.json({
    success: true,
    data: trail
  });
}));

module.exports = router;
