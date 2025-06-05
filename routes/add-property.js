const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const slugify = require('slugify');
const Property = require('../models/Property');
const authMiddleware = require('../middleware/auth');
const { addToSitemap, pingSearchEngines } = require('../utils/seo');
const seoKeywords = require('../utils/seoKeywords');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Génération de la landing page HTML
async function generateLandingPage(property) {
  const lang = property.language || 'fr';
  const city = property.city || '';
  const country = property.country || '';
  const slug = slugify(`${property.propertyType}-${city}-${country}`, { lower: true });
  const filename = `${property._id}-${slug}.html`;
  const filePath = path.join(__dirname, '../public/landing-pages', filename);
  const fullUrl = `https://uap.immo/landing-pages/${filename}`;

  const keywordsList = seoKeywords[lang]?.[country] || [];
  const keywords = keywordsList.sort(() => 0.5 - Math.random()).slice(0, 3);

  const GTM_ID = 'GTM-TF7HSC3N';

  const jsonLD = {
    "@context": "https://schema.org",
    "@type": "Residence",
    "name": `${property.propertyType} à vendre à ${city}`,
    "description": property.description?.slice(0, 160) || '',
    "address": {
      "@type": "PostalAddress",
      "addressLocality": city,
      "addressCountry": country
    },
    "floorSize": {
      "@type": "QuantitativeValue",
      "value": property.surface || 0,
      "unitCode": "MTR"
    },
    "numberOfRooms": property.rooms || 1,
    "price": property.price || 0,
    "priceCurrency": "EUR",
    "url": fullUrl
  };

  const template = `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="${property.description?.slice(0, 160) || ''}">
      <meta name="keywords" content="${keywords.join(', ')}">
      <title>${property.propertyType} à ${city}, ${country}</title>
      <link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet" />
      <script>
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      </script>
      <script type="application/ld+json">${JSON.stringify(jsonLD)}</script>
    </head>
    <body>
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
      <h1>${property.propertyType} à ${city}, ${country}</h1>
      <p>${property.description}</p>
      <p><i class="fal fa-ruler-combined"></i> ${property.surface} m²</p>
      ${property.rooms ? `<p><i class=\\"fal fa-home\\"></i> ${property.rooms}</p>` : ''}
      ${property.bedrooms ? `<p><i class=\\"fal fa-bed\\"></i> ${property.bedrooms}</p>` : ''}
      ${property.yearBuilt ? `<p><i class=\\"fal fa-calendar-alt\\"></i> ${property.yearBuilt}</p>` : ''}
      ${property.pool ? `<p><i class=\\"fas fa-swimming-pool\\"></i> Piscine</p>` : ''}
      ${property.wateringSystem ? `<p><i class=\\"fas fa-water\\"></i> Arrosage automatique</p>` : ''}
      ${property.carShelter ? `<p><i class=\\"fas fa-car\\"></i> Abri voiture</p>` : ''}
      ${property.parking ? `<p><i class=\\"fas fa-parking\\"></i> Parking</p>` : ''}
      ${property.caretakerHouse ? `<p><i class=\\"fas fa-house-user\\"></i> Maison de gardien</p>` : ''}
      ${property.electricShutters ? `<p><i class=\\"fas fa-window-maximize\\"></i> Stores électriques</p>` : ''}
      ${property.outdoorLighting ? `<p><i class=\\"fas fa-lightbulb\\"></i> Éclairage extérieur</p>` : ''}
      <p>Prix : ${Number(property.price).toLocaleString('fr-FR')} €</p>
      <img src="/uploads/${property.photos[0] || 'default.jpg'}" width="400">
    </body>
    </html>`;

  fs.writeFileSync(filePath, template);

  addToSitemap(fullUrl);
  pingSearchEngines('https://uap.immo/sitemap.xml');

  return `/landing-pages/${filename}`;
}

// Route POST pour ajouter une propriété
router.post('/add-property', authMiddleware, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
  try {
   const { price, surface, country, city, postalCode, propertyType, description } = req.body;

  if (!price || !surface || !country || !city || !postalCode || !propertyType || !description) {
  return res.status(400).json({ error: 'Tous les champs doivent être remplis.' });
}

if (!/^\d{5}$/.test(postalCode)) {
  return res.status(400).json({ error: 'Le code postal doit contenir exactement 5 chiffres.' });
}


    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }

    let photo1 = null, photo2 = null;

    if (req.files.photo1) {
      const p1 = `public/uploads/${Date.now()}-photo1.jpg`;
      await sharp(req.files.photo1[0].path).resize(800).jpeg({ quality: 80 }).toFile(p1);
      photo1 = path.basename(p1);
      fs.unlinkSync(req.files.photo1[0].path);
    }

    if (req.files.photo2) {
      const p2 = `public/uploads/${Date.now()}-photo2.jpg`;
      await sharp(req.files.photo2[0].path).resize(800).jpeg({ quality: 80 }).toFile(p2);
      photo2 = path.basename(p2);
      fs.unlinkSync(req.files.photo2[0].path);
    }

    const property = new Property({
      price: parseFloat(price),
      surface: parseInt(surface),
      country,
postalCode,
      city,
      propertyType,
      description,
      userId,
      photos: [photo1, photo2]
    });

    await property.save();

    const landingPageUrl = await generateLandingPage(property);
    property.url = landingPageUrl;
    await property.save();

    res.status(201).json({ message: 'Propriété ajoutée avec succès.', url: landingPageUrl });
  } catch (err) {
    console.error('Erreur add-property:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’ajout de la propriété.' });
  }
});

module.exports = router;
