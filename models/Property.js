const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Définition du schéma PropertySchema
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

// Utilisez PropertySchema pour créer le modèle
const Property = mongoose.model('Property', PropertySchema);

module.exports = Property;
