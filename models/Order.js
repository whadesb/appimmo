const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true, // ✅ Assure la génération automatique d'un ObjectId
  },
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
    type: String, // ✅ Modifier en String
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

// ✅ Fonction pour générer un numéro de commande unique
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `CMD-${datePart}-${randomPart}`;
  }

  console.log("✅ Order Number generated before saving:", this.orderNumber); // Log pour vérifier
  next();
});


module.exports = mongoose.model('Order', orderSchema);
