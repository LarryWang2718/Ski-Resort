// routes/resorts.js
const express = require('express');
const router = express.Router();
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { parsePagination } = require('../utils/query');
const { buildResortFilter, listCountries } = require('../services/resortQueries');

// `members` duplicates the trail/lift references and can hold ~1,000 ids per resort
const RESORT_FIELDS = '-members -__v';

// GET /api/resorts - Resorts sorted by rank, with search, filters and pagination
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildResortFilter(req.query);

  const [resorts, total] = await Promise.all([
    Resort.find(filter).select(RESORT_FIELDS).sort({ rank: 1 }).skip(skip).limit(limit).lean(),
    Resort.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: resorts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET /api/resorts/filters - Countries with their regions, for filter dropdowns
router.get('/filters', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await listCountries()
  });
}));

// GET /api/resorts/search - Search resorts (top matches by rank, no pagination)
router.get('/search', asyncHandler(async (req, res) => {
  const { limit } = parsePagination(req.query, { defaultLimit: 10 });
  const resorts = await Resort.find(buildResortFilter(req.query))
    .select(RESORT_FIELDS)
    .sort({ rank: 1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: resorts
  });
}));

// GET /api/resorts/:id - Get specific resort with trails and lifts
router.get('/:id', asyncHandler(async (req, res) => {
  const resort = await Resort.findById(req.params.id).select(RESORT_FIELDS).lean();
  if (!resort) {
    throw new HttpError(404, 'Resort not found');
  }

  const [trails, lifts] = await Promise.all([
    Trail.find({ resort: resort._id }).sort({ name: 1 }).lean(),
    Lift.find({ resort: resort._id }).sort({ name: 1 }).lean()
  ]);

  res.json({
    success: true,
    data: {
      resort,
      trails,
      lifts,
      stats: {
        totalTrails: trails.length,
        totalLifts: lifts.length
      }
    }
  });
}));

// GET /api/resorts/:id/trails - Get trails for a specific resort
router.get('/:id/trails', asyncHandler(async (req, res) => {
  const trails = await Trail.find({ resort: req.params.id }).sort({ name: 1 }).lean();

  res.json({
    success: true,
    data: trails
  });
}));

// GET /api/resorts/:id/lifts - Get lifts for a specific resort
router.get('/:id/lifts', asyncHandler(async (req, res) => {
  const lifts = await Lift.find({ resort: req.params.id }).sort({ name: 1 }).lean();

  res.json({
    success: true,
    data: lifts
  });
}));

module.exports = router;
