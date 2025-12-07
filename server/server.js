const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  }
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// Database connection
const connectDB = require('./config/database');
connectDB();

// Import models
const User = require('./models/User');
const Resort = require('./models/Resort');
const Trail = require('./models/Trail');
const Lift = require('./models/Lift');
const Weather = require('./models/Weather');
const Review = require('./models/Review');

console.log('All models loaded successfully!');

// Import routes
const resortRoutes = require('./routes/resorts');
const trailRoutes = require('./routes/trails');
const liftRoutes = require('./routes/lifts');
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resorts', resortRoutes);
app.use('/api/trails', trailRoutes);
app.use('/api/lifts', liftRoutes);

// API Documentation route
app.get('/', (req, res) => {
  res.json({
    message: 'Ski Resort API is running!',
    version: '1.0.0',
    endpoints: {
      resorts: {
        'GET /api/resorts': 'Get all resorts with pagination and filtering',
        'GET /api/resorts/:id': 'Get specific resort with trails and lifts',
        'GET /api/resorts/:id/trails': 'Get trails for a specific resort',
        'GET /api/resorts/:id/lifts': 'Get lifts for a specific resort',
        'GET /api/resorts/search': 'Search resorts'
      },
      trails: {
        'GET /api/trails': 'Get all trails with filtering and pagination',
        'GET /api/trails/:id': 'Get specific trail',
        'GET /api/trails/search': 'Search trails',
        'GET /api/trails/stats/difficulty': 'Get trail difficulty statistics',
        'GET /api/trails/stats/status': 'Get trail status statistics'
      },
      lifts: {
        'GET /api/lifts': 'Get all lifts with filtering and pagination',
        'GET /api/lifts/:id': 'Get specific lift',
        'GET /api/lifts/search': 'Search lifts',
        'GET /api/lifts/stats/aerialway': 'Get lift type statistics',
        'GET /api/lifts/stats/status': 'Get lift status statistics'
      }
    },
    examples: {
      'Get resorts in Switzerland': '/api/resorts?country=Switzerland',
      'Get easy trails': '/api/trails?difficulty=easy',
      'Get gondola lifts': '/api/lifts?aerialway=gondola',
      'Search for Verbier': '/api/resorts/search?q=Verbier'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}`);
});
