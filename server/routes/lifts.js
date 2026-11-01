const express = require('express');
const router = express.Router();
const Lift = require('../models/Lift');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { parsePagination, stringParam, booleanParam, containsText } = require('../utils/query');

const RESORT_SUMMARY = 'name location_country location_region';
// Map geometry is only needed on the resort detail page
const LIST_FIELDS = '-coordinates -__v';

const buildLiftFilter = (query) => {
  const filter = {};
  const q = stringParam(query.q);

  if (q) {
    const pattern = containsText(q);
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  for (const field of ['aerialway', 'status', 'resort']) {
    const value = stringParam(query[field]);
    if (value) filter[field] = value;
  }
  for (const field of ['lit', 'oneway']) {
    const value = booleanParam(query[field]);
    if (value !== undefined) filter[field] = value;
  }

  return filter;
};

// GET /api/lifts - Get all lifts with filtering and pagination
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildLiftFilter(req.query);

  const [lifts, total] = await Promise.all([
    Lift.find(filter)
      .select(LIST_FIELDS)
      .populate('resort', RESORT_SUMMARY)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lift.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: lifts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET /api/lifts/search - Search lifts
router.get('/search', asyncHandler(async (req, res) => {
  const { limit } = parsePagination(req.query, { defaultLimit: 10 });
  const lifts = await Lift.find(buildLiftFilter(req.query))
    .select(LIST_FIELDS)
    .populate('resort', RESORT_SUMMARY)
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: lifts
  });
}));

// GET /api/lifts/stats/aerialway - Get lift type statistics
router.get('/stats/aerialway', asyncHandler(async (req, res) => {
  const stats = await Lift.aggregate([
    {
      $group: {
        _id: '$aerialway',
        count: { $sum: 1 },
        avgCapacity: { $avg: '$capacity' },
        avgDuration: { $avg: '$duration' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: stats
  });
}));

// GET /api/lifts/stats/status - Get lift status statistics
router.get('/stats/status', asyncHandler(async (req, res) => {
  const stats = await Lift.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: stats
  });
}));

// GET /api/lifts/:id - Get specific lift
router.get('/:id', asyncHandler(async (req, res) => {
  const lift = await Lift.findById(req.params.id).populate('resort', RESORT_SUMMARY).lean();
  if (!lift) {
    throw new HttpError(404, 'Lift not found');
  }

  res.json({
    success: true,
    data: lift
  });
}));

module.exports = router;
