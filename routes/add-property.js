const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

// Configuration de multer pour la gestion des fichiers uploadés
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Fonction pour générer la landing page
async function generateLandingPage(property) {
    const template = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${property.city} - Propriété à vendre</title>
    </head>
    <body>
        <h1>${property.city}</h1>
        <p>${property.rooms} Chambres</p>
        <p>${property.bathrooms} Salles de bain</p>
        <p>${property.surface} m²</p>
        <p>${property.price} €</p>
        <img src="/uploads/${property.photos[0]}" alt="Photo 1">
        <img src="/uploads/${property.photos[1]}" alt="Photo 2">
    </body>
    </html>
    `;
    const filePath = path.join(__dirname, '..', 'public', 'landing-pages', `${property._id}.html`);
    fs.writeFileSync(filePath, template);

    return `/landing-pages/${property._id}.html`;
}

// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, bathrooms, surface, price, city, country, hasGarage } = req.body;

    let photo1 = null;
    let photo2 = null;

    // Gestion des fichiers photo
    if (req.files.photo1) {
        const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
        await sharp(req.files.photo1[0].path)
            .resize(800)
            .jpeg({ quality: 80 })
            .toFile(photo1Path);
        photo1 = path.basename(photo1Path);
        fs.unlinkSync(req.files.photo1[0].path);
    }

    if (req.files.photo2) {
        const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
        await sharp(req.files.photo2[0].path)
            .resize(800)
            .jpeg({ quality: 80 })
            .toFile(photo2Path);
        photo2 = path.basename(photo2Path);
        fs.unlinkSync(req.files.photo2[0].path);
    }

    try {
        const property = new Property({
            rooms,
            bathrooms,
            surface,
            price,
            city,
            country,
            hasGarage: hasGarage === 'on',  // Capture de l'information garage
            createdBy: req.user._id,
            photos: [photo1, photo2]
        });

        // Sauvegarde de la propriété dans la base de données
        await property.save();

        // Génération de la landing page
        const landingPageUrl = await generateLandingPage(property);

        property.url = landingPageUrl;
        await property.save();

        // Réponse JSON
        res.status(201).json({ message: 'Propriété ajoutée avec succès.', url: landingPageUrl });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la propriété : ', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la propriété.' });
    }
});

module.exports = router;
