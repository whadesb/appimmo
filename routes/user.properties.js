// routes/user-properties.js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const authMiddleware = require('../middleware/auth'); // Importer le middleware d'authentification

router.get('/user-properties', authMiddleware, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.session.user._id });
    res.status(200).json(properties);
  } catch (error) {
    console.error('Erreur lors de la récupération des propriétés : ', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des propriétés.' });
  }
});

module.exports = router;
