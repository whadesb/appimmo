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

// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    // Log pour vérifier les données reçues du formulaire
    console.log("Received body data:", req.body);
    console.log("Received files:", req.files);

    const { rooms, surface, price, city, country } = req.body;

    let photo1 = null;
    let photo2 = null;

    try {
        // Gestion de la première photo
        if (req.files.photo1) {
            console.log("Processing photo1...");
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            photo1 = path.basename(photo1Path);
            fs.unlinkSync(req.files.photo1[0].path); // Supprime le fichier original
            console.log("photo1 processed successfully.");
        }

        // Gestion de la deuxième photo
        if (req.files.photo2) {
            console.log("Processing photo2...");
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            photo2 = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path); // Supprime le fichier original
            console.log("photo2 processed successfully.");
        }

        // Log avant de sauvegarder la propriété
        console.log("Saving property...");
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

        // Log pour indiquer que la propriété a été enregistrée avec succès
        console.log("Property saved successfully. Generating landing page...");

        const landingPageUrl = await generateLandingPage(property);

        property.url = landingPageUrl;
        await property.save();

        console.log("Landing page generated successfully:", landingPageUrl);
        
        res.status(201).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
    } catch (error) {
        // Log d'erreur en cas d'échec
        console.error('Erreur lors de l\'ajout de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
    }
});

module.exports = router;
