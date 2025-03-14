const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    rooms: { type: Number, required: true },
    bedrooms: { type: Number, required: true },
    surface: { type: Number, required: true },
    price: { type: Number, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    description: { type: String, required: true, maxlength: 820 },
    yearBuilt: { type: Number },
    pool: { type: Boolean, default: false },
    propertyType: { type: String, required: true },
    bathrooms: { type: Number },
    toilets: { type: Number },
    elevator: { type: Boolean, default: false },
    fireplace: { type: Boolean, default: false },
    internet: { type: Boolean, default: false },
    doubleGlazing: { type: Boolean, default: false },
    wateringSystem: { type: Boolean, default: false },
    barbecue: { type: Boolean, default: false },
    carShelter: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    caretakerHouse: { type: Boolean, default: false },
    electricShutters: { type: Boolean, default: false },
    outdoorLighting: { type: Boolean, default: false },
    url: { type: String },
    views: { type: Number, default: 0 },
    photos: [{ type: String }]
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
