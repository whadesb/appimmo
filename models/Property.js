const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const propertySchema = new Schema({
    rooms: {
        type: Number,
        required: true
    },
    surface: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    url: {
        type: String,
         required: true
         }, // Champ pour l'URL de la page de destination
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    views: { 
        type: Number, 
        default: 0 
    },
    user: { 
        type: Schema.Types.ObjectId, 
        ref: 'User' 
    } // Référence à l'utilisateur
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
