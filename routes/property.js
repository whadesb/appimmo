const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration de multer pour le traitement des fichiers uploadés
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Route POST pour ajouter une propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, surface, price, city, country, isPublished } = req.body;

    try {
        // Créez un nouvel objet Property avec les données fournies
        const property = new Property({ 
            rooms, 
            surface, 
            price, 
            city, 
            country, 
            createdBy: req.user._id, // Utilisation de l'utilisateur actuel
            isPublished: isPublished === 'true' // Convertir la valeur de la chaîne en booléen
        });

        // Gérer les fichiers photo
        if (req.files.photo1) {
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            property.photos.push(path.basename(photo1Path));
            fs.unlinkSync(req.files.photo1[0].path);
        }

        if (req.files.photo2) {
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            property.photos.push(path.basename(photo2Path));
            fs.unlinkSync(req.files.photo2[0].path);
        }

        // Sauvegardez la propriété dans la base de données
        await property.save();

        // Générez la page de destination
        const landingPageUrl = await generateLandingPage(property);

        // Mettez à jour l'URL de la propriété et sauvegardez-la
        property.url = landingPageUrl;
        await property.save();

        res.status(200).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
    }
});

router.get('/edit/:id', authMiddleware, async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property || !property.createdBy.equals(req.user._id)) {
            return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
        }

        res.render('edit-property', { property });
    } catch (error) {
        console.error('Erreur lors de la récupération de la propriété pour modification:', error);
        res.status(500).send('Erreur lors de la récupération de la propriété.');
    }
});

// Route POST pour mettre à jour une propriété existante
router.post('/edit/:id', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, surface, price, city, country, isPublished } = req.body;

    try {
        const property = await Property.findById(req.params.id);

        // Vérifiez si la propriété appartient à l'utilisateur actuel
        if (!property || !property.createdBy.equals(req.user._id)) {
            return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
        }

        // Mettre à jour les champs de la propriété
        property.rooms = rooms;
        property.surface = surface;
        property.price = price;
        property.city = city;
        property.country = country;
        property.isPublished = isPublished === 'true';

        // Mise à jour des photos si de nouvelles photos sont téléchargées
        if (req.files.photo1) {
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            if (property.photos[0]) fs.unlinkSync(`public/uploads/${property.photos[0]}`);
            property.photos[0] = path.basename(photo1Path);
            fs.unlinkSync(req.files.photo1[0].path);
        }

        if (req.files.photo2) {
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            if (property.photos[1]) fs.unlinkSync(`public/uploads/${property.photos[1]}`);
            property.photos[1] = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path);
        }

        // Sauvegarder les modifications dans la base de données
        await property.save();

        // Regénérer la page HTML pour la propriété
        await generateLandingPage(property);

        res.redirect('/user'); // Rediriger l'utilisateur vers sa page d'espace utilisateur
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la propriété:', error);
        res.status(500).send('Une erreur est survenue lors de la mise à jour de la propriété.');
    }
});

// Fonction pour générer la page de destination
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

module.exports = router;
