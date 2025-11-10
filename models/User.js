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
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordCode: String,
  twoFactorSecret: { type: String }, // Secret utilisé pour la 2FA (Google Authenticator)
  twoFactorEnabled: { type: Boolean, default: false } // Indique si 2FA est activé ou non
}, { timestamps: true });

// Configurer passportLocalMongoose pour utiliser l'email comme nom d'utilisateur
UserSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', UserSchema);
