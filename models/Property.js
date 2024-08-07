const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Référence à l'utilisateur
  photos: [String],
  status: { type: String, default: 'draft' }, // Ajoutez un statut par défaut
  url: String
});

module.exports = mongoose.model('Property', propertySchema);
