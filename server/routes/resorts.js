// routes/resorts.js
const express = require('express');
const router = express.Router();
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');

// GET /api/resorts - Get all resorts
router.get('/', async (req, res) => {
  try {
    const resorts = await Resort.find({ isActive: true });
    res.json({
      success: true,
      count: resorts.length,
      data: resorts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resorts',
      error: error.message
    });
  }
});

// GET /api/resorts/:slug - Get single resort by slug
router.get('/:slug', async (req, res) => {
  try {
    const resort = await Resort.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });
    
    if (!resort) {
      return res.status(404).json({
        success: false,
        message: 'Resort not found'
      });
    }
    
    res.json({
      success: true,
      data: resort
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resort',
      error: error.message
    });
  }
});

// GET /api/resorts/:slug/trails - Get all trails for a resort
router.get('/:slug/trails', async (req, res) => {
  try {
    // First find the resort
    const resort = await Resort.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });
    
    if (!resort) {
      return res.status(404).json({
        success: false,
        message: 'Resort not found'
      });
    }
    
    // Get query parameters for filtering
    const { difficulty, status, area } = req.query;
    
    // Build filter object
    const filter = { resort: resort._id };
    if (difficulty) filter.difficulty = difficulty;
    if (status) filter.status = status;
    if (area) filter.resortArea = area;
    
    const trails = await Trail.find(filter)
      .populate('topLifts', 'name type')
      .sort({ difficulty: 1, name: 1 });
    
    res.json({
      success: true,
      resort: resort.name,
      count: trails.length,
      filters: { difficulty, status, area },
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

// GET /api/resorts/:slug/lifts - Get all lifts for a resort
router.get('/:slug/lifts', async (req, res) => {
  try {
    // First find the resort
    const resort = await Resort.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });
    
    if (!resort) {
      return res.status(404).json({
        success: false,
        message: 'Resort not found'
      });
    }
    
    // Get query parameters for filtering
    const { type, status, area } = req.query;
    
    // Build filter object
    const filter = { resort: resort._id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (area) filter.resortArea = area;
    
    const lifts = await Lift.find(filter)
      .populate('servesTrails', 'name difficulty')
      .sort({ type: 1, name: 1 });
    
    res.json({
      success: true,
      resort: resort.name,
      count: lifts.length,
      filters: { type, status, area },
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

// GET /api/resorts/:slug/stats - Get resort statistics
router.get('/:slug/stats', async (req, res) => {
  try {
    const resort = await Resort.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });
    
    if (!resort) {
      return res.status(404).json({
        success: false,
        message: 'Resort not found'
      });
    }
    
    // Get trail statistics
    const trailStats = await Trail.aggregate([
      { $match: { resort: resort._id } },
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 },
          totalLength: { $sum: '$length' },
          openTrails: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Get lift statistics  
    const liftStats = await Lift.aggregate([
      { $match: { resort: resort._id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          operational: {
            $sum: { $cond: [{ $eq: ['$status', 'operational'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      resort: resort.name,
      data: {
        resort: resort.stats,
        trails: trailStats,
        lifts: liftStats,
        areas: resort.areas
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resort statistics',
      error: error.message
    });
  }
});

module.exports = router;