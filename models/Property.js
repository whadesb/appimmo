const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
    rooms: { type: Number, required: true },
    bedrooms: { type: Number, required: true },
    surface: { type: Number, required: true },
    price: { type: Number, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    yearBuilt: { type: Number, required: false },
    pool: { type: Boolean, default: false },
    propertyType: { type: String, required: true },
    bathrooms: { type: Number, required: false }, // Salles de douche
    toilets: { type: Number, required: false }, // Toilettes
    elevator: { type: Boolean, default: false }, // Ascenseur
    fireplace: { type: Boolean, default: false }, // Cheminée
    internet: { type: Boolean, default: false }, // Internet
    doubleGlazing: { type: Boolean, default: false }, // Double vitrage
    wateringSystem: { type: Boolean, default: false }, // Arrosage
    barbecue: { type: Boolean, default: false }, // Barbecue
    carShelter: { type: Boolean, default: false }, // Abri de voiture
    parking: { type: Boolean, default: false }, // Parking
    caretakerHouse: { type: Boolean, default: false }, // Maison de gardien
    electricShutters: { type: Boolean, default: false }, // Stores électriques
    outdoorLighting: { type: Boolean, default: false }, // Éclairage extérieur
    url: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    photos: [String]
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
