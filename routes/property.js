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
// Fonction pour générer la landing page
async function generateLandingPage(property) {
  const template = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Propriété à ${property.city}, ${property.country}</title>

        <link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet">

        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: "Lora", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
                background-color: #ffffff;
                color: #3c3c3c;
                line-height: 1.5;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }

            .container {
                max-width: 1400px;
                width: 100%;
                display: flex;
                flex-direction: row;
                background-color: white;
                border-radius: 0;
                overflow: hidden;
                margin: 0 auto;
                height: 100%; /* Assure que le container occupe toute la hauteur de l'écran */
            }

            .slider {
                flex: 2;
                overflow: hidden;
                position: relative;
                width: 100%;
                height: 100%;
            }

            .slides {
                display: flex;
                position: absolute;
                width: 100%;
                height: 100%;
            }

            .slides img {
                position: absolute;
                width: 100%;
                height: 100%;
                object-fit: cover;
                opacity: 0;
                animation: slide 10s infinite;
            }

            .slides img:nth-child(1) {
                animation-delay: 0s;
            }

            .slides img:nth-child(2) {
                animation-delay: 5s;
            }

            @keyframes slide {
                0%, 50% {
                    opacity: 1;
                }
                55%, 100% {
                    opacity: 0;
                }
            }

            .property-info {
                flex: 0.8;
                padding: 40px;
                display: flex;
                flex-direction: column;
                justify-content:space-around;
                height: 100%;
            }

            .property-lorem {
                font-family: "Lora", serif;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                color: #3c3c3c;
                border-bottom: 1px solid #C4B990;
                padding-bottom: 5px;
            }

            .property-info h1 {
                font-family: "Lora", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
                line-height: 1.1;
                margin-bottom: .5rem;
                font-weight: 400;
                color: #3c3c3c;
                font-size: 2.5rem;
            }

            .property-info h2 {
                font-size: 1.6rem;
                color: #2c2c2c;
                font-weight: 300;
                margin-bottom: 30px;
            }

            .property-details {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-bottom: 20px;
            }

            .detail {
                display: flex;
                align-items: center;
            }

            .detail i {
                font-size: 1.3rem;
                color: #C4B990;
                margin-right: 8px;
            }

            .detail p {
                font-size: 1rem;
                color: #333;
            }

            .price {
                background-color: #c4b9905f;
                padding: 5px 15px;
                font-size: 1.5rem;
                font-weight: 400;
                color: #212529;
                text-align: center;
                text-transform: uppercase;
                margin-top: 30px;
                width: fit-content;
                align-self: flex-start;
            }

            .property-description {
                margin-top: 20px;
                padding: 15px;
                background-color: #f7f7f7;
                border: 1px solid #ddd;
                font-size: 1rem;
                color: #555;
                text-align: justify;
                line-height: 1.6;
            }

            .property-description .section-title {
                font-size: 1.4rem;
                font-weight: bold;
                color: #3c3c3c;
                margin-bottom: 10px;
            }

            .construction-year {
                margin-top: 20px;
                font-size: 1.2rem;
                color: #3c3c3c;
                font-weight: 300;
            }

            @media screen and (max-width: 768px) {
                .container {
                    flex-direction: column;
                }

                .property-details {
                    grid-template-columns: repeat(2, 1fr);
                }

                .property-info {
                    padding: 20px;
                }

                .property-info h1 {
                    font-size: 2.4rem;
                }

                .property-info h2 {
                    font-size: 1.4rem;
                }

                .price {
                    font-size: 1.3rem;
                    width: 100%;
                    padding: 10px;
                    text-align: center;
                }

                .property-description {
                    font-size: 0.9rem;
                }
            }

            @media screen and (min-width: 769px) {
                body {
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .container {
                    height: 80vh;
                    align-items: center;
                }
            }
        </style>
    </head>
    <body>

        <div class="container">
            <!-- Slider de la propriété -->
            <div class="slider">
                <div class="slides">
                    <img src="/uploads/${property.photos[0] || 'default.jpg'}" alt="Image 1">
                    <img src="/uploads/${property.photos[1] || 'default.jpg'}" alt="Image 2">
                </div>
            </div>

            <!-- Informations sur la propriété -->
            <div class="property-info">
                <p class="property-lorem">UAP Immo Annonce</p>

                <h1>Propriété à ${property.city}, ${property.country}</h1>
                <h2>Type de bien: ${property.propertyType}</h2>

                <!-- Détails de la propriété avec pictogrammes -->
                <div class="property-details">
                    <div class="detail">
                        <i class="fal fa-home"></i>
                        <p>Nombre de pièces: ${property.rooms}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-bed"></i>
                        <p>Nombre de chambres: ${property.bedrooms}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-ruler-combined"></i>
                        <p>Surface: ${property.surface} m²</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-shower"></i>
                        <p>Salles de douche: ${property.bathrooms || 'Non renseigné'}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-toilet"></i>
                        <p>Toilettes: ${property.toilets || 'Non renseigné'}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-arrow-up"></i>
                        <p>Ascenseur: ${property.elevator ? 'Oui' : 'Non'}</p>
                    </div>
                </div>

                <!-- Année de construction -->
                <div class="construction-year">Année de construction: ${property.yearBuilt || 'Non renseignée'}</div>

                <!-- Brève description sous les pictogrammes -->
                <div class="property-description">
                    <div class="section-title">Visite guidée</div>
                    ${property.description || 'Aucune description fournie.'}
                </div>

                <div class="price">Prix: ${property.price} €</div>
            </div>
        </div>

    </body>
    </html>`;

  const filePath = path.join(__dirname, 'public', 'landing-pages', `${property._id}.html`);
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
