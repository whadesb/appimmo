const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    required: true,
  },
  // --- NOUVEAUX CHAMPS ADRESSE ---
  billingAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' }
  },
  // -------------------------------
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordCode: String,
  twoFactorSecret: { type: String },
  twoFactorEnabled: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', UserSchema);
