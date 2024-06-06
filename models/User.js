const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
  rooms: { type: Number, required: true },
  surface: { type: Number, required: true },
  price: { type: Number, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } // Référence vers le modèle User
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
