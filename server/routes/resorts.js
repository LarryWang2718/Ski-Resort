// routes/resorts.js
const express = require('express');
const router = express.Router();
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');

// GET /api/resorts - Get all resorts with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.country) {
      filter.location_country = { $regex: req.query.country, $options: 'i' };
    }
    
    if (req.query.region) {
      filter.location_region = { $regex: req.query.region, $options: 'i' };
    }
    
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' };
    }

    // Get resorts with pagination
    const resorts = await Resort.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    // Get total count for pagination
    const total = await Resort.countDocuments(filter);

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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resorts',
      error: error.message
    });
  }
});

// GET /api/resorts/search - Search resorts
router.get('/search', async (req, res) => {
  try {
    const { q, country, region, limit = 10 } = req.query;
    
    const filter = {};
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { location_country: { $regex: q, $options: 'i' } },
        { location_region: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (country) {
      filter.location_country = { $regex: country, $options: 'i' };
    }
    
    if (region) {
      filter.location_region = { $regex: region, $options: 'i' };
    }

    const resorts = await Resort.find(filter)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      data: resorts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching resorts',
      error: error.message
    });
  }
});

// GET /api/resorts/:id - Get specific resort with trails and lifts
router.get('/:id', async (req, res) => {
  try {
    const resort = await Resort.findById(req.params.id);
    
    if (!resort) {
      return res.status(404).json({
        success: false,
        message: 'Resort not found'
      });
    }

    // Get trails and lifts for this resort
    const trails = await Trail.find({ resort: req.params.id });
    const lifts = await Lift.find({ resort: req.params.id });

    res.json({
      success: true,
      data: {
        resort,
        trails,
        lifts,
        stats: {
          totalTrails: trails.length,
          totalLifts: lifts.length,
          openTrails: trails.filter(t => t.status === 'open').length,
          openLifts: lifts.filter(l => l.status === 'open').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resort',
      error: error.message
    });
  }
});

// GET /api/resorts/:id/trails - Get trails for a specific resort
router.get('/:id/trails', async (req, res) => {
  try {
    const trails = await Trail.find({ resort: req.params.id });
    
    res.json({
      success: true,
      data: trails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trails',
      error: error.message
    });
  }
});

// GET /api/resorts/:id/lifts - Get lifts for a specific resort
router.get('/:id/lifts', async (req, res) => {
  try {
    const lifts = await Lift.find({ resort: req.params.id });
    
    res.json({
      success: true,
      data: lifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching lifts',
      error: error.message
    });
  }
});

module.exports = router;