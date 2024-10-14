const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
    rooms: { type: Number, required: true },
    bedrooms: { type: Number, required: true },
    surface: { type: Number, required: true },
    price: { type: Number, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    yearBuilt: { type: Number, required: false }, // Année de construction
    pool: { type: Boolean, default: false }, // Piscine
    propertyType: { type: String, required: true }, // Type de bien
    url: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    photos: [String]
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
