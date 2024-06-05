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
  <html lang="en">
  <head>
      <link rel="stylesheet" href="/css/bootstrap.min.css">
      <style>
          /* Styles CSS personnalisés */
          body {
              font-family: Arial, sans-serif;
              background-color: #f8f9fa;
              color: #333;
              margin: 0;
              padding: 0;
          }
          .container {
              max-width: 800px;
              margin: auto;
              padding: 20px;
          }
          .property-info {
              background-color: #fff;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .property-info h1 {
              font-size: 32px;
              margin-bottom: 20px;
          }
          .property-info p {
              font-size: 18px;
              margin-bottom: 10px;
          }
          @media (max-width: 768px) {
              .container {
                  padding: 10px;
              }
              .property-info h1 {
                  font-size: 28px;
              }
              .property-info p {
                  font-size: 16px;
              }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="property-info">
              <h1>Propriété à ${property.city}</h1>
              <p><strong>Nombre de pièces:</strong> ${property.rooms}</p>
              <p><strong>Surface:</strong> ${property.surface} m²</p>
              <p><strong>Prix:</strong> ${property.price} €</p>
              <p><strong>Localisation:</strong> ${property.city}, ${property.country}</p>
          </div>
      </div>
  </body>
  </html>`;

  const filePath = path.join(__dirname, '..', 'public', 'landing-pages', `${property._id}.html`);
  fs.writeFileSync(filePath, template);

  const landingPageUrl = `/landing-pages/${property._id}.html`;
  return landingPageUrl;
}

module.exports = router;
