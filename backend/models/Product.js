const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'men-shirts', 'men-pants', 'men-jackets', 'men-shoes', 'men-accessories',
      'women-dresses', 'women-tops', 'women-bottoms', 'women-jackets', 'women-shoes', 'women-accessories',
      'kids-boys', 'kids-girls', 'kids-shoes', 'kids-accessories',
      'unisex'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'kids', 'unisex'],
    required: true
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative'],
    validate: {
      validator: function(value) {
        return !value || value < this.basePrice;
      },
      message: 'Sale price must be less than base price'
    }
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    color: String // Which color variant this image represents
  }],
  variants: [{
    color: {
      type: String,
      required: true
    },
    colorCode: String, // Hex code for the color
    sizes: [{
      size: {
        type: String,
        required: true,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42', '6', '7', '8', '9', '10', '11', '12']
      },
      stock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative'],
        default: 0
      },
      priceAdjustment: {
        type: Number,
        default: 0
      }
    }]
  }],
  materials: [String],
  careInstructions: [String],
  features: [String],
  tags: [String],
  sku: {
    type: String,
    unique: true,
    required: true
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'lbs', 'g', 'oz'],
      default: 'kg'
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: Date,
  viewCount: {
    type: Number,
    default: 0
  },
  salesCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for current price (sale price if available, otherwise base price)
productSchema.virtual('currentPrice').get(function() {
  return this.salePrice || this.basePrice;
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (!this.salePrice) return 0;
  return Math.round(((this.basePrice - this.salePrice) / this.basePrice) * 100);
});

// Virtual for total stock across all variants
productSchema.virtual('totalStock').get(function() {
  return this.variants.reduce((total, variant) => {
    return total + variant.sizes.reduce((sizeTotal, size) => sizeTotal + size.stock, 0);
  }, 0);
});

// Virtual for availability status
productSchema.virtual('isAvailable').get(function() {
  return this.isActive && this.totalStock > 0;
});

// Virtual for primary image
productSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary || this.images[0];
});

// Indexes for better performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, gender: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isActive: 1, isAvailable: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });

// Pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
    
    // Add timestamp to ensure uniqueness
    if (this.isNew) {
      this.slug += '-' + Date.now();
    }
  }
  
  // Ensure only one primary image
  const primaryImages = this.images.filter(img => img.isPrimary);
  if (primaryImages.length > 1) {
    this.images.forEach((img, index) => {
      img.isPrimary = index === 0;
    });
  } else if (primaryImages.length === 0 && this.images.length > 0) {
    this.images[0].isPrimary = true;
  }
  
  next();
});

// Method to get available sizes for a specific color
productSchema.methods.getAvailableSizes = function(color) {
  const variant = this.variants.find(v => v.color.toLowerCase() === color.toLowerCase());
  if (!variant) return [];
  
  return variant.sizes
    .filter(size => size.stock > 0)
    .map(size => ({
      size: size.size,
      stock: size.stock,
      price: this.currentPrice + (size.priceAdjustment || 0)
    }));
};

// Method to get stock for specific color and size
productSchema.methods.getStock = function(color, size) {
  const variant = this.variants.find(v => v.color.toLowerCase() === color.toLowerCase());
  if (!variant) return 0;
  
  const sizeInfo = variant.sizes.find(s => s.size === size);
  return sizeInfo ? sizeInfo.stock : 0;
};

// Method to update stock
productSchema.methods.updateStock = function(color, size, quantity) {
  const variant = this.variants.find(v => v.color.toLowerCase() === color.toLowerCase());
  if (!variant) throw new Error('Color variant not found');
  
  const sizeInfo = variant.sizes.find(s => s.size === size);
  if (!sizeInfo) throw new Error('Size not found');
  
  if (sizeInfo.stock + quantity < 0) {
    throw new Error('Insufficient stock');
  }
  
  sizeInfo.stock += quantity;
  return this.save();
};

// Method to add review and update rating
productSchema.methods.addReview = function(reviewId, rating) {
  this.reviews.push(reviewId);
  
  // Recalculate average rating
  const totalRating = (this.rating.average * this.rating.count) + rating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  
  return this.save();
};

// Method to remove review and update rating
productSchema.methods.removeReview = function(reviewId, rating) {
  this.reviews.pull(reviewId);
  
  // Recalculate average rating
  if (this.rating.count > 1) {
    const totalRating = (this.rating.average * this.rating.count) - rating;
    this.rating.count -= 1;
    this.rating.average = totalRating / this.rating.count;
  } else {
    this.rating.count = 0;
    this.rating.average = 0;
  }
  
  return this.save();
};

// Method to increment view count
productSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Static method to get featured products
productSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ isFeatured: true, isActive: true })
    .limit(limit)
    .sort({ createdAt: -1 });
};

// Static method to get new arrivals
productSchema.statics.getNewArrivals = function(limit = 10) {
  return this.find({ isNew: true, isActive: true })
    .limit(limit)
    .sort({ createdAt: -1 });
};

// Static method to get products by category
productSchema.statics.getByCategory = function(category, options = {}) {
  const query = { category, isActive: true };
  
  if (options.gender) query.gender = options.gender;
  if (options.brand) query.brand = options.brand;
  if (options.minPrice || options.maxPrice) {
    query.basePrice = {};
    if (options.minPrice) query.basePrice.$gte = options.minPrice;
    if (options.maxPrice) query.basePrice.$lte = options.maxPrice;
  }
  
  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

module.exports = mongoose.model('Product', productSchema);