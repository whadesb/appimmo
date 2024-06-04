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
    views: { type: Number, default: 0 }
});

module.exports = mongoose.model('Property', propertySchema);
