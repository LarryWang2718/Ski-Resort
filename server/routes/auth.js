const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const toPublicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  token: generateToken(user._id)
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = errors.array().map((error) => ({
    field: error.path,
    message: error.msg
  }));

  return res.status(400).json({
    success: false,
    message: details[0].message,
    errors: details
  });
};

// Each validator needs its own message; withMessage only applies to the check right before it
const nameRule = (field, label) => body(field)
  .trim()
  .notEmpty().withMessage(`${label} is required`)
  .isLength({ max: 50 }).withMessage(`${label} cannot exceed 50 characters`);

const emailRule = () => body('email')
  .trim()
  .isEmail().withMessage('Enter a valid email address')
  .normalizeEmail();

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number';

const registrationValidation = [
  nameRule('firstName', 'First name'),
  nameRule('lastName', 'Last name'),
  emailRule(),
  body('password').isString().matches(PASSWORD_PATTERN).withMessage(PASSWORD_MESSAGE),
  validate
];

const loginValidation = [
  emailRule(),
  body('password').isString().notEmpty().withMessage('Password is required'),
  validate
];

const profileValidation = [
  nameRule('firstName', 'First name').optional(),
  nameRule('lastName', 'Last name').optional(),
  emailRule().optional(),
  body('password').optional().isString().matches(PASSWORD_PATTERN).withMessage(PASSWORD_MESSAGE),
  validate
];

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registrationValidation, asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (await User.exists({ email })) {
    throw new HttpError(409, 'An account with that email already exists');
  }

  // A concurrent duplicate still fails on the unique index (handled as 409)
  const user = await User.create({ firstName, lastName, email, password });

  res.status(201).json({
    success: true,
    data: toPublicUser(user)
  });
}));

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user?.isLocked) {
    throw new HttpError(423, 'Account temporarily locked. Please try again later.');
  }

  if (user && (await user.matchPassword(password))) {
    await user.resetLoginAttempts();
    return res.json({
      success: true,
      data: toPublicUser(user)
    });
  }

  if (user) {
    await user.incLoginAttempts();
  }

  throw new HttpError(401, 'Invalid email or password');
}));

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    '-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire'
  );

  res.json({
    success: true,
    data: user
  });
}));

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
router.put('/me', protect, profileValidation, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  if (req.body.email && req.body.email !== user.email) {
    if (await User.exists({ email: req.body.email, _id: { $ne: user._id } })) {
      throw new HttpError(409, 'Email already in use');
    }
  }

  user.firstName = req.body.firstName || user.firstName;
  user.lastName = req.body.lastName || user.lastName;
  user.email = req.body.email || user.email;

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();

  res.json({
    success: true,
    data: toPublicUser(updatedUser)
  });
}));

module.exports = router;
