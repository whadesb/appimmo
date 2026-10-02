const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const Property = require('../models/Property');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { generateLandingPage } = require('../lib/landing');

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



function cleanupUploadedFiles(files) {
  if (!files) return;
  Object.values(files).forEach(fileArray => {
    fileArray.forEach(file => {
      if (file?.path) {
        fs.unlink(file.path, err => {
          if (err && err.code !== 'ENOENT') {
            console.error('Erreur lors de la suppression du fichier uploadé :', err);
          }
        });
      }
    });
  });
}

function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 },
    { name: 'extraPhotos', maxCount: 8 },
    { name: 'miniPhotos', maxCount: 3 }
]), async (req, res) => {
    const {
        rooms,
        bedrooms,
        surface,
        price,
        city,
        postalCode,
        country,
        yearBuilt,
        propertyType,
        dpe,
        description,
        contactFirstName,
        contactLastName,
        contactPhone
    } = req.body;
    const rawVideoUrl = (req.body.videoUrl || '').trim();
    const hasVideo = rawVideoUrl.length > 0;
    const postalCodePattern = /^\d{5}$/;
    const allowedLanguages = ['fr', 'en', 'es', 'pt'];

    if (typeof req.body.parking === 'undefined') {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ error: 'Le champ parking est requis.' });
    }

    if (!postalCodePattern.test(postalCode || '')) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ error: 'Le code postal doit contenir exactement 5 chiffres.' });
    }

    const language = allowedLanguages.includes(req.body.language) ? req.body.language : 'fr';

    if (!hasVideo && (!req.files.photo1?.[0] || !req.files.photo2?.[0])) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ error: 'Deux photos sont requises lorsque aucun lien vidéo n’est fourni.' });
    }

    let photo1 = null;
    let photo2 = null;
    let extraPhotos = [];
    let miniPhotos = [];

    if (req.files.photo1?.[0]) {
        const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
        await sharp(req.files.photo1[0].path)
            .resize(800)
            .jpeg({ quality: 80 })
            .toFile(photo1Path);
        photo1 = path.basename(photo1Path);
        fs.unlinkSync(req.files.photo1[0].path);
    }

    if (req.files.photo2?.[0]) {
        const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
        await sharp(req.files.photo2[0].path)
            .resize(800)
            .jpeg({ quality: 80 })
            .toFile(photo2Path);
        photo2 = path.basename(photo2Path);
        fs.unlinkSync(req.files.photo2[0].path);
    }

    if (req.files.extraPhotos) {
        for (const [index, file] of req.files.extraPhotos.slice(0,8).entries()) {
            const extraPath = `public/uploads/${Date.now()}-extra-${index}.jpg`;
            await sharp(file.path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(extraPath);
            extraPhotos.push(path.basename(extraPath));
            fs.unlinkSync(file.path);
        }
    }

    if (req.files.miniPhotos) {
        for (const [index, file] of req.files.miniPhotos.slice(0,3).entries()) {
            const miniPath = `public/uploads/${Date.now()}-mini-${index}.jpg`;
            await sharp(file.path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(miniPath);
            miniPhotos.push(path.basename(miniPath));
            fs.unlinkSync(file.path);
        }
    }

    try {
        const property = new Property({
            rooms: Number(rooms),
            bedrooms: Number(bedrooms),
            surface: Number(surface),
            price: parseFloat(price),
            city,
            postalCode,
            country,
            yearBuilt: yearBuilt || null,
            propertyType,
            dpe: dpe || 'En cours',
            description: description || '',
            contactFirstName,
            contactLastName,
            contactPhone,
            pool: req.body.pool === 'true',
            doubleGlazing: req.body.doubleGlazing === 'true',
            wateringSystem: req.body.wateringSystem === 'true',
            barbecue: req.body.barbecue === 'true',
            carShelter: req.body.carShelter === 'true',
            parking: req.body.parking === 'true',
            caretakerHouse: req.body.caretakerHouse === 'true',
            electricShutters: req.body.electricShutters === 'true',
            outdoorLighting: req.body.outdoorLighting === 'true',
            language,
            userId: req.user._id,
            videoUrl: rawVideoUrl,
                        theme: ['foret','marine','terre','pierre','bordeaux','encre'].includes(req.body.theme) ? req.body.theme : 'foret',
            layout: req.body.layout === 'video' ? 'video' : 'photo',
            photos: [photo1, photo2, ...extraPhotos, ...miniPhotos].filter(Boolean)
        });

        await property.save();

                const { url: landingPageUrl } = await generateLandingPage(property);
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
    { name: 'photo2', maxCount: 1 },
    { name: 'extraPhotos', maxCount: 8 },
    { name: 'miniPhotos', maxCount: 3 }
]), async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property || !property.userId.equals(req.user._id)) {
            return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
        }

        if (typeof req.body.parking === 'undefined') {
            cleanupUploadedFiles(req.files);
            return res.status(400).json({ error: 'Le champ parking est requis.' });
        }

        const {
            rooms,
            bedrooms,
            surface,
            price,
            city,
            postalCode,
            country,
            yearBuilt,
            propertyType,
            dpe,
            description,
            contactFirstName,
            contactLastName,
            contactPhone
        } = req.body;

        const rawVideoUrl = (req.body.videoUrl || '').trim();
        const hasVideo = rawVideoUrl.length > 0;
        const postalCodePattern = /^\d{5}$/;
        const allowedLanguages = ['fr', 'en', 'es', 'pt'];

        if (!postalCodePattern.test(postalCode || '')) {
            cleanupUploadedFiles(req.files);
            return res.status(400).json({ error: 'Le code postal doit contenir exactement 5 chiffres.' });
        }

        property.rooms = Number(rooms);
        property.bedrooms = Number(bedrooms);
        property.surface = Number(surface);
        property.price = parseFloat(price);
        property.city = city;
        property.postalCode = postalCode;
        property.country = country;
        property.yearBuilt = yearBuilt || null;
        property.propertyType = propertyType;
        property.dpe = dpe || 'En cours';
        property.description = description;
        property.contactFirstName = contactFirstName;
        property.contactLastName = contactLastName;
        property.contactPhone = contactPhone;
        property.language = allowedLanguages.includes(req.body.language) ? req.body.language : property.language;
        property.videoUrl = rawVideoUrl;
const allowedThemes = ['foret', 'marine', 'terre', 'pierre', 'bordeaux', 'encre'];
property.theme = allowedThemes.includes(req.body.theme) ? req.body.theme : (property.theme || 'foret');
property.layout = req.body.layout === 'video' ? 'video' : 'photo';
        property.pool = req.body.pool === 'true';
        property.doubleGlazing = req.body.doubleGlazing === 'true';
        property.wateringSystem = req.body.wateringSystem === 'true';
        property.barbecue = req.body.barbecue === 'true';
        property.carShelter = req.body.carShelter === 'true';
        property.parking = req.body.parking === 'true';
        property.caretakerHouse = req.body.caretakerHouse === 'true';
        property.electricShutters = req.body.electricShutters === 'true';
        property.outdoorLighting = req.body.outdoorLighting === 'true';

        if (!Array.isArray(property.photos)) {
            property.photos = [];
        }

        let mainPhotos = property.photos.slice(0, 2);
        let extraPhotos = property.photos.slice(2, 10);
        let miniPhotos = property.photos.slice(10, 13);

        if (req.files.photo1?.[0]) {
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            mainPhotos[0] = path.basename(photo1Path);
            fs.unlinkSync(req.files.photo1[0].path);
        }

        if (req.files.photo2?.[0]) {
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            mainPhotos[1] = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path);
        }

        if (req.files.extraPhotos) {
            extraPhotos = [];
            for (const [index, file] of req.files.extraPhotos.slice(0, 8).entries()) {
                const extraPath = `public/uploads/${Date.now()}-extra-${index}.jpg`;
                await sharp(file.path)
                    .resize(800)
                    .jpeg({ quality: 80 })
                    .toFile(extraPath);
                extraPhotos.push(path.basename(extraPath));
                fs.unlinkSync(file.path);
            }
        }

        if (req.files.miniPhotos) {
            miniPhotos = [];
            for (const [index, file] of req.files.miniPhotos.slice(0, 3).entries()) {
                const miniPath = `public/uploads/${Date.now()}-mini-${index}.jpg`;
                await sharp(file.path)
                    .resize(800)
                    .jpeg({ quality: 80 })
                    .toFile(miniPath);
                miniPhotos.push(path.basename(miniPath));
                fs.unlinkSync(file.path);
            }
        }

        const combinedPhotos = [...mainPhotos, ...extraPhotos, ...miniPhotos].filter(Boolean);

        if (!hasVideo && combinedPhotos.slice(0, 2).length < 2) {
            cleanupUploadedFiles(req.files);
            return res.status(400).json({ error: 'Deux photos sont requises lorsque aucun lien vidéo n’est fourni.' });
        }

        property.photos = combinedPhotos;

        await property.save();

        // Régénérer la landing page après la mise à jour
               // Régénérer la landing page après la mise à jour
        const { url: landingPageUrl } = await generateLandingPage(property);
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
// Route pour récupérer les landing pages de l'utilisateur connecté
router.get('/user/landing-pages', async (req, res) => {
    try {
        console.log("Requête reçue : /property/user/landing-pages");
        console.log("Utilisateur connecté :", req.user ? req.user._id : "Non connecté");

        if (!req.user) {
            return res.status(401).json({ error: "Non autorisé" });
        }

                const landingPages = await Property.find({ userId: req.user._id });

        console.log("Landing Pages trouvées :", landingPages);
        res.json(landingPages);
    } catch (error) {
        console.error("Erreur lors du chargement des landing pages :", error);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});


module.exports = router;
