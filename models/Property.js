const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PropertySchema = new Schema({
    rooms: Number,
    bathrooms: Number,
    surface: Number,
    price: Number,
    city: String,
    country: String,
    hasGarage: Boolean,
    url: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
