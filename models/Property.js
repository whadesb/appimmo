const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
    rooms: { type: Number, required: true },
    surface: { type: Number, required: true },
    price: { type: Number, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    url: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    photos: [String], // Ajoutez ce champ pour stocker les chemins des photos
    status: { type: String, enum: ['draft', 'validated'], default: 'draft' } // Nouveau champ pour le statut
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
