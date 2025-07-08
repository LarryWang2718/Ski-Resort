// models/Weather.js
const mongoose = require('mongoose');

const weatherSchema = new mongoose.Schema({
  // Resort Reference
  resort: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resort',
    required: [true, 'Resort reference is required']
  },
  
  // Date and Time
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  localTime: String, // formatted local time for the resort's timezone
  
  // Current Weather Conditions
  current: {
    temperature: {
      type: Number, // in Celsius
      required: true
    },
    feelsLike: Number, // wind chill/heat index
    humidity: {
      type: Number, // percentage
      min: [0, 'Humidity cannot be negative'],
      max: [100, 'Humidity cannot exceed 100%']
    },
    pressure: Number, // hPa (hectopascals)
    dewPoint: Number, // Celsius
    uvIndex: {
      type: Number,
      min: [0, 'UV index cannot be negative'],
      max: [15, 'UV index cannot exceed 15']
    }
  },
  
  // Weather Description
  conditions: {
    main: {
      type: String,
      required: true // "Snow", "Clear", "Clouds", "Rain"
    },
    description: {
      type: String,
      required: true // "light snow", "heavy snow", "partly cloudy"
    },
    icon: String // weather icon code from API
  },
  
  // Wind Information
  wind: {
    speed: {
      type: Number, // km/h
      min: [0, 'Wind speed cannot be negative']
    },
    direction: {
      type: Number, // degrees (0-360)
      min: [0, 'Wind direction must be between 0 and 360'],
      max: [360, 'Wind direction must be between 0 and 360']
    },
    directionText: String, // "NW", "SE", etc.
    gust: Number // km/h for gusts
  },
  
  // Visibility
  visibility: {
    type: Number, // in kilometers
    min: [0, 'Visibility cannot be negative']
  },
  
  // Cloud Coverage
  cloudCover: {
    type: Number, // percentage
    min: [0, 'Cloud cover cannot be negative'],
    max: [100, 'Cloud cover cannot exceed 100%']
  },
  
  // Precipitation
  precipitation: {
    rain: {
      last1h: Number, // mm in last hour
      last3h: Number, // mm in last 3 hours
      last24h: Number // mm in last 24 hours
    },
    snow: {
      last1h: Number, // cm in last hour
      last3h: Number, // cm in last 3 hours
      last24h: Number, // cm in last 24 hours
      last48h: Number, // cm in last 48 hours
      last7days: Number // cm in last 7 days
    }
  },
  
  // Snow Conditions (Ski-Specific)
  snowConditions: {
    baseDepth: {
      base: Number, // cm at base elevation
      mid: Number, // cm at mid-mountain
      summit: Number // cm at summit
    },
    snowQuality: {
      type: String,
      enum: ['powder', 'packed-powder', 'granular', 'icy', 'wet', 'spring-snow', 'corn-snow']
    },
    newSnow: {
      overnight: Number, // cm since previous evening
      last24h: Number,
      last48h: Number,
      last7days: Number
    },
    snowType: {
      type: String,
      enum: ['natural', 'machine-made', 'mixed']
    }
  },
  
  // Temperature by Elevation
  temperatureByElevation: {
    base: {
      current: Number,
      high: Number,
      low: Number
    },
    mid: {
      current: Number,
      high: Number,
      low: Number
    },
    summit: {
      current: Number,
      high: Number,
      low: Number
    }
  },
  
  // Daily High/Low (for daily summaries)
  dailyHighLow: {
    high: Number,
    low: Number,
    highTime: String, // time when high occurred
    lowTime: String // time when low occurred
  },
  
  // Avalanche Information
  avalanche: {
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'considerable', 'high', 'extreme']
    },
    bulletinUrl: String, // link to avalanche bulletin
    lastUpdated: Date
  },
  
  // Forecast Data (7-day forecast)
  forecast: [{
    date: {
      type: Date,
      required: true
    },
    high: Number,
    low: Number,
    conditions: {
      main: String,
      description: String,
      icon: String
    },
    precipitationChance: Number, // percentage
    expectedSnowfall: Number, // cm
    windSpeed: Number, // km/h
    windDirection: Number // degrees
  }],
  
  // Skiing Conditions Assessment
  skiingConditions: {
    overall: {
      type: String,
      enum: ['excellent', 'very-good', 'good', 'fair', 'poor'],
      default: 'fair'
    },
    visibility: {
      type: String,
      enum: ['excellent', 'good', 'limited', 'poor'],
      default: 'good'
    },
    windEffect: {
      type: String,
      enum: ['none', 'minimal', 'moderate', 'significant', 'severe'],
      default: 'none'
    },
    temperatureRating: {
      type: String,
      enum: ['ideal', 'comfortable', 'cold', 'very-cold', 'extreme'],
      default: 'comfortable'
    }
  },
  
  // Resort-Specific Alerts
  alerts: [{
    type: {
      type: String,
      enum: ['weather-warning', 'wind-warning', 'temperature-warning', 'visibility-warning', 'avalanche-warning']
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'severe', 'extreme']
    },
    message: String,
    startTime: Date,
    endTime: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Data Sources and Quality
  dataSources: {
    primary: {
      type: String,
      default: 'OpenWeatherMap' // API source
    },
    secondary: [String], // additional sources
    lastApiCall: Date,
    dataQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    }
  },
  
  // Calculated Fields
  calculated: {
    chillFactor: Number, // calculated wind chill
    snowmakingConditions: {
      type: String,
      enum: ['excellent', 'good', 'marginal', 'poor']
    },
    liftOperatingConditions: {
      type: String,
      enum: ['all-lifts', 'most-lifts', 'limited-lifts', 'minimal-lifts']
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
weatherSchema.index({ resort: 1, date: -1 });
weatherSchema.index({ resort: 1, 'skiingConditions.overall': 1 });
weatherSchema.index({ date: -1 });
weatherSchema.index({ 'alerts.isActive': 1 });

// Pre-save middleware
weatherSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  
  // Calculate skiing conditions based on weather data
  this.calculateSkiingConditions();
  
  // Calculate snowmaking conditions
  this.calculateSnowmakingConditions();
  
  // Calculate lift operating conditions
  this.calculateLiftConditions();
  
  next();
});

// Instance methods
weatherSchema.methods.calculateSkiingConditions = function() {
  let overallScore = 5; // Start with "good"
  
  // Temperature assessment
  const temp = this.current.temperature;
  if (temp >= -2 && temp <= -8) {
    this.calculated.chillFactor = temp; // Ideal skiing temperature
    this.skiingConditions.temperatureRating = 'ideal';
  } else if (temp >= -15 && temp < -2) {
    this.skiingConditions.temperatureRating = 'comfortable';
    overallScore -= 0.5;
  } else if (temp < -15) {
    this.skiingConditions.temperatureRating = 'cold';
    overallScore -= 1;
  } else if (temp > -2) {
    this.skiingConditions.temperatureRating = 'comfortable';
    overallScore -= 0.5;
  }
  
  // Wind assessment
  const windSpeed = this.wind.speed || 0;
  if (windSpeed < 15) {
    this.skiingConditions.windEffect = 'none';
  } else if (windSpeed < 25) {
    this.skiingConditions.windEffect = 'minimal';
    overallScore -= 0.5;
  } else if (windSpeed < 35) {
    this.skiingConditions.windEffect = 'moderate';
    overallScore -= 1;
  } else {
    this.skiingConditions.windEffect = 'significant';
    overallScore -= 2;
  }
  
  // Visibility assessment
  const visibility = this.visibility || 10;
  if (visibility >= 5) {
    this.skiingConditions.visibility = 'excellent';
  } else if (visibility >= 2) {
    this.skiingConditions.visibility = 'good';
    overallScore -= 0.5;
  } else if (visibility >= 0.5) {
    this.skiingConditions.visibility = 'limited';
    overallScore -= 1;
  } else {
    this.skiingConditions.visibility = 'poor';
    overallScore -= 2;
  }
  
  // New snow bonus
  if (this.snowConditions.newSnow.last24h > 10) {
    overallScore += 1; // Fresh powder bonus
  }
  
  // Convert score to rating
  if (overallScore >= 4.5) this.skiingConditions.overall = 'excellent';
  else if (overallScore >= 3.5) this.skiingConditions.overall = 'very-good';
  else if (overallScore >= 2.5) this.skiingConditions.overall = 'good';
  else if (overallScore >= 1.5) this.skiingConditions.overall = 'fair';
  else this.skiingConditions.overall = 'poor';
};

weatherSchema.methods.calculateSnowmakingConditions = function() {
  const temp = this.current.temperature;
  const humidity = this.current.humidity || 50;
  
  // Wet bulb temperature approximation for snowmaking
  const wetBulb = temp - ((100 - humidity) / 5);
  
  if (wetBulb <= -3) {
    this.calculated.snowmakingConditions = 'excellent';
  } else if (wetBulb <= -1) {
    this.calculated.snowmakingConditions = 'good';
  } else if (wetBulb <= 1) {
    this.calculated.snowmakingConditions = 'marginal';
  } else {
    this.calculated.snowmakingConditions = 'poor';
  }
};

weatherSchema.methods.calculateLiftConditions = function() {
  const windSpeed = this.wind.speed || 0;
  const visibility = this.visibility || 10;
  
  if (windSpeed < 25 && visibility >= 2) {
    this.calculated.liftOperatingConditions = 'all-lifts';
  } else if (windSpeed < 35 && visibility >= 1) {
    this.calculated.liftOperatingConditions = 'most-lifts';
  } else if (windSpeed < 50 && visibility >= 0.5) {
    this.calculated.liftOperatingConditions = 'limited-lifts';
  } else {
    this.calculated.liftOperatingConditions = 'minimal-lifts';
  }
};

weatherSchema.methods.isGoodSkiingWeather = function() {
  return ['excellent', 'very-good', 'good'].includes(this.skiingConditions.overall);
};

weatherSchema.methods.hasActiveAlerts = function() {
  return this.alerts.some(alert => alert.isActive);
};

weatherSchema.methods.getWindDirection = function() {
  const degrees = this.wind.direction;
  if (!degrees) return 'N/A';
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Static methods
weatherSchema.statics.getCurrentWeather = function(resortId) {
  return this.findOne({ resort: resortId }).sort({ date: -1 });
};

weatherSchema.statics.getWeatherHistory = function(resortId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    resort: resortId,
    date: { $gte: startDate }
  }).sort({ date: -1 });
};

weatherSchema.statics.getSnowReport = function(resortId) {
  return this.findOne({ resort: resortId }, {
    'snowConditions': 1,
    'precipitation.snow': 1,
    'current.temperature': 1,
    date: 1
  }).sort({ date: -1 });
};

weatherSchema.statics.getForecast = function(resortId) {
  return this.findOne({ resort: resortId }, {
    forecast: 1,
    date: 1
  }).sort({ date: -1 });
};

module.exports = mongoose.model('Weather', weatherSchema);