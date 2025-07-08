// models/Trail.js
const mongoose = require('mongoose');

const trailSchema = new mongoose.Schema({
  // Resort Reference
  resort: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resort',
    required: [true, 'Resort reference is required']
  },
  resortArea: {
    type: String,
    trim: true // "Grand Hirafu", "Hanazono", "Niseko Village", "Annupuri"
  },
  
  // Basic Information
  name: {
    type: String,
    required: [true, 'Trail name is required'],
    trim: true,
    maxlength: [100, 'Trail name cannot exceed 100 characters']
  },
  difficulty: {
    type: String,
    required: [true, 'Trail difficulty is required'],
    enum: ['beginner', 'intermediate', 'advanced'],
    lowercase: true
  },
  
  // Current Status
  status: {
    type: String,
    enum: ['open', 'closed', 'maintenance'],
    default: 'closed'
  },
  conditions: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'fair'
  },
  
  // Trail Specifications
  length: {
    type: Number, // in meters
    min: [0, 'Trail length cannot be negative']
  },
  verticalDrop: {
    type: Number, // in meters
    min: [0, 'Vertical drop cannot be negative']
  },
  width: {
    type: Number, // average width in meters
    min: [0, 'Trail width cannot be negative']
  },
  gradient: {
    type: Number, // average gradient percentage
    min: [0, 'Gradient cannot be negative'],
    max: [100, 'Gradient cannot exceed 100%']
  },
  
  // Grooming & Maintenance
  lastGroomed: {
    type: Date
  },
  groomingType: {
    type: String,
    enum: ['groomed', 'moguls', 'powder', 'ungroomed'],
    default: 'groomed'
  },
  groomingFrequency: {
    type: String,
    enum: ['daily', 'every-other-day', 'weekly', 'as-needed', 'never']
  },
  
  // Features & Characteristics
  features: [{
    type: String,
    enum: [
      'night-skiing', 'terrain-park', 'moguls', 'trees', 
      'halfpipe', 'beginner-friendly', 'scenic-views',
      'backcountry-access', 'family-run', 'high-speed',
      'gentle-gradient', 'steep-sections', 'wide-open',
      'narrow-trail', 'wind-protected', 'powder', 
      'deep-snow', 'fresh-snow', 'untracked',
      'bowls', 'chutes', 'cliffs', 'cornices',
      'freshly-groomed', 'machine-groomed', 'corduroy',
      'challenging', 'cruising', 'carving', 'freestyle'
    ]
  }],
  
  // Access Information
  topLifts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lift'
  }],
  bottomLifts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lift'
  }],
  
  // Connected Trails
  connectsTo: [{
    trail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trail'
    },
    connectionType: {
      type: String,
      enum: ['merge', 'split', 'intersection', 'adjacent']
    }
  }],
  
  // Description & Notes
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  tips: {
    type: String,
    maxlength: [300, 'Tips cannot exceed 300 characters'],
    trim: true
  },
  
  // Safety & Warnings
  warnings: [{
    type: String,
    maxlength: [200, 'Warning cannot exceed 200 characters']
  }],
  avalancheRisk: {
    type: String,
    enum: ['none', 'low', 'moderate', 'high', 'extreme']
  },
  
  // Operating Information
  operatingHours: {
    start: String, // "08:30"
    end: String, // "16:00" or "20:30" for night skiing
    nightSkiing: {
      type: Boolean,
      default: false
    }
  },
  
  // Popularity & Usage
  popularityScore: {
    type: Number,
    min: [1, 'Popularity score must be between 1 and 10'],
    max: [10, 'Popularity score must be between 1 and 10'],
    default: 5
  },
  crowdLevel: {
    type: String,
    enum: ['low', 'moderate', 'high', 'very-high'],
    default: 'moderate'
  },
  
  // Weather Dependencies
  windExposure: {
    type: String,
    enum: ['sheltered', 'moderate', 'exposed'],
    default: 'moderate'
  },
  sunExposure: {
    type: String,
    enum: ['shaded', 'partial-sun', 'full-sun'],
    default: 'partial-sun'
  },
  
  // Skill Level Details
  skillRequirements: {
    minimumLevel: {
      type: String,
      enum: ['never-ever', 'beginner', 'intermediate', 'advanced', 'expert']
    },
    technicalDifficulty: {
      type: Number,
      min: [1, 'Technical difficulty must be between 1 and 10'],
      max: [10, 'Technical difficulty must be between 1 and 10']
    }
  },
  
  // Statistics
  stats: {
    averageRunTime: Number, // in minutes
    maxCapacity: Number, // skiers per hour
    accidentRate: {
      type: String,
      enum: ['very-low', 'low', 'moderate', 'high']
    }
  },
  
  // Media
  images: [{
    url: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    caption: String,
    season: String, // "winter", "spring", "powder-day"
    takenDate: Date
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  statusLastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
trailSchema.index({ resort: 1 });
trailSchema.index({ difficulty: 1 });
trailSchema.index({ status: 1 });
trailSchema.index({ resortArea: 1 });
trailSchema.index({ 'features': 1 });
trailSchema.index({ popularityScore: -1 });

// Compound indexes
trailSchema.index({ resort: 1, difficulty: 1 });
trailSchema.index({ resort: 1, status: 1 });
trailSchema.index({ resort: 1, resortArea: 1 });

// Pre-save middleware
trailSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update statusLastUpdated when status changes
  if (this.isModified('status') || this.isModified('conditions')) {
    this.statusLastUpdated = Date.now();
  }
  
  // Auto-calculate technical difficulty based on gradient and features
  if (!this.skillRequirements.technicalDifficulty && this.gradient) {
    let difficulty = 1;
    
    if (this.difficulty === 'beginner') difficulty = Math.min(3, Math.max(1, Math.floor(this.gradient / 5) + 1));
    else if (this.difficulty === 'intermediate') difficulty = Math.min(7, Math.max(3, Math.floor(this.gradient / 8) + 2));
    else if (this.difficulty === 'advanced') difficulty = Math.min(10, Math.max(6, Math.floor(this.gradient / 10) + 4));
    
    // Adjust for features
    if (this.features.includes('moguls')) difficulty += 1;
    if (this.features.includes('trees')) difficulty += 1;
    if (this.features.includes('steep-sections')) difficulty += 2;
    
    this.skillRequirements.technicalDifficulty = Math.min(10, difficulty);
  }
  
  next();
});

// Instance methods
trailSchema.methods.isOpen = function() {
  return this.status === 'open';
};

trailSchema.methods.hasNightSkiing = function() {
  return this.features.includes('night-skiing') || this.operatingHours.nightSkiing;
};

trailSchema.methods.isBeginnerFriendly = function() {
  return this.difficulty === 'beginner' || this.features.includes('beginner-friendly');
};

trailSchema.methods.calculateRunTime = function(skierLevel = 'intermediate') {
  if (!this.length) return null;
  
  // Base speed in meters per minute based on skier level
  const baseSpeeds = {
    'never-ever': 50,
    'beginner': 100,
    'intermediate': 200,
    'advanced': 350,
    'expert': 500
  };
  
  const speed = baseSpeeds[skierLevel] || baseSpeeds['intermediate'];
  const timeMinutes = this.length / speed;
  
  // Adjust for difficulty and features
  let adjustmentFactor = 1;
  if (this.difficulty === 'advanced') adjustmentFactor += 0.3;
  if (this.features.includes('moguls')) adjustmentFactor += 0.5;
  if (this.features.includes('trees')) adjustmentFactor += 0.3;
  
  return Math.round(timeMinutes * adjustmentFactor);
};

// Static methods
trailSchema.statics.findByResort = function(resortId) {
  return this.find({ resort: resortId });
};

trailSchema.statics.findOpenTrails = function(resortId) {
  return this.find({ resort: resortId, status: 'open' });
};

trailSchema.statics.findByDifficulty = function(resortId, difficulty) {
  return this.find({ resort: resortId, difficulty: difficulty });
};

trailSchema.statics.findWithNightSkiing = function(resortId) {
  return this.find({ 
    resort: resortId, 
    $or: [
      { 'features': 'night-skiing' },
      { 'operatingHours.nightSkiing': true }
    ]
  });
};

trailSchema.statics.getTrailStats = function(resortId) {
  return this.aggregate([
    { $match: { resort: mongoose.Types.ObjectId(resortId) } },
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
};

module.exports = mongoose.model('Trail', trailSchema);