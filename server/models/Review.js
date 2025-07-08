// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  resort: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resort',
    required: [true, 'Resort reference is required']
  },
  
  // Overall Rating
  rating: {
    type: Number,
    required: [true, 'Overall rating is required'],
    min: [1, 'Rating must be between 1 and 5'],
    max: [5, 'Rating must be between 1 and 5']
  },
  
  // Detailed Category Ratings
  categories: {
    snowQuality: {
      type: Number,
      min: [1, 'Snow quality rating must be between 1 and 5'],
      max: [5, 'Snow quality rating must be between 1 and 5']
    },
    terrainVariety: {
      type: Number,
      min: [1, 'Terrain variety rating must be between 1 and 5'],
      max: [5, 'Terrain variety rating must be between 1 and 5']
    },
    liftEfficiency: {
      type: Number,
      min: [1, 'Lift efficiency rating must be between 1 and 5'],
      max: [5, 'Lift efficiency rating must be between 1 and 5']
    },
    facilities: {
      type: Number,
      min: [1, 'Facilities rating must be between 1 and 5'],
      max: [5, 'Facilities rating must be between 1 and 5']
    },
    valueForMoney: {
      type: Number,
      min: [1, 'Value for money rating must be between 1 and 5'],
      max: [5, 'Value for money rating must be between 1 and 5']
    },
    skiSchool: {
      type: Number,
      min: [1, 'Ski school rating must be between 1 and 5'],
      max: [5, 'Ski school rating must be between 1 and 5']
    },
    dining: {
      type: Number,
      min: [1, 'Dining rating must be between 1 and 5'],
      max: [5, 'Dining rating must be between 1 and 5']
    },
    atmosphere: {
      type: Number,
      min: [1, 'Atmosphere rating must be between 1 and 5'],
      max: [5, 'Atmosphere rating must be between 1 and 5']
    },
    accessibility: {
      type: Number,
      min: [1, 'Accessibility rating must be between 1 and 5'],
      max: [5, 'Accessibility rating must be between 1 and 5']
    }
  },
  
  // Review Content
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [100, 'Review title cannot exceed 100 characters']
  },
  content: {
    type: String,
    required: [true, 'Review content is required'],
    trim: true,
    minlength: [10, 'Review content must be at least 10 characters'],
    maxlength: [2000, 'Review content cannot exceed 2000 characters']
  },
  
  // Visit Information
  visitDate: {
    type: Date,
    required: [true, 'Visit date is required'],
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Visit date cannot be in the future'
    }
  },
  visitDuration: {
    type: Number, // days
    min: [1, 'Visit duration must be at least 1 day'],
    max: [365, 'Visit duration cannot exceed 365 days']
  },
  visitSeason: {
    type: String,
    enum: ['early-season', 'peak-season', 'late-season', 'spring-skiing'],
    required: true
  },
  
  // Reviewer Information
  skiLevel: {
    type: String,
    enum: ['never-ever', 'beginner', 'intermediate', 'advanced', 'expert'],
    required: [true, 'Ski level is required']
  },
  snowboardLevel: {
    type: String,
    enum: ['never-tried', 'beginner', 'intermediate', 'advanced', 'expert']
  },
  groupType: {
    type: String,
    enum: ['solo', 'couple', 'family-young-kids', 'family-teens', 'friends', 'business', 'ski-club'],
    required: [true, 'Group type is required']
  },
  groupSize: {
    type: Number,
    min: [1, 'Group size must be at least 1'],
    max: [50, 'Group size cannot exceed 50']
  },
  
  // Trip Details
  tripType: {
    type: String,
    enum: ['day-trip', 'weekend', 'week-long', 'extended-stay'],
    required: true
  },
  accommodationType: {
    type: String,
    enum: ['hotel', 'condo', 'lodge', 'hostel', 'camping', 'day-visitor', 'other']
  },
  transportationMethod: {
    type: String,
    enum: ['car', 'bus', 'train', 'plane', 'shuttle', 'other']
  },
  
  // Weather During Visit
  weatherDuringVisit: {
    overall: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor']
    },
    snowConditions: {
      type: String,
      enum: ['powder', 'packed-powder', 'granular', 'icy', 'wet', 'spring-conditions']
    },
    newSnowfall: {
      type: String,
      enum: ['heavy', 'moderate', 'light', 'none']
    },
    visibility: {
      type: String,
      enum: ['excellent', 'good', 'limited', 'poor']
    },
    temperature: {
      type: String,
      enum: ['very-cold', 'cold', 'comfortable', 'warm', 'too-warm']
    }
  },
  
  // Specific Experiences
  favoriteTrails: [{
    name: String,
    reason: String
  }],
  favoriteLifts: [{
    name: String,
    reason: String
  }],
  wouldRecommendFor: [{
    type: String,
    enum: ['beginners', 'families', 'experts', 'powder-seekers', 'terrain-park', 'scenic-views', 'night-skiing', 'value-seekers']
  }],
  
  // Pros and Cons
  pros: [{
    type: String,
    maxlength: [200, 'Pro cannot exceed 200 characters']
  }],
  cons: [{
    type: String,
    maxlength: [200, 'Con cannot exceed 200 characters']
  }],
  
  // Tips and Advice
  tips: [{
    category: {
      type: String,
      enum: ['parking', 'tickets', 'dining', 'accommodation', 'transportation', 'equipment', 'weather', 'crowds', 'general']
    },
    tip: {
      type: String,
      maxlength: [300, 'Tip cannot exceed 300 characters']
    }
  }],
  
  // Return Intent
  wouldReturn: {
    type: String,
    enum: ['definitely', 'probably', 'maybe', 'probably-not', 'definitely-not'],
    required: true
  },
  wouldRecommend: {
    type: String,
    enum: ['highly-recommend', 'recommend', 'neutral', 'would-not-recommend', 'strongly-against'],
    required: true
  },
  
  // Helpfulness Voting
  helpfulVotes: {
    type: Number,
    default: 0,
    min: [0, 'Helpful votes cannot be negative']
  },
  unhelpfulVotes: {
    type: Number,
    default: 0,
    min: [0, 'Unhelpful votes cannot be negative']
  },
  totalVotes: {
    type: Number,
    default: 0,
    min: [0, 'Total votes cannot be negative']
  },
  helpfulnessRatio: {
    type: Number,
    default: 0,
    min: [0, 'Helpfulness ratio must be between 0 and 1'],
    max: [1, 'Helpfulness ratio must be between 0 and 1']
  },
  
  // Verification
  isVerifiedVisit: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: ['lift-ticket', 'booking-confirmation', 'photo-evidence', 'none']
  },
  
  // Moderation
  isApproved: {
    type: Boolean,
    default: true
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReasons: [{
    type: String,
    enum: ['inappropriate-content', 'spam', 'fake-review', 'offensive-language', 'off-topic', 'other']
  }],
  moderatorNotes: {
    type: String,
    maxlength: [500, 'Moderator notes cannot exceed 500 characters']
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  
  // Language and Location
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'ja', 'fr', 'de', 'es', 'it', 'ko', 'zh']
  },
  reviewerLocation: {
    country: String,
    region: String // for understanding reviewer perspective
  },
  
  // Photos (optional)
  photos: [{
    url: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    caption: String,
    category: {
      type: String,
      enum: ['trails', 'lifts', 'village', 'food', 'accommodation', 'scenery', 'weather', 'equipment']
    },
    isApproved: {
      type: Boolean,
      default: true
    }
  }],
  
  // Response from Resort (optional)
  resortResponse: {
    content: String,
    respondedBy: String, // resort representative name
    respondedAt: Date,
    isOfficial: {
      type: Boolean,
      default: false
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
  },
  publishedAt: Date
});

// Indexes for better performance
reviewSchema.index({ resort: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ isApproved: 1, publishedAt: -1 });
reviewSchema.index({ helpfulnessRatio: -1 });
reviewSchema.index({ visitDate: -1 });

// Compound indexes
reviewSchema.index({ resort: 1, rating: -1 });
reviewSchema.index({ resort: 1, isApproved: 1, publishedAt: -1 });
reviewSchema.index({ resort: 1, skiLevel: 1 });
reviewSchema.index({ resort: 1, visitSeason: 1 });

// Pre-save middleware
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate helpfulness ratio
  if (this.totalVotes > 0) {
    this.helpfulnessRatio = this.helpfulVotes / this.totalVotes;
  }
  
  // Set published date when approved
  if (this.isApproved && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  
  // Calculate total votes
  this.totalVotes = this.helpfulVotes + this.unhelpfulVotes;
  
  next();
});

// Post-save middleware to update resort average rating
reviewSchema.post('save', async function(doc) {
  try {
    await this.constructor.updateResortRating(doc.resort);
  } catch (error) {
    console.error('Error updating resort rating:', error);
  }
});

// Post-remove middleware to update resort average rating
reviewSchema.post('remove', async function(doc) {
  try {
    await this.constructor.updateResortRating(doc.resort);
  } catch (error) {
    console.error('Error updating resort rating:', error);
  }
});

// Instance methods
reviewSchema.methods.isHelpful = function() {
  return this.helpfulnessRatio >= 0.6 && this.totalVotes >= 3;
};

reviewSchema.methods.getExperienceLevel = function() {
  const levels = ['never-ever', 'beginner', 'intermediate', 'advanced', 'expert'];
  return levels.indexOf(this.skiLevel) + 1;
};

reviewSchema.methods.getCategoryAverage = function() {
  const categories = this.categories;
  const validRatings = Object.values(categories).filter(rating => rating && rating > 0);
  
  if (validRatings.length === 0) return null;
  
  return validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length;
};

reviewSchema.methods.addHelpfulVote = function() {
  this.helpfulVotes += 1;
  this.totalVotes += 1;
  this.helpfulnessRatio = this.helpfulVotes / this.totalVotes;
  return this.save();
};

reviewSchema.methods.addUnhelpfulVote = function() {
  this.unhelpfulVotes += 1;
  this.totalVotes += 1;
  this.helpfulnessRatio = this.helpfulVotes / this.totalVotes;
  return this.save();
};

reviewSchema.methods.flag = function(reason) {
  this.isFlagged = true;
  if (reason && !this.flagReasons.includes(reason)) {
    this.flagReasons.push(reason);
  }
  return this.save();
};

// Static methods
reviewSchema.statics.findByResort = function(resortId, options = {}) {
  const query = { resort: resortId, isApproved: true };
  
  if (options.minRating) query.rating = { $gte: options.minRating };
  if (options.skiLevel) query.skiLevel = options.skiLevel;
  if (options.visitSeason) query.visitSeason = options.visitSeason;
  if (options.groupType) query.groupType = options.groupType;
  
  return this.find(query)
    .populate('user', 'firstName lastName')
    .sort({ publishedAt: -1 });
};

reviewSchema.statics.getRecentReviews = function(resortId, limit = 10) {
  return this.find({ resort: resortId, isApproved: true })
    .populate('user', 'firstName lastName')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

reviewSchema.statics.getTopReviews = function(resortId, limit = 5) {
  return this.find({ 
    resort: resortId, 
    isApproved: true,
    totalVotes: { $gte: 3 }
  })
    .populate('user', 'firstName lastName')
    .sort({ helpfulnessRatio: -1, totalVotes: -1 })
    .limit(limit);
};

reviewSchema.statics.getResortStats = function(resortId) {
  return this.aggregate([
    { $match: { resort: mongoose.Types.ObjectId(resortId), isApproved: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        },
        averageCategories: {
          $avg: {
            snowQuality: '$categories.snowQuality',
            terrainVariety: '$categories.terrainVariety',
            liftEfficiency: '$categories.liftEfficiency',
            facilities: '$categories.facilities',
            valueForMoney: '$categories.valueForMoney',
            skiSchool: '$categories.skiSchool',
            dining: '$categories.dining',
            atmosphere: '$categories.atmosphere',
            accessibility: '$categories.accessibility'
          }
        }
      }
    }
  ]);
};

reviewSchema.statics.getRatingDistribution = function(resortId) {
  return this.aggregate([
    { $match: { resort: mongoose.Types.ObjectId(resortId), isApproved: true } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);
};

reviewSchema.statics.updateResortRating = async function(resortId) {
  const Resort = mongoose.model('Resort');
  
  const stats = await this.getResortStats(resortId);
  
  if (stats.length > 0) {
    const { averageRating, totalReviews, averageCategories } = stats[0];
    
    await Resort.findByIdAndUpdate(resortId, {
      'averageRating.overall': Math.round(averageRating * 10) / 10,
      'averageRating.totalReviews': totalReviews,
      'averageRating.categoryRatings': averageCategories
    });
  }
};

reviewSchema.statics.findSimilarReviewers = function(userId, resortId) {
  return this.find({
    resort: resortId,
    user: { $ne: userId },
    isApproved: true
  })
    .populate('user', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(5);
};

reviewSchema.statics.getMonthlyReviewCounts = function(resortId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);
  
  return this.aggregate([
    {
      $match: {
        resort: mongoose.Types.ObjectId(resortId),
        isApproved: true,
        publishedAt: { $gte: startDate, $lt: endDate }
      }
    },
    {
      $group: {
        _id: { $month: '$publishedAt' },
        count: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('Review', reviewSchema);