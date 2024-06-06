// models/Property.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  url: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Référence à l'utilisateur
});

module.exports = mongoose.model('Property', propertySchema);
