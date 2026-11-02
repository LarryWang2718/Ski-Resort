const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const resortRoutes = require('./routes/resorts');
const trailRoutes = require('./routes/trails');
const liftRoutes = require('./routes/lifts');
const authRoutes = require('./routes/auth');
const { createAssistantRouter } = require('./routes/assistant');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const HttpError = require('./utils/httpError');

const app = express();
app.disable('x-powered-by');
// Flat query strings only: ?field[$ne]=x must not turn into a Mongo operator
app.set('query parser', 'simple');
// Behind a reverse proxy, rate limits need the real client IP
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

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
// A request whose Origin is the API's own address is same-origin, which CORS doesn't restrict.
// The Create React App dev proxy sends exactly that: it rewrites Origin to its target, which on
// Windows comes with a trailing slash ("http://localhost:5000/"), so compare the parsed parts.
const isOwnOrigin = (origin, req) => {
  try {
    const url = new URL(origin);
    return url.host === req.get('host') && url.protocol === `${req.protocol}:`;
  } catch {
    return false;
  }
};

app.use(cors((req, callback) => {
  const origin = req.get('origin');
  if (!origin || isOwnOrigin(origin, req) || allowedOrigins.includes(origin)) {
    return callback(null, { origin: true });
  }

  return callback(new HttpError(403, 'Origin not allowed'));
}));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

// Health check is registered before the rate limiter so monitors are never throttled
app.get('/api/health', (req, res) => {
  const databaseUp = mongoose.connection.readyState === 1;
  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resorts', resortRoutes);
app.use('/api/trails', trailRoutes);
app.use('/api/lifts', liftRoutes);
app.use('/api/assistant', createAssistantRouter());

// API Documentation route
app.get('/', (req, res) => {
  res.json({
    message: 'Ski Resort API is running!',
    version: '1.0.0',
    endpoints: {
      health: {
        'GET /api/health': 'Service and database status'
      },
      resorts: {
        'GET /api/resorts': 'Resorts sorted by rank; ?q=, ?country=, ?region=, ?page=, ?limit= (max 100)',
        'GET /api/resorts/filters': 'Countries and their regions, for filter dropdowns',
        'GET /api/resorts/search': 'Search resorts by name, region or country (?q=)',
        'GET /api/resorts/:id': 'Get specific resort with trails and lifts',
        'GET /api/resorts/:id/trails': 'Get trails for a specific resort',
        'GET /api/resorts/:id/lifts': 'Get lifts for a specific resort'
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
      },
      assistant: {
        'POST /api/assistant/conversations': 'Start a conversation, optionally about one resort (Bearer token)',
        'GET /api/assistant/conversations': 'Recent conversations (Bearer token)',
        'GET /api/assistant/conversations/:id': 'One conversation with its turns (Bearer token)',
        'POST /api/assistant/conversations/:id/turns': 'Ask a question; the answer streams as server-sent events (Bearer token)',
        'GET /api/assistant/quota': 'Questions left today (Bearer token)'
      },
      auth: {
        'POST /api/auth/register': 'Create an account',
        'POST /api/auth/login': 'Log in and receive a token',
        'GET /api/auth/me': 'Current user (Bearer token)',
        'PUT /api/auth/me': 'Update current user (Bearer token)'
      }
    },
    examples: {
      'Get resorts in Switzerland': '/api/resorts?country=Switzerland',
      'Get easy trails': '/api/trails?difficulty=easy',
      'Get gondola lifts': '/api/lifts?aerialway=gondola',
      'Search for Verbier': '/api/resorts?q=Verbier'
    }
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
