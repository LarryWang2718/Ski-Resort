// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // Contact Information
  phone: {
    type: String,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  
  // Location Information
  location: {
    country: String,
    region: String, // state/province
    city: String,
    timezone: String
  },
  
  // Skiing/Snowboarding Profile
  profile: {
    skiLevel: {
      type: String,
      enum: ['never-ever', 'beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner'
    },
    snowboardLevel: {
      type: String,
      enum: ['never-tried', 'beginner', 'intermediate', 'advanced', 'expert']
    },
    preferredTerrain: [{
      type: String,
      enum: ['groomed-runs', 'moguls', 'powder', 'terrain-park', 'backcountry', 'cross-country']
    }],
    yearsOfExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
      max: [100, 'Years of experience seems too high']
    }
  },
  
  // Platform Preferences
  preferences: {
    favoriteResorts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resort'
    }],
    wishlistResorts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resort'
    }],
    preferredCurrency: {
      type: String,
      enum: ['USD', 'CAD', 'JPY', 'EUR', 'CHF', 'AUD'],
      default: 'USD'
    },
    language: {
      type: String,
      enum: ['en', 'ja', 'fr', 'de', 'es'],
      default: 'en'
    },
    newsletter: {
      type: Boolean,
      default: false
    },
    weatherAlerts: {
      type: Boolean,
      default: false
    }
  },
  
  // Social Features
  social: {
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    favoriteQuote: {
      type: String,
      maxlength: [200, 'Quote cannot exceed 200 characters']
    },
    skiingStyle: {
      type: String,
      enum: ['cruise', 'aggressive', 'park', 'backcountry', 'racing', 'freestyle']
    },
    isPublicProfile: {
      type: Boolean,
      default: false
    }
  },
  
  // Platform Statistics
  stats: {
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative']
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: [0, 'Total bookings cannot be negative']
    },
    resortsVisited: [{
      resort: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resort'
      },
      visitCount: {
        type: Number,
        default: 1
      },
      lastVisit: Date,
      firstVisit: Date
    }],
    memberSince: {
      type: Date,
      default: Date.now
    },
    lastActiveDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Account Management
  role: {
    type: String,
    enum: ['user', 'admin', 'resort-manager', 'moderator'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  
  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Login Tracking
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Privacy Settings
  privacy: {
    showEmail: {
      type: Boolean,
      default: false
    },
    showLocation: {
      type: Boolean,
      default: true
    },
    showSkiLevel: {
      type: Boolean,
      default: true
    },
    allowMessages: {
      type: Boolean,
      default: true
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'stats.lastActiveDate': -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.updatedAt = Date.now();
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.lockUntil) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: Date.now(), 'stats.lastActiveDate': Date.now() }
  });
};

// Add resort to visited list
userSchema.methods.addVisitedResort = function(resortId) {
  const existingVisit = this.stats.resortsVisited.find(
    visit => visit.resort.toString() === resortId.toString()
  );
  
  if (existingVisit) {
    existingVisit.visitCount += 1;
    existingVisit.lastVisit = Date.now();
  } else {
    this.stats.resortsVisited.push({
      resort: resortId,
      visitCount: 1,
      lastVisit: Date.now(),
      firstVisit: Date.now()
    });
  }
  
  return this.save();
};

// Add resort to favorites
userSchema.methods.addFavoriteResort = function(resortId) {
  if (!this.preferences.favoriteResorts.includes(resortId)) {
    this.preferences.favoriteResorts.push(resortId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove resort from favorites
userSchema.methods.removeFavoriteResort = function(resortId) {
  this.preferences.favoriteResorts = this.preferences.favoriteResorts.filter(
    id => id.toString() !== resortId.toString()
  );
  return this.save();
};

// Add resort to wishlist
userSchema.methods.addToWishlist = function(resortId) {
  if (!this.preferences.wishlistResorts.includes(resortId)) {
    this.preferences.wishlistResorts.push(resortId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove resort from wishlist
userSchema.methods.removeFromWishlist = function(resortId) {
  this.preferences.wishlistResorts = this.preferences.wishlistResorts.filter(
    id => id.toString() !== resortId.toString()
  );
  return this.save();
};

// Check if user can write reviews (prevent spam)
userSchema.methods.canWriteReview = function() {
  // Allow one review per resort per user
  return this.stats.totalReviews < 100; // reasonable limit
};

// Update review count
userSchema.methods.incrementReviewCount = function() {
  this.stats.totalReviews += 1;
  return this.save();
};

// Static methods
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

userSchema.statics.findByRole = function(role) {
  return this.find({ role: role, isActive: true });
};

userSchema.statics.getRecentUsers = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    createdAt: { $gte: cutoffDate },
    isActive: true
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('User', userSchema);