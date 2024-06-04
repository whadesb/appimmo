const express = require('express');
const router = express.Router();
const Property = require('../models/Property'); // Assurez-vous de définir ce modèle
const fs = require('fs');
const path = require('path');

router.get('/add-property', (req, res) => {
    res.render('add-property');
});

router.post('/add-property', async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;
    const property = new Property({ rooms, surface, price, city, country });
    await property.save();
    
    // Générer la landing page
    const landingPageUrl = await generateLandingPage(property);
    
    property.url = landingPageUrl;
    await property.save();
    
    // Envoyer une réponse avec un message de confirmation et l'URL de la page générée
    res.status(200).send(`Le bien immobilier a été ajouté avec succès. Vous pouvez le voir ici : ${landingPageUrl}`);
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
    
    return `/landing-pages/${property._id}.html`;
}

router.get('/landing-pages/:id', async (req, res) => {
    const property = await Property.findById(req.params.id);
    if (property) {
        res.sendFile(path.join(__dirname, '..', 'public', 'landing-pages', `${property._id}.html`));
    } else {
        res.status(404).send('Propriété non trouvée');
    }
});

module.exports = router;
