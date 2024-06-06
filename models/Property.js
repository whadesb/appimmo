const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
  rooms: Number,
  surface: Number,
  price: Number,
  city: String,
  country: String,
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  url: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' } // Ajout du champ createdBy
});

module.exports = mongoose.model('Property', propertySchema);
