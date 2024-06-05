const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');

router.post('/add-property', async (req, res) => {
  // Récupérer les données du formulaire depuis req.body
  const { rooms, surface, price, city, country } = req.body;

  try {
    // Créer une nouvelle propriété dans la base de données
    const property = new Property({
      rooms,
      surface,
      price,
      city,
      country
    });

    // Sauvegarder la propriété dans la base de données
    await property.save();

    // Rediriger vers une autre page ou envoyer une réponse JSON en cas de succès
    res.status(201).json({ message: 'Le bien immobilier a été ajouté avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la propriété : ', error);
    // En cas d'erreur, renvoyer une réponse JSON avec le statut 500 et un message d'erreur approprié
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
  }
});

module.exports = router;
