// models/Resort.js
const mongoose = require('mongoose');

const resortSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Resort name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Resort name cannot exceed 100 characters']
  },
  // Internationalization
  localizedNames: {
    en: String,
    fr: String,
    ja: String,
    de: String,
    es: String,
    zh: String
  },
  localizedDescriptions: {
    en: String,
    fr: String,
    ja: String,
    de: String,
    es: String,
    zh: String
  },
  slug: {
    type: String,
    required: [true, 'Resort slug is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  
  // Location Data
  location: {
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    countryCode: {
      type: String,
      trim: true // ISO 3166-1 alpha-2
    },
    region: {
      type: String,
      required: [true, 'Region/State/Province is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    },
    mapboxId: {
      type: String,
      trim: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  // External IDs for mapping/data sources
  externalIds: {
    skiMap: String,
    openSnow: String,
    googlePlaces: String
  },
  
  // Resort Statistics
  stats: {
    totalTrails: {
      type: Number,
      min: [0, 'Total trails cannot be negative']
    },
    totalLifts: {
      type: Number,
      min: [0, 'Total lifts cannot be negative']
    },
    skiableArea: {
      hectares: Number,
      acres: Number
    },
    elevationBase: {
      type: Number,
      min: [0, 'Base elevation cannot be negative']
    },
    elevationSummit: {
      type: Number,
      min: [0, 'Summit elevation cannot be negative']
    },
    verticalDrop: {
      type: Number,
      min: [0, 'Vertical drop cannot be negative']
    },
    longestRun: {
      type: Number, // in km
      min: [0, 'Longest run cannot be negative']
    },
    averageSnowfall: {
      type: Number, // in inches per year
      min: [0, 'Average snowfall cannot be negative']
    }
  },
  
  // Trail Distribution
  trailDistribution: {
    beginner: {
      percentage: {
        type: Number,
        min: [0, 'Percentage cannot be negative'],
        max: [100, 'Percentage cannot exceed 100']
      },
      kilometers: {
        type: Number,
        min: [0, 'Kilometers cannot be negative']
      }
    },
    intermediate: {
      percentage: {
        type: Number,
        min: [0, 'Percentage cannot be negative'],
        max: [100, 'Percentage cannot exceed 100']
      },
      kilometers: {
        type: Number,
        min: [0, 'Kilometers cannot be negative']
      }
    },
    advanced: {
      percentage: {
        type: Number,
        min: [0, 'Percentage cannot be negative'],
        max: [100, 'Percentage cannot exceed 100']
      },
      kilometers: {
        type: Number,
        min: [0, 'Kilometers cannot be negative']
      }
    }
  },
  
  // Season Information
  season: {
    typicalOpen: String, // "YYYY-MM-DD" format
    typicalClose: String, // "YYYY-MM-DD" format
    operatingHours: {
      start: String, // "HH:MM" format
      end: String, // "HH:MM" format
      nightSkiing: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Pricing & Currency
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    uppercase: true,
    enum: ['USD', 'CAD', 'JPY', 'EUR', 'CHF', 'AUD']
  },
  currentPricing: {
    adultFullDay: {
      type: Number,
      min: [0, 'Price cannot be negative']
    },
    youthFullDay: {
      type: Number,
      min: [0, 'Price cannot be negative']
    },
    childFullDay: {
      type: Number,
      min: [0, 'Price cannot be negative']
    },
    season: String, // "2024-25"
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // External Links
  website: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  bookingUrls: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters']
    }
  }],
  
  // Media
  images: [{
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    caption: String,
    type: {
      type: String,
      enum: ['hero', 'trail-map', 'village', 'lifts', 'mountain', 'facilities']
    }
  }],
  trailMapUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  webcamUrls: [{
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  }],
  
  // Resort Areas (for multi-area resorts like Niseko)
  areas: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      maxlength: [300, 'Description cannot exceed 300 characters']
    },
    lifts: {
      type: Number,
      min: [0, 'Number of lifts cannot be negative']
    },
    trails: {
      type: Number,
      min: [0, 'Number of trails cannot be negative']
    },
    features: [{
      type: String,
      enum: [
        'night-skiing', 'terrain-park', 'halfpipe', 'backcountry-access',
        'beginner-friendly', 'expert-terrain', 'scenic-views', 'family-area'
      ]
    }]
  }],
  
  // Features & Amenities
  features: [{
    type: String,
    enum: [
      'night-skiing', 'terrain-park', 'halfpipe', 'backcountry-access',
      'ski-school', 'equipment-rental', 'childcare', 'restaurants',
      'accommodation', 'spa', 'shopping', 'snow-making', 'high-speed-lifts'
    ]
  }],
  
  // Calculated Average Rating (from reviews)
  averageRating: {
    overall: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      default: null
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative']
    },
    categoryRatings: {
      snowQuality: Number,
      terrainVariety: Number,
      liftEfficiency: Number,
      facilities: Number,
      valueForMoney: Number,
      skiSchool: Number,
      dining: Number
    }
  },
  
  // Live Status
  liveStatus: {
    openTrails: Number,
    openLifts: Number,
    snowDepth: Number,
    lastUpdated: Date
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // SEO & Search
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
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

// Indexes for better performance
resortSchema.index({ slug: 1 });
resortSchema.index({ 'location.country': 1 });
resortSchema.index({ 'location.region': 1 });
resortSchema.index({ isActive: 1 });
resortSchema.index({ 'averageRating.overall': -1 });

// Pre-save middleware
resortSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  next();
});

// Instance method to calculate vertical drop
resortSchema.methods.calculateVerticalDrop = function() {
  if (this.stats.elevationSummit && this.stats.elevationBase) {
    this.stats.verticalDrop = this.stats.elevationSummit - this.stats.elevationBase;
  }
  return this.stats.verticalDrop;
};

// Static method to find resorts by country
resortSchema.statics.findByCountry = function(country) {
  return this.find({ 'location.country': country, isActive: true });
};

// Static method to find resorts by difficulty (based on trail distribution)
resortSchema.statics.findByDifficulty = function(difficulty) {
  const field = `trailDistribution.${difficulty}.percentage`;
  return this.find({ [field]: { $gte: 30 }, isActive: true });
};

module.exports = mongoose.model('Resort', resortSchema);