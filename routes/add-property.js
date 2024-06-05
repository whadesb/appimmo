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

    // Générer la page de destination
    const landingPageUrl = await generateLandingPage(property);
    console.log("Landing Page URL from add-property:", landingPageUrl); // Ajout de console.log pour vérifier l'URL générée

    // Rediriger vers une autre page ou envoyer une réponse JSON en cas de succès
    res.status(201).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la propriété : ', error);
    // En cas d'erreur, renvoyer une réponse JSON avec le statut 500 et un message d'erreur approprié
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
  }
});

async function generateLandingPage(property) {
  const template = `
  <!DOCTYPE html>
  <html>
  <head>
      <link rel="stylesheet" href="/css/bootstrap.min.css">
      <style>
          /* Ajoutez des styles CSS personnalisés ici */
      </style>
  </head>
  <body>
      <div class="container">
          <h1>Propriété à ${property.city}</h1>
          <p>Nombre de pièces: ${property.rooms}</p>
          <p>Surface: ${property.surface} m²</p>
          <p>Prix: ${property.price} €</p>
          <p>Localisation: ${property.city}, ${property.country}</p>
      </div>
  </body>
  </html>`;

  const filePath = path.join(__dirname, '..', 'public', 'landing-pages', `${property._id}.html`);
  fs.writeFileSync(filePath, template);

  const landingPageUrl = `/landing-pages/${property._id}.html`;
  console.log("Landing Page URL from generateLandingPage:", landingPageUrl); // Ajout de console.log pour vérifier l'URL générée
  return landingPageUrl;
}

module.exports = router;
