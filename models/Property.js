const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schéma de la propriété
const propertySchema = new Schema({
  rooms: { type: Number, required: true },
  surface: { type: Number, required: true },
  price: { type: Number, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  url: { type: String }, // Pour stocker l'URL de la page générée
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true } // Référence à l'utilisateur
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
