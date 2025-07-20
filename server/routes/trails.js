const express = require('express');
const router = express.Router();
const Trail = require('../models/Trail');
const Resort = require('../models/Resort');

// GET /api/trails - Get all trails with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.pisteType) {
      filter.pisteType = req.query.pisteType;
    }
    
    if (req.query.grooming) {
      filter.grooming = req.query.grooming;
    }
    
    if (req.query.lit) {
      filter.lit = req.query.lit === 'true';
    }
    
    if (req.query.resort) {
      filter.resort = req.query.resort;
    }

    // Get trails with pagination
    const trails = await Trail.find(filter)
      .populate('resort', 'name location_country location_region')
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    // Get total count for pagination
    const total = await Trail.countDocuments(filter);

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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trails',
      error: error.message
    });
  }
});

// GET /api/trails/search - Search trails
router.get('/search', async (req, res) => {
  try {
    const { q, difficulty, status, resort, limit = 10 } = req.query;
    
    const filter = {};
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (difficulty) {
      filter.difficulty = difficulty;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (resort) {
      filter.resort = resort;
    }

    const trails = await Trail.find(filter)
      .populate('resort', 'name location_country location_region')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      data: trails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching trails',
      error: error.message
    });
  }
});

// GET /api/trails/stats/difficulty - Get trail difficulty statistics
router.get('/stats/difficulty', async (req, res) => {
  try {
    const stats = await Trail.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 },
          openTrails: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trail statistics',
      error: error.message
    });
  }
});

// GET /api/trails/stats/status - Get trail status statistics
router.get('/stats/status', async (req, res) => {
  try {
    const stats = await Trail.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trail status statistics',
      error: error.message
    });
  }
});

// GET /api/trails/:id - Get specific trail
router.get('/:id', async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id)
      .populate('resort', 'name location_country location_region');
    
    if (!trail) {
      return res.status(404).json({
        success: false,
        message: 'Trail not found'
      });
    }

    res.json({
      success: true,
      data: trail
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trail',
      error: error.message
    });
  }
});

module.exports = router; 