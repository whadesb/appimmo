const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Fonction utilitaire pour mettre la première lettre en majuscule
function capitalizeFirstLetter(str) {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ✅ D'abord tu déclares ton schema
const propertySchema = new Schema({
  rooms: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  bedrooms: { type: Number, required: true },
  surface: { type: Number, required: true },
  price: { type: Number, required: true },
  city: { type: String, required: true },
postalCode: {
  type: String,
  required: true
},
  country: { type: String, required: true },
  description: { type: String, required: true, maxlength: 820 },
  yearBuilt: { type: Number },
  pool: { type: Boolean, default: false },
  propertyType: { type: String, required: true },
  wateringSystem: { type: Boolean, default: false },
  carShelter: { type: Boolean, default: false },
  parking: { type: Boolean, default: false },
  caretakerHouse: { type: Boolean, default: false },
  electricShutters: { type: Boolean, default: false },
  outdoorLighting: { type: Boolean, default: false },
  contactFirstName: { type: String },
  contactLastName: { type: String },
  contactPhone: { type: String },
  language: { type: String, enum: ['fr', 'en', 'es', 'pt'], default: 'fr' },
  dpe: {
  type: String,
  enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'En cours'],
  default: 'En cours'
},
  url: { type: String },
  views: { type: Number, default: 0 },
  userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true
},
  photos: [String]
});

// ✅ Ensuite tu ajoutes le hook .pre
propertySchema.pre('save', function (next) {
  if (this.city) this.city = capitalizeFirstLetter(this.city.trim());
  if (this.country) this.country = capitalizeFirstLetter(this.country.trim());
  if (this.propertyType) this.propertyType = capitalizeFirstLetter(this.propertyType.trim());
  next();
});

// ✅ Puis tu exportes
const Property = mongoose.model('Property', propertySchema);
module.exports = Property;
