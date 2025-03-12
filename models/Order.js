const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  pageUrl: {
    type: String,
    required: false
  },
  orderNumber: {
    type: String, // Numéro unique généré
    unique: true,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Fonction pour générer un numéro de commande unique
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000); // Numéro aléatoire à 4 chiffres

    this.orderNumber = `CMD-${datePart}-${randomPart}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
