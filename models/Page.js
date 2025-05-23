const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  views: { type: Number, default: 0 },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Page', PageSchema);
