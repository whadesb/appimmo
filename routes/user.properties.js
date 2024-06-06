// routes/user-properties.js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');

router.get('/user/properties', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const properties = await Property.find({ user: req.session.user._id });

    res.render('user-properties', { user: req.session.user, properties });
  } catch (error) {
    console.error('Erreur lors de la récupération des propriétés de l\'utilisateur : ', error);
    res.send('Une erreur est survenue lors de la récupération des propriétés.');
  }
});

module.exports = router;
