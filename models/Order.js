const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
 orderId: {
  type: String,
  unique: true,
  required: true,
  default: () => `ORD-${Date.now()}`
},
  paypalOrderId: {
    type: String,
    unique: true,
    sparse: true
  },
  paypalCaptureId: {           
    type: String,
    index: true,
    sparse: true
  },
  btcPayInvoiceId: {
    type: String,
    unique: true,
    sparse: true
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
 currency: {             
    type: String,
    default: 'EUR'
  },
   paidAt: {                  
    type: Date
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
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
});



module.exports = mongoose.model('Order', orderSchema);


