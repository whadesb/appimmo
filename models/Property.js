const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the property schema with validation and indexing
const propertySchema = new Schema({
  rooms: {
    type: Number,
    required: true,
    min: [1, 'Le nombre de pièces doit être au moins 1.'],
  },
  surface: {
    type: Number,
    required: true,
    min: [1, 'La surface doit être positive.'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Le prix ne peut pas être négatif.'],
  },
  city: {
    type: String,
    required: [true, 'La ville est requise.'],
  },
  country: {
    type: String,
    required: [true, 'Le pays est requis.'],
  },
  photos: {
    type: [String],
    validate: {
      validator: function (v) {
        return v.length <= 2; // Limite de deux photos
      },
      message: (props) => `Vous ne pouvez pas télécharger plus de deux photos.`,
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Le créateur est requis.'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  url: {
    type: String,
    required: [true, 'L’URL est requise.'],
    validate: {
      validator: function (v) {
        return v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://');
      },
      message: (props) => `${props.value} n'est pas une URL valide.`,
    },
  },
});

// Add index for createdBy to improve query performance
propertySchema.index({ createdBy: 1 });

// Create the Property model using the schema
const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
