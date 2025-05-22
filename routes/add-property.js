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

async function generateLandingPage(property) {
    const GTM_ID = 'GTM-TF7HSC3N'; 

    const template = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Propriété à ${property.city}, ${property.country}</title>
        <link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet">
         <!-- Google Tag Manager -->
        <script>
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        </script>
        <!-- Fin Google Tag Manager -->
    </head>
    <body>
<!-- Google Tag Manager (noscript) -->
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" 
          height="0" width="0" style="display:none;visibility:hidden"></iframe>
        </noscript>
        <!-- Fin Google Tag Manager (noscript) -->
        <h1>${property.propertyType} à ${property.city}, ${property.country}</h1>
        <p>${property.description}</p>
        <p>Surface : ${property.surface} m²</p>
        <p>Prix : ${Number(property.price).toLocaleString('fr-FR')} €</p>
        <img src="/uploads/${property.photos[0] || 'default.jpg'}" width="400">
    </body>
    </html>`;

    const filePath = path.join(__dirname, '../public/landing-pages', `${property._id}.html`);
    fs.writeFileSync(filePath, template);

    return `/landing-pages/${property._id}.html`;
}

// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    console.log("Requête reçue avec les données suivantes:", req.body);

    // Extraction des champs du formulaire
    const { price, surface, country, city, propertyType, description } = req.body;

    // Validation des champs obligatoires
    if (!price || !surface || !country || !city || !propertyType || !description) {
        return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis." });
    }

    let photo1 = null;
    let photo2 = null;

    try {
        // Gestion des images uploadées
        if (req.files.photo1) {
            console.log("Traitement de la photo1...");
            const photo1Path = `public/uploads/${Date.now()}-photo1.jpg`;
            await sharp(req.files.photo1[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo1Path);
            photo1 = path.basename(photo1Path);
            fs.unlinkSync(req.files.photo1[0].path);
            console.log("Photo1 traitée et enregistrée.");
        }

        if (req.files.photo2) {
            console.log("Traitement de la photo2...");
            const photo2Path = `public/uploads/${Date.now()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            photo2 = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path);
            console.log("Photo2 traitée et enregistrée.");
        }
const userId = req.user?._id;
if (!userId) {
  console.warn("⚠️ Alerte : req.user._id est manquant !");
  return res.status(400).json({ error: "Utilisateur non identifié, veuillez vous reconnecter." });
}
        // Création de la propriété
       const property = new Property({
  price: parseFloat(price),
  surface: parseInt(surface),
  country,
  city,
  propertyType,
  description,
  userId: req.user._id || req.user.id || (req.user._doc && req.user._doc._id),
  photos: [photo1, photo2]
});

        await property.save();
        console.log("Propriété enregistrée avec succès.");

        // Génération de la landing page
        const landingPageUrl = await generateLandingPage(property);
        property.url = landingPageUrl;
        await property.save();

        console.log("Landing page générée :", landingPageUrl);

        res.status(201).json({ message: 'Propriété ajoutée avec succès.', url: landingPageUrl });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la propriété : ', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la propriété.' });
    }
});

module.exports = router;
