const jwt = require('jsonwebtoken');
const User = require('../models/User');

const unauthorized = (res, message) => res.status(401).json({ success: false, message });

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return unauthorized(res, 'Not authorized, no token');
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET);
  } catch (error) {
    return unauthorized(res, error.name === 'TokenExpiredError'
      ? 'Your session expired. Log in again.'
      : 'Not authorized, token failed');
  }

  try {
    // Database errors go to the error handler (e.g. 503), not a misleading 401
    req.user = await User.findById(decoded.id).select('-password');
  } catch (error) {
    return next(error);
  }

  if (!req.user || req.user.isActive === false) {
    return unauthorized(res, 'Not authorized');
  }

  return next();
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Not authorized as an admin'
  });
};

module.exports = { protect, admin };
