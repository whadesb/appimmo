const express = require('express');
const router = express.Router();
const Property = require('../models/Property'); // Import Property model
const { isAuthenticated } = require('../server'); // Use authentication middleware

// Edit property route
router.get('/edit-property/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (property.createdBy.equals(req.user._id)) {
      if (property.status === 'draft') {
        res.render('edit-property', { property });
      } else {
        res.status(403).send('Vous ne pouvez pas modifier une propriété validée.');
      }
    } else {
      res.status(403).send("Vous n'êtes pas autorisé à modifier cette propriété.");
    }
  } catch (error) {
    console.error('Error fetching property for editing', error);
    res.status(500).send('Une erreur est survenue lors de la récupération de la propriété.');
  }
});

// Update property route
router.post('/edit-property/:id', isAuthenticated, async (req, res) => {
  const { rooms, surface, price, city, country } = req.body;

  try {
    const property = await Property.findById(req.params.id);
    if (property.createdBy.equals(req.user._id) && property.status === 'draft') {
      property.rooms = rooms;
      property.surface = surface;
      property.price = price;
      property.city = city;
      property.country = country;

      await property.save();
      res.redirect('/user'); // Redirect to user page after editing
    } else {
      res.status(403).send('Modification non autorisée.');
    }
  } catch (error) {
    console.error('Error updating property', error);
    res.status(500).send('Une erreur est survenue lors de la mise à jour de la propriété.');
  }
});

module.exports = router;
