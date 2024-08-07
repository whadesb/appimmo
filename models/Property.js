const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new mongoose.Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  photos: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assurez-vous que createdBy est défini correctement
  createdAt: { type: Date, default: Date.now },
  url: String,
});


const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
