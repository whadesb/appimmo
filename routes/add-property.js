// routes/add-property.js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');

router.post('/add-property', async (req, res) => {
  const { rooms, surface, price, city, country } = req.body;

  try {
    // Vérifiez si l'utilisateur est connecté
    if (!req.session.user) {
      return res.status(401).send('Vous devez être connecté pour ajouter une propriété.');
    }

    const property = new Property({
      rooms,
      surface,
      price,
      city,
      country,
      user: req.session.user._id // Associez l'utilisateur à la propriété
    });

    await property.save();

    const landingPageUrl = await generateLandingPage(property);
    console.log("Landing Page URL from add-property:", landingPageUrl);

    // Ajoutez l'URL de la page de destination à la propriété et sauvegardez
    property.url = landingPageUrl;
    await property.save();

    res.status(201).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la propriété : ', error);
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
        body {
            font-family: Arial, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            max-width: 800px;
            padding: 20px;
            text-align: center;
            background-color: #fff;
            border-radius: 10px;
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
