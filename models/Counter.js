const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: String,      // Identifiant du compteur (ex: "orderId")
    seq: Number       // Valeur actuelle du compteur
});

module.exports = mongoose.model('Counter', counterSchema);
