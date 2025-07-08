// models/Lift.js
const mongoose = require('mongoose');

const liftSchema = new mongoose.Schema({
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
    required: [true, 'Lift name is required'],
    trim: true,
    maxlength: [100, 'Lift name cannot exceed 100 characters']
  },
  shortName: {
    type: String,
    trim: true,
    maxlength: [20, 'Short name cannot exceed 20 characters'] // "Hana1", "King #4"
  },
  
  // Lift Type & Specifications
  type: {
    type: String,
    enum: [
      'gondola', 'funicular', 'express-quad', 'quad-chair', 'triple-chair', 
      'double-chair', 'single-chair', 'surface-lift', 'magic-carpet',
      'high-speed-quad', 'high-speed-six', 'chairlift'
    ],
    required: [true, 'Lift type is required']
  },
  manufacturer: {
    type: String,
    trim: true // "Doppelmayr", "Leitner-Poma", "Skytrac"
  },
  
  // Current Status
  status: {
    type: String,
    enum: ['operational', 'closed', 'maintenance', 'weather-hold', 'wind-hold'],
    default: 'closed'
  },
  statusReason: {
    type: String,
    maxlength: [200, 'Status reason cannot exceed 200 characters']
  },
  
  // Real-time Information
  waitTime: {
    type: Number, // in minutes
    default: 0,
    min: [0, 'Wait time cannot be negative'],
    max: [180, 'Wait time seems unreasonably high']
  },
  queueLength: {
    type: Number, // number of people in line
    default: 0,
    min: [0, 'Queue length cannot be negative']
  },
  
  // Technical Specifications
  capacity: {
    type: Number, // people per hour
    min: [0, 'Capacity cannot be negative']
  },
  speed: {
    type: Number, // in meters per minute
    min: [0, 'Speed cannot be negative']
  },
  length: {
    type: Number, // in meters
    min: [0, 'Length cannot be negative']
  },
  verticalRise: {
    type: Number, // in meters
    min: [0, 'Vertical rise cannot be negative']
  },
  rideTime: {
    type: Number, // in minutes
    min: [0, 'Ride time cannot be negative']
  },
  
  // Seating & Comfort
  seatingCapacity: {
    type: Number, // people per chair/cabin
    min: [1, 'Seating capacity must be at least 1']
  },
  hasWeatherProtection: {
    type: Boolean,
    default: false // bubbles, hoods, enclosed cabins
  },
  hasHeatedSeats: {
    type: Boolean,
    default: false
  },
  hasSafetyBar: {
    type: Boolean,
    default: true
  },
  hasFootRests: {
    type: Boolean,
    default: false
  },
  
  // Operating Information
  operatingHours: {
    start: String, // "08:30"
    end: String, // "16:00" or "20:30"
    nightOperation: {
      type: Boolean,
      default: false
    },
    uploadOnly: {
      type: Boolean,
      default: false // some lifts only go up
    }
  },
  
  // Seasonal Information
  seasonalOperation: {
    winterSeason: {
      type: Boolean,
      default: true
    },
    summerSeason: {
      type: Boolean,
      default: false
    },
    bikeSeason: {
      type: Boolean,
      default: false
    }
  },
  
  // Access & Skill Level
  accessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'all-levels'],
    default: 'all-levels'
  },
  loadingDifficulty: {
    type: String,
    enum: ['easy', 'moderate', 'difficult'],
    default: 'easy'
  },
  
  // Features
  features: [{
    type: String,
    enum: [
      'heated-seats', 'weather-protection', 'high-speed',
      'beginner-friendly', 'scenic-ride', 'night-operation',
      'wind-resistant', 'detachable-chairs', 'loading-carpet',
      'ski-tip-protection', 'automatic-gate'
    ]
  }],
  
  // Connected Trails
  servesTrails: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trail'
  }],
  accessTrails: [{ // trails needed to reach this lift
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trail'
  }],
  
  // Connected Lifts
  connectsToLifts: [{
    lift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lift'
    },
    connectionType: {
      type: String,
      enum: ['direct', 'via-trail', 'base-transfer']
    }
  }],
  
  // Location Information
  baseStation: {
    elevation: Number, // meters above sea level
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    facilities: [{
      type: String,
      enum: ['ticket-office', 'ski-school', 'rental', 'restaurant', 'restroom', 'parking', 'warming-hut']
    }]
  },
  topStation: {
    elevation: Number,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    facilities: [{
      type: String,
      enum: ['restaurant', 'restroom', 'warming-hut', 'observation-deck', 'patrol-hut']
    }]
  },
  
  // Weather Sensitivity
  windLimits: {
    maxWindSpeed: Number, // km/h before closure
    windDirection: String // most problematic wind direction
  },
  temperatureLimits: {
    minOperatingTemp: Number, // Celsius
    maxOperatingTemp: Number // for summer operations
  },
  
  // Maintenance & Safety
  lastMaintenance: Date,
  nextScheduledMaintenance: Date,
  safetyInspectionDate: Date,
  accidentHistory: {
    totalIncidents: {
      type: Number,
      default: 0,
      min: [0, 'Incidents cannot be negative']
    },
    lastIncident: Date,
    safetyRating: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'needs-attention'],
      default: 'good'
    }
  },
  
  // Popularity & Usage
  popularityScore: {
    type: Number,
    min: [1, 'Popularity score must be between 1 and 10'],
    max: [10, 'Popularity score must be between 1 and 10'],
    default: 5
  },
  averageWaitTime: {
    type: Number, // historical average in minutes
    min: [0, 'Average wait time cannot be negative']
  },
  
  // Pricing (if different from general lift ticket)
  specialPricing: {
    hasSpecialPrice: {
      type: Boolean,
      default: false
    },
    price: Number,
    currency: String,
    reason: String // "scenic ride", "summer operation"
  },
  
  // Media
  images: [{
    url: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    caption: String,
    type: {
      type: String,
      enum: ['base-station', 'top-station', 'in-operation', 'loading', 'view']
    },
    takenDate: Date
  }],
  
  // Description & Notes
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  operatorNotes: {
    type: String,
    maxlength: [300, 'Operator notes cannot exceed 300 characters']
  },
  
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
liftSchema.index({ resort: 1 });
liftSchema.index({ status: 1 });
liftSchema.index({ type: 1 });
liftSchema.index({ resortArea: 1 });
liftSchema.index({ accessLevel: 1 });
liftSchema.index({ popularityScore: -1 });

// Compound indexes
liftSchema.index({ resort: 1, status: 1 });
liftSchema.index({ resort: 1, type: 1 });
liftSchema.index({ resort: 1, resortArea: 1 });
liftSchema.index({ resort: 1, 'features': 1 });

// Pre-save middleware
liftSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update statusLastUpdated when status changes
  if (this.isModified('status') || this.isModified('waitTime')) {
    this.statusLastUpdated = Date.now();
  }
  
  // Auto-calculate ride time based on length and speed
  if (!this.rideTime && this.length && this.speed) {
    this.rideTime = Math.round(this.length / this.speed);
  }
  
  // Auto-calculate vertical rise if base and top elevations are provided
  if (!this.verticalRise && this.baseStation.elevation && this.topStation.elevation) {
    this.verticalRise = this.topStation.elevation - this.baseStation.elevation;
  }
  
  next();
});

// Instance methods
liftSchema.methods.isOperational = function() {
  return this.status === 'operational';
};

liftSchema.methods.hasNightOperation = function() {
  return this.features.includes('night-operation') || this.operatingHours.nightOperation;
};

liftSchema.methods.isBeginnerFriendly = function() {
  return this.accessLevel === 'beginner' || 
         this.features.includes('beginner-friendly') ||
         this.loadingDifficulty === 'easy';
};

liftSchema.methods.isHighSpeed = function() {
  return this.features.includes('high-speed') || 
         this.type.includes('high-speed') ||
         this.type === 'express-quad';
};

liftSchema.methods.calculateWaitTimeCategory = function() {
  if (this.waitTime <= 2) return 'no-wait';
  if (this.waitTime <= 5) return 'short';
  if (this.waitTime <= 10) return 'moderate';
  if (this.waitTime <= 20) return 'long';
  return 'very-long';
};

liftSchema.methods.estimateRideTime = function() {
  if (this.rideTime) return this.rideTime;
  
  // Estimate based on type if exact data not available
  const typeEstimates = {
    'gondola': 8,
    'express-quad': 4,
    'quad-chair': 6,
    'triple-chair': 8,
    'double-chair': 10,
    'single-chair': 12,
    'surface-lift': 2,
    'magic-carpet': 1
  };
  
  return typeEstimates[this.type] || 6;
};

// Static methods
liftSchema.statics.findByResort = function(resortId) {
  return this.find({ resort: resortId });
};

liftSchema.statics.findOperational = function(resortId) {
  return this.find({ resort: resortId, status: 'operational' });
};

liftSchema.statics.findByType = function(resortId, type) {
  return this.find({ resort: resortId, type: type });
};

liftSchema.statics.findWithNightOperation = function(resortId) {
  return this.find({ 
    resort: resortId, 
    $or: [
      { 'features': 'night-operation' },
      { 'operatingHours.nightOperation': true }
    ]
  });
};

liftSchema.statics.findBeginnerFriendly = function(resortId) {
  return this.find({ 
    resort: resortId, 
    $or: [
      { accessLevel: 'beginner' },
      { accessLevel: 'all-levels' },
      { 'features': 'beginner-friendly' }
    ]
  });
};

liftSchema.statics.getLiftStats = function(resortId) {
  return this.aggregate([
    { $match: { resort: mongoose.Types.ObjectId(resortId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        operational: {
          $sum: { $cond: [{ $eq: ['$status', 'operational'] }, 1, 0] }
        },
        averageWaitTime: { $avg: '$waitTime' }
      }
    }
  ]);
};

liftSchema.statics.getCurrentWaitTimes = function(resortId) {
  return this.find(
    { resort: resortId, status: 'operational' },
    { name: 1, waitTime: 1, resortArea: 1, type: 1 }
  ).sort({ waitTime: 1 });
};

module.exports = mongoose.model('Lift', liftSchema);