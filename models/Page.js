const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Page', PageSchema);
