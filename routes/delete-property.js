// routes/delete-property.js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');

router.post('/delete-property/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    await Property.findOneAndDelete({ _id: req.params.id, user: req.session.user._id });

    res.redirect('/user/properties');
  } catch (error) {
    console.error('Erreur lors de la suppression de la propriété : ', error);
    res.send('Une erreur est survenue lors de la suppression de la propriété.');
  }
});

module.exports = router;
