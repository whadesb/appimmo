const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true }, // Ajouter un champ pour le username
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true },
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' }); // Spécifier l'email comme username

module.exports = mongoose.model('User', userSchema);
