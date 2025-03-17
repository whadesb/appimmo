const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
   orderId: { 
    type: String, 
    unique: true, 
    required: true, 
    default: () => `ORD-${Date.now()}`,
    set: function(value) {
      return value.startsWith('ORD-') ? value : `ORD-${value}`;
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiryDate: {  
    type: Date,
    required: true,
    default: function () {
      return new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)); // ✅ Expiration à 90 jours
    }
  }
});

module.exports = mongoose.model('Order', orderSchema);
