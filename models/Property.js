const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  photos: [String],
  status: String,
  url: String
});

module.exports = mongoose.model('Property', propertySchema);
