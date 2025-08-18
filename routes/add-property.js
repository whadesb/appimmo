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

  const translations = {
    fr: {
      propertyIn: 'à',
      price: 'Prix',
      pool: 'Piscine',
      wateringSystem: 'Arrosage automatique',
      carShelter: 'Abri voiture',
      parking: 'Parking',
      caretakerHouse: 'Maison de gardien',
      electricShutters: 'Stores électriques',
      outdoorLighting: 'Éclairage extérieur',
      visit: 'Visiter',
      yes: 'Oui',
      no: 'Non'
    },
    en: {
      propertyIn: 'in',
      price: 'Price',
      pool: 'Pool',
      wateringSystem: 'Watering system',
      carShelter: 'Car shelter',
      parking: 'Parking',
      caretakerHouse: 'Caretaker house',
      electricShutters: 'Electric shutters',
      outdoorLighting: 'Outdoor lighting',
      visit: 'Visit',
      yes: 'Yes',
      no: 'No'
    },
    es: {
      propertyIn: 'en',
      price: 'Precio',
      pool: 'Piscina',
      wateringSystem: 'Sistema de riego',
      carShelter: 'Cochera',
      parking: 'Estacionamiento',
      caretakerHouse: 'Casa del guardián',
      electricShutters: 'Persianas eléctricas',
      outdoorLighting: 'Iluminación exterior',
      visit: 'Visitar',
      yes: 'Sí',
      no: 'No'
    },
    pt: {
      propertyIn: 'em',
      price: 'Preço',
      pool: 'Piscina',
      wateringSystem: 'Sistema de irrigação',
      carShelter: 'Abrigo para carro',
      parking: 'Estacionamento',
      caretakerHouse: 'Casa do zelador',
      electricShutters: 'Persianas elétricas',
      outdoorLighting: 'Iluminação externa',
      visit: 'Visitar',
      yes: 'Sim',
      no: 'Não'
    }
  };

  const t = translations[lang] || translations.fr;
  const slug = slugify(`${property.propertyType}-${city}-${country}`, { lower: true });
  const filename = `${property._id}-${slug}.html`;
  const filePath = path.join(__dirname, '../public/landing-pages', filename);
  const fullUrl = `https://uap.immo/landing-pages/${filename}`;

  const keywordsList = seoKeywords[lang]?.[country] || [];
  const keywords = keywordsList.sort(() => 0.5 - Math.random()).slice(0, 3);

  const getEmbedUrl = url => {
    const match = url?.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([^&?/]+)/);
    if (match && match[1]) {
      const id = match[1];
      return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&mute=1&controls=0&showinfo=0`;
    }
    return '';
  };
  const embedUrl = getEmbedUrl(property.videoUrl);

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
      <style>
        .video-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: -1;
        }
        .video-background iframe {
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .video-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: -1;
        }
      </style>
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
      ${embedUrl ? `
      <div class="video-background">
        <iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>
      <div class="video-overlay"></div>
      ` : ''}
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
      <h1>${property.propertyType} ${t.propertyIn} ${city}, ${country}</h1>
      <p>${property.description}</p>
      <p><i class="fal fa-ruler-combined"></i> ${property.surface} m²</p>
      ${property.rooms ? `<p><i class=\\"fal fa-home\\"></i> ${property.rooms}</p>` : ''}
      ${property.bedrooms ? `<p><i class=\\"fal fa-bed\\"></i> ${property.bedrooms}</p>` : ''}
      ${property.yearBuilt ? `<p><i class=\\"fal fa-calendar-alt\\"></i> ${property.yearBuilt}</p>` : ''}
      ${property.pool ? `<p><i class=\\"fas fa-swimming-pool\\"></i> ${t.pool}</p>` : ''}
      ${property.wateringSystem ? `<p><i class=\\"fas fa-water\\"></i> ${t.wateringSystem}</p>` : ''}
      ${property.carShelter ? `<p><i class=\\"fas fa-car\\"></i> ${t.carShelter}</p>` : ''}
      <p><i class=\\"fas fa-parking\\"></i> ${t.parking}: ${property.parking ? t.yes : t.no}</p>
      ${property.caretakerHouse ? `<p><i class=\\"fas fa-house-user\\"></i> ${t.caretakerHouse}</p>` : ''}
      ${property.electricShutters ? `<p><i class=\\"fas fa-window-maximize\\"></i> ${t.electricShutters}</p>` : ''}
      ${property.outdoorLighting ? `<p><i class=\\"fas fa-lightbulb\\"></i> ${t.outdoorLighting}</p>` : ''}
      <div style="display:flex;align-items:center;gap:10px;">
        <p style="margin:0;">${t.price} : ${Number(property.price).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €</p>
        <button id="visitBtn">${t.visit}</button>
      </div>
      <script>
        document.getElementById('visitBtn').addEventListener('click', function() {
          alert('${property.contactFirstName || ''} ${property.contactLastName || ''} - ${property.contactPhone || ''}');
        });
      </script>
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
   const { price, surface, country, city, postalCode, propertyType, description, language, videoUrl } = req.body;

  if (!price || !surface || !country || !city || !postalCode || !propertyType || !description || !language) {
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
      contactFirstName: req.body.contactFirstName,
      contactLastName: req.body.contactLastName,
      contactPhone: req.body.contactPhone,
      language: req.body.language || 'fr',
      userId,
      videoUrl,
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
