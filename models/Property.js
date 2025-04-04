const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Fonction utilitaire pour mettre la première lettre en majuscule
function capitalizeFirstLetter(str) {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Hook mongoose pour transformer city et country avant sauvegarde
propertySchema.pre('save', function (next) {
  if (this.city) {
    this.city = capitalizeFirstLetter(this.city.trim());
  }
  if (this.country) {
    this.country = capitalizeFirstLetter(this.country.trim());
  }
  next();
});


const propertySchema = new Schema({
    rooms: { type: Number, required: true },
createdAt: { type: Date, default: Date.now },
    bedrooms: { type: Number, required: true },
    surface: { type: Number, required: true },
    price: { type: Number, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    description: { type: String, required: true, maxlength: 820 }, // Description ajoutée
    yearBuilt: { type: Number, required: false },
    pool: { type: Boolean, default: false },
    propertyType: { type: String, required: true },
    wateringSystem: { type: Boolean, default: false },
    carShelter: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    caretakerHouse: { type: Boolean, default: false },
    electricShutters: { type: Boolean, default: false },
    outdoorLighting: { type: Boolean, default: false },
    url: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    photos: [String],
url: { type: String, required: false }
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
