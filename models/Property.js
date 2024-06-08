const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  url: String,
  createdAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0 },
  user: { type: Schema.Types.ObjectId, ref: 'User' } // Référence à l'utilisateur
});

module.exports = mongoose.model('Property', propertySchema);
