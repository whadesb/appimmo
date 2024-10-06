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
        <title>${property.title || "Propriété à vendre"}</title>
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
                background: rgba(0, 0, 0, 0.6);
                font-family: Arial, sans-serif;
            }
            .property-container {
                background-color: white;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                max-width: 800px;
                width: 100%;
                padding: 20px;
                text-align: center;
                color: black;
            }
            .property-title {
                font-size: 32px;
                margin-bottom: 20px;
                color: black;
            }
            .property-details {
                font-size: 18px;
                margin-bottom: 20px;
                color: black;
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
            <h1 class="property-title">${property.city}</h1>
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

// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;

    let photo1 = null;
    let photo2 = null;

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
            surface,
            price,
            city,
            country,
            createdBy: req.user._id,
            photos: [photo1, photo2]
        });

        await property.save();

        const landingPageUrl = await generateLandingPage(property);

        property.url = landingPageUrl;
        await property.save();

        res.status(201).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
    }
});

// Route pour mettre à jour une propriété existante
router.post('/update-property/:id', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property || !property.createdBy.equals(req.user._id)) {
            return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
        }

        const { rooms, surface, price, city, country } = req.body;

        property.rooms = rooms;
        property.surface = surface;
        property.price = price;
        property.city = city;
        property.country = country;

        if (req.files.photo1) {
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            property.photos[0] = path.basename(photo1Path);
            fs.unlinkSync(req.files.photo1[0].path);
        }

        if (req.files.photo2) {
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            property.photos[1] = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path);
        }

        await property.save();

        // Régénérer la landing page après la mise à jour
        const landingPageUrl = await generateLandingPage(property);
        property.url = landingPageUrl;
        await property.save();

        res.redirect('/user');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de la mise à jour de la propriété.' });
    }
});

// Route pour afficher la page de paiement
router.get('/payment', async (req, res) => {
    const { propertyId } = req.query;

    try {
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).send('Propriété non trouvée');
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
        console.error('Erreur lors de la récupération de la propriété :', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de la propriété.' });
    }
});

module.exports = router;
