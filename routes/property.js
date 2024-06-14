const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');


router.post('/add-property', async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;

    try {
        
        const property = new Property({ rooms, surface, price, city, country, user: req.user._id });

        
        await property.save();

        
        const landingPageUrl = await generateLandingPage(property);

        
        property.url = landingPageUrl;

        
        await property.save();

        
        res.status(200).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
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
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Propriété à ${property.city}</title>
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
      <style>
          body, html {
              margin: 0;
              padding: 0;
              height: 100%;
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              background: rgba(0, 0, 0, 0.8); /* Fond noir avec opacité */
              font-family: Arial, sans-serif;
          }
          .property-container {
              background-color: white;
              border-radius: 10px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); /* Ombre plus prononcée */
              max-width: 800px;
              width: 100%;
              padding: 20px;
              text-align: center;
              color: black; /* Texte noir */
          }
          .property-title {
              font-size: 32px;
              margin-bottom: 20px;
              color: black; /* Texte noir */
          }
          .property-details {
              font-size: 18px;
              margin-bottom: 20px;
              color: black; /* Texte noir */
          }
          .property-photos {
              display: flex;
              justify-content: space-around;
              gap: 10px;
          }
          .property-photos img {
              width: 48%;
              border-radius: 8px;
          }
          @media (max-width: 768px) {
              .property-container {
                  padding: 10px;
              }
              .property-title {
                  font-size: 24px;
              }
              .property-details {
                  font-size: 16px;
              }
              .property-photos {
                  flex-direction: column;
                  align-items: center;
              }
              .property-photos img {
                  width: 100%;
                  margin-bottom: 10px;
              }
          }
      </style>
  </head>
  <body>
      <div class="property-container">
          <h1 class="property-title">Propriété à ${property.city}</h1>
          <div class="property-details">
              <p><strong>Nombre de pièces:</strong> ${property.rooms}</p>
              <p><strong>Surface:</strong> ${property.surface} m²</p>
              <p><strong>Prix:</strong> ${property.price} €</p>
              <p><strong>Localisation:</strong> ${property.city}, ${property.country}</p>
          </div>
          <div class="property-photos">
              <img src="/uploads/${property.photos[0]}" alt="Photo 1">
              <img src="/uploads/${property.photos[1]}" alt="Photo 2">
          </div>
      </div>
  </body>
  </html>`;
    const filePath = path.join(__dirname, '..', 'public', 'landing-pages', `${property._id}.html`);
    fs.writeFileSync(filePath, template);

    return `/landing-pages/${property._id}.html`;
}


router.get('/payment', async (req, res) => {
    const { propertyId } = req.query;

    try {
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).send('Property not found');
        }

        res.render('payment', {
            propertyId: property._id,
            rooms: property.rooms,
            surface: property.surface,
            price: property.price,
            city: property.city,
            country: property.country,
            url: property.url
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de la propriété.' });
    }
});

module.exports = router;
