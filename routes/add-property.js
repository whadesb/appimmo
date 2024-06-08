const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

router.post('/add-property', async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;

    // Récupérer l'ID de l'utilisateur à partir de la session ou de toute autre source
    const userId = req.user.id; // Exemple : si vous stockez l'ID de l'utilisateur dans la session

    try {
        // Créer une nouvelle propriété dans la base de données
        const property = new Property({
            user: userId, // Ajouter l'ID de l'utilisateur
            rooms,
            surface,
            price,
            city,
            country,
            url: '' // Initialisez l'URL avec une chaîne vide ou une valeur par défaut
        });

        await property.save();

        // Générer la page de destination
        const landingPageUrl = await generateLandingPage(property);

        // Mettre à jour l'URL de la propriété et sauvegarder de nouveau
        property.url = landingPageUrl;
        await property.save();

        // Rediriger vers une autre page ou envoyer une réponse JSON en cas de succès
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Propriété à ${property.city}</title>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            /* Styles CSS personnalisés */
            body {
                font-family: Arial, sans-serif;
                background-color: #f8f9fa;
                color: #333;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center; /* Centrer horizontalement */
                align-items: center; /* Centrer verticalement */
                height: 100vh; /* 100% de la hauteur de l'écran */
            }
            .container {
                max-width: 800px;
                padding: 20px;
                text-align: center; /* Centrer le contenu */
                background-color: #fff; /* Couleur de fond du contenu */
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

    return `/landing-pages/${property._id}.html`;
}

module.exports = router;
