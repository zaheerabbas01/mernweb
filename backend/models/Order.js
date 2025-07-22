const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    image: String,
    color: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  shippingAddress: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    phone: String
  },
  billingAddress: {
    firstName: String,
    lastName: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    phone: String,
    sameAsShipping: {
      type: Boolean,
      default: true
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'paypal', 'credit_card', 'debit_card'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentIntentId: String, // For Stripe
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup'],
      default: 'standard'
    },
    carrier: String,
    trackingNumber: String,
    estimatedDelivery: Date,
    shippedAt: Date,
    deliveredAt: Date
  },
  notes: {
    customer: String,
    internal: String
  },
  coupon: {
    code: String,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    appliedDiscount: Number
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  emailNotifications: {
    orderConfirmation: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    shipped: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    delivered: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    }
  },
  returnRequest: {
    requested: { type: Boolean, default: false },
    requestedAt: Date,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed']
    },
    processedAt: Date,
    refundAmount: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order age in days
orderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for full shipping address
orderSchema.virtual('fullShippingAddress').get(function() {
  const addr = this.shippingAddress;
  return `${addr.firstName} ${addr.lastName}, ${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Indexes for better performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Find the highest order number for today
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const todayOrders = await this.constructor.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const sequence = String(todayOrders + 1).padStart(4, '0');
    this.orderNumber = `ORD${year}${month}${day}${sequence}`;
  }
  
  // Add status history entry if status changed
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: `Status changed to ${this.status}`
    });
  }
  
  // Set billing address same as shipping if not provided
  if (this.billingAddress.sameAsShipping || !this.billingAddress.street) {
    this.billingAddress = {
      ...this.shippingAddress,
      sameAsShipping: true
    };
  }
  
  next();
});

// Method to calculate total
orderSchema.methods.calculateTotal = function() {
  this.pricing.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
  this.pricing.total = this.pricing.subtotal + this.pricing.shipping + this.pricing.tax - this.pricing.discount;
  return this.pricing.total;
};

// Method to add status history
orderSchema.methods.addStatusHistory = function(status, note, updatedBy) {
  this.statusHistory.push({
    status,
    note,
    updatedBy,
    timestamp: new Date()
  });
  this.status = status;
  return this.save();
};

// Method to update shipping info
orderSchema.methods.updateShipping = function(shippingInfo) {
  Object.assign(this.shipping, shippingInfo);
  
  if (shippingInfo.trackingNumber && this.status === 'processing') {
    this.status = 'shipped';
    this.shipping.shippedAt = new Date();
    this.addStatusHistory('shipped', 'Order shipped with tracking number', null);
  }
  
  return this.save();
};

// Method to process payment
orderSchema.methods.processPayment = function(paymentInfo) {
  this.payment.status = 'completed';
  this.payment.transactionId = paymentInfo.transactionId;
  this.payment.paymentIntentId = paymentInfo.paymentIntentId;
  this.payment.paidAt = new Date();
  
  if (this.status === 'pending') {
    this.status = 'confirmed';
    this.addStatusHistory('confirmed', 'Payment processed successfully', null);
  }
  
  return this.save();
};

// Method to cancel order
orderSchema.methods.cancelOrder = function(reason, cancelledBy) {
  if (['shipped', 'delivered'].includes(this.status)) {
    throw new Error('Cannot cancel order that has been shipped or delivered');
  }
  
  this.status = 'cancelled';
  this.addStatusHistory('cancelled', reason || 'Order cancelled', cancelledBy);
  
  return this.save();
};

// Method to request return
orderSchema.methods.requestReturn = function(reason) {
  if (this.status !== 'delivered') {
    throw new Error('Can only return delivered orders');
  }
  
  // Check if within return window (e.g., 30 days)
  const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  if (Date.now() - this.deliveredAt > returnWindow) {
    throw new Error('Return window has expired');
  }
  
  this.returnRequest = {
    requested: true,
    requestedAt: new Date(),
    reason,
    status: 'pending'
  };
  
  return this.save();
};

// Static method to get orders by user
orderSchema.statics.getByUser = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .populate('items.product', 'name images slug');
};

// Static method to get orders by date range
orderSchema.statics.getByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name images slug');
};

// Static method to get sales statistics
orderSchema.statics.getSalesStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        'payment.status': 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);