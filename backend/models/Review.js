const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  pros: [String],
  cons: [String],
  images: [{
    url: String,
    alt: String,
    caption: String
  }],
  purchaseVerified: {
    type: Boolean,
    default: false
  },
  recommendProduct: {
    type: Boolean,
    default: true
  },
  fitRating: {
    type: String,
    enum: ['runs-small', 'true-to-size', 'runs-large'],
    default: 'true-to-size'
  },
  qualityRating: {
    type: Number,
    min: 1,
    max: 5
  },
  valueRating: {
    type: Number,
    min: 1,
    max: 5
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isHelpful: {
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    }
  },
  helpfulVotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    vote: {
      type: String,
      enum: ['helpful', 'not-helpful']
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  moderationNote: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  flags: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'offensive', 'irrelevant']
    },
    note: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  response: {
    comment: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for helpfulness score
reviewSchema.virtual('helpfulnessScore').get(function() {
  const total = this.isHelpful.helpful + this.isHelpful.notHelpful;
  if (total === 0) return 0;
  return (this.isHelpful.helpful / total) * 100;
});

// Virtual for review age
reviewSchema.virtual('reviewAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Compound index to ensure one review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, isApproved: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });

// Pre-save middleware
reviewSchema.pre('save', function(next) {
  // Auto-approve if user has verified purchase
  if (this.purchaseVerified && this.moderationStatus === 'pending') {
    this.moderationStatus = 'approved';
    this.isApproved = true;
  }
  
  next();
});

// Method to add helpful vote
reviewSchema.methods.addHelpfulVote = function(userId, vote) {
  // Remove existing vote by this user
  this.helpfulVotes = this.helpfulVotes.filter(v => v.user.toString() !== userId.toString());
  
  // Add new vote
  this.helpfulVotes.push({
    user: userId,
    vote,
    votedAt: new Date()
  });
  
  // Update counters
  this.isHelpful.helpful = this.helpfulVotes.filter(v => v.vote === 'helpful').length;
  this.isHelpful.notHelpful = this.helpfulVotes.filter(v => v.vote === 'not-helpful').length;
  
  return this.save();
};

// Method to flag review
reviewSchema.methods.flagReview = function(userId, reason, note) {
  this.flags.push({
    user: userId,
    reason,
    note,
    flaggedAt: new Date()
  });
  
  // Auto-flag if multiple flags
  if (this.flags.length >= 3) {
    this.moderationStatus = 'flagged';
    this.isApproved = false;
  }
  
  return this.save();
};

// Method to moderate review
reviewSchema.methods.moderateReview = function(status, note, moderatorId) {
  this.moderationStatus = status;
  this.moderationNote = note;
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.isApproved = status === 'approved';
  
  return this.save();
};

// Method to add response
reviewSchema.methods.addResponse = function(comment, responderId) {
  this.response = {
    comment,
    respondedBy: responderId,
    respondedAt: new Date()
  };
  
  return this.save();
};

// Static method to get reviews for product
reviewSchema.statics.getProductReviews = function(productId, options = {}) {
  const query = { 
    product: productId, 
    isApproved: true 
  };
  
  if (options.rating) {
    query.rating = options.rating;
  }
  
  let sort = { createdAt: -1 };
  if (options.sortBy === 'helpful') {
    sort = { 'isHelpful.helpful': -1, createdAt: -1 };
  } else if (options.sortBy === 'rating-high') {
    sort = { rating: -1, createdAt: -1 };
  } else if (options.sortBy === 'rating-low') {
    sort = { rating: 1, createdAt: -1 };
  }
  
  return this.find(query)
    .populate('user', 'firstName lastName avatar')
    .sort(sort)
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

// Static method to get review statistics
reviewSchema.statics.getReviewStats = function(productId) {
  return this.aggregate([
    {
      $match: { 
        product: new mongoose.Types.ObjectId(productId),
        isApproved: true
      }
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    },
    {
      $addFields: {
        ratingBreakdown: {
          5: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          4: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          3: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          2: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          1: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 1] },
        ratingBreakdown: 1
      }
    }
  ]);
};

// Static method to get pending reviews for moderation
reviewSchema.statics.getPendingReviews = function(options = {}) {
  const query = { 
    moderationStatus: { $in: ['pending', 'flagged'] }
  };
  
  return this.find(query)
    .populate('user', 'firstName lastName email')
    .populate('product', 'name images')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

module.exports = mongoose.model('Review', reviewSchema);