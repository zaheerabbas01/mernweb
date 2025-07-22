const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
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
      min: 1,
      max: 10
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
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totals: {
    subtotal: {
      type: Number,
      default: 0
    },
    itemCount: {
      type: Number,
      default: 0
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for cart total
cartSchema.virtual('cartTotal').get(function() {
  return this.items.reduce((total, item) => total + item.totalPrice, 0);
});

// Index for better performance
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.totals.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
  this.totals.itemCount = this.items.reduce((total, item) => total + item.quantity, 0);
  this.lastUpdated = new Date();
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productId, color, size, quantity, unitPrice) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() && 
    item.color === color && 
    item.size === size
  );

  if (existingItemIndex > -1) {
    // Update existing item
    const existingItem = this.items[existingItemIndex];
    existingItem.quantity = Math.min(existingItem.quantity + quantity, 10); // Max 10 per item
    existingItem.totalPrice = existingItem.quantity * unitPrice;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      color,
      size,
      quantity: Math.min(quantity, 10),
      unitPrice,
      totalPrice: Math.min(quantity, 10) * unitPrice,
      addedAt: new Date()
    });
  }

  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    item.remove();
  } else {
    item.quantity = Math.min(quantity, 10);
    item.totalPrice = item.quantity * item.unitPrice;
  }

  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }

  item.remove();
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

// Method to get cart with populated products
cartSchema.methods.getPopulatedCart = function() {
  return this.populate({
    path: 'items.product',
    select: 'name images basePrice salePrice brand category isActive variants',
    match: { isActive: true }
  });
};

// Static method to get or create cart for user
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ user: userId });
  
  if (!cart) {
    cart = new this({ user: userId });
    await cart.save();
  }
  
  return cart;
};

// Static method to merge guest cart with user cart
cartSchema.statics.mergeGuestCart = async function(userId, guestCartItems) {
  const userCart = await this.getOrCreateCart(userId);
  
  for (const guestItem of guestCartItems) {
    await userCart.addItem(
      guestItem.product,
      guestItem.color,
      guestItem.size,
      guestItem.quantity,
      guestItem.unitPrice
    );
  }
  
  return userCart;
};

module.exports = mongoose.model('Cart', cartSchema);