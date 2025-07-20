const express = require('express');
const router = express.Router();
const Lift = require('../models/Lift');
const Resort = require('../models/Resort');

// GET /api/lifts - Get all lifts with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.aerialway) {
      filter.aerialway = req.query.aerialway;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.lit) {
      filter.lit = req.query.lit === 'true';
    }
    
    if (req.query.oneway) {
      filter.oneway = req.query.oneway === 'true';
    }
    
    if (req.query.resort) {
      filter.resort = req.query.resort;
    }

    // Get lifts with pagination
    const lifts = await Lift.find(filter)
      .populate('resort', 'name location_country location_region')
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    // Get total count for pagination
    const total = await Lift.countDocuments(filter);

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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching lifts',
      error: error.message
    });
  }
});

// GET /api/lifts/search - Search lifts
router.get('/search', async (req, res) => {
  try {
    const { q, aerialway, status, resort, limit = 10 } = req.query;
    
    const filter = {};
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (aerialway) {
      filter.aerialway = aerialway;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (resort) {
      filter.resort = resort;
    }

    const lifts = await Lift.find(filter)
      .populate('resort', 'name location_country location_region')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      data: lifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching lifts',
      error: error.message
    });
  }
});

// GET /api/lifts/stats/aerialway - Get lift type statistics
router.get('/stats/aerialway', async (req, res) => {
  try {
    const stats = await Lift.aggregate([
      {
        $group: {
          _id: '$aerialway',
          count: { $sum: 1 },
          openLifts: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching lift statistics',
      error: error.message
    });
  }
});

// GET /api/lifts/stats/status - Get lift status statistics
router.get('/stats/status', async (req, res) => {
  try {
    const stats = await Lift.aggregate([
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
      message: 'Error fetching lift status statistics',
      error: error.message
    });
  }
});

// GET /api/lifts/:id - Get specific lift
router.get('/:id', async (req, res) => {
  try {
    const lift = await Lift.findById(req.params.id)
      .populate('resort', 'name location_country location_region');
    
    if (!lift) {
      return res.status(404).json({
        success: false,
        message: 'Lift not found'
      });
    }

    res.json({
      success: true,
      data: lift
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching lift',
      error: error.message
    });
  }
});

module.exports = router; 