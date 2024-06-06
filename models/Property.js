const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
  rooms: { type: Number, required: true },
  surface: { type: Number, required: true },
  price: { type: Number, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  url: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Nouveau champ pour l'ID de l'utilisateur
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
