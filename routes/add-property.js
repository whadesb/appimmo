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

// Génération de la landing page HTML
async function generateLandingPage(property) {
  const lang = property.language || 'fr';
  const city = property.city || '';
  const country = property.country || '';

  const translations = {
    fr: {
      propertyIn: 'à',
      price: 'Prix',
      addInfo: 'Informations complémentaires',
      keyInfo: 'Informations clés',
      features: 'Équipements',
      contact: 'Contact',
      miniGallery: 'Mini galerie',
      notProvided: 'Non renseigné',
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
      addInfo: 'Additional information',
      keyInfo: 'Key information',
      features: 'Amenities',
      contact: 'Contact',
      miniGallery: 'Mini gallery',
      notProvided: 'Not provided',
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
      addInfo: 'Información adicional',
      keyInfo: 'Información clave',
      features: 'Servicios',
      contact: 'Contacto',
      miniGallery: 'Mini galería',
      notProvided: 'No especificado',
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
      addInfo: 'Informações adicionais',
      keyInfo: 'Informações chave',
      features: 'Comodidades',
      contact: 'Contato',
      miniGallery: 'Mini galeria',
      notProvided: 'Não fornecido',
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

  const formattedPrice = Number(property.price || 0).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
  const miniPhotos = Array.isArray(property.photos) ? property.photos.slice(10, 13).filter(Boolean) : [];
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
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background-color: ${embedUrl ? '#000' : '#ffffff'};
          color: ${embedUrl ? '#ffffff' : '#000000'};
        }
        body.has-video {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
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
        .video-hero {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 20px;
        }
        .video-card {
          background: rgba(0, 0, 0, 0.55);
          padding: 40px 30px;
          border-radius: 20px;
          max-width: 820px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .video-card h1 {
          font-size: 2.4rem;
          margin: 0;
        }
        .video-card p {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.6;
        }
        .video-details {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 18px;
        }
        .video-detail {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.1rem;
        }
        .video-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }
        .video-price {
          font-size: 1.8rem;
          font-weight: 600;
        }
        .video-actions .visit-btn {
      background: none;
      border: none;
      border-radius: 999px;
      color: #ffffff;
      padding: 14px 32px;
      cursor: pointer;
      font-size: 1.4rem;
      transition: opacity 0.2s ease;
    }
        .visit-btn:hover {
          opacity: 0.85;
        }
        .page-content {
          position: relative;
          z-index: 1;
          padding: 40px 20px;
          max-width: 960px;
          margin: 0 auto;
        }
        .page-content h1 {
          font-size: 2rem;
        }
        .page-content p {
          font-size: 1.1rem;
          line-height: 1.6;
        }
        .page-content .info-row {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin: 20px 0;
        }
        .page-content .info-row p {
          margin: 0;
          font-size: 1rem;
        }
        .extra-info-desktop,
        .extra-info-desktop-3 {
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 40px auto;
          padding: 30px 25px;
          border-radius: 20px;
          background: rgba(255,255,255,0.95);
          color: #3c3c3c;
        }
        .has-video .extra-info-desktop,
        .has-video .extra-info-desktop-3 {
          background: rgba(255,255,255,0.92);
        }
        .extra-info-desktop hr,
        .extra-info-desktop-3 hr {
          border: none;
          border-top: 1px solid #ddd;
          margin-bottom: 25px;
        }
        .extra-info-desktop h2,
        .extra-info-desktop-3 h2 {
          font-size: 1.6rem;
          margin-bottom: 20px;
          font-weight: 500;
          color: inherit;
        }
        .extra-columns {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          gap: 30px;
        }
        .extra-col {
          flex: 1;
          padding: 0 20px;
          position: relative;
        }
        .extra-col:not(:last-child)::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 1px;
          height: 100%;
          background-color: #ddd;
        }
        .info-label {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .info-item {
          font-size: 1rem;
          margin: 6px 0;
        }
        .mini-photos.extra-columns {
          gap: 20px;
        }
        .mini-photo-col {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mini-photo-col img {
          width: 100%;
          border-radius: 16px;
          object-fit: cover;
          max-height: 220px;
        }
        .mini-photos .extra-col:not(:last-child)::after {
          display: none;
        }
        @media (max-width: 768px) {
          .video-card {
            padding: 30px 20px;
          }
          .video-card h1 {
            font-size: 1.8rem;
          }
          .video-price {
            font-size: 1.4rem;
          }
          .extra-info-desktop,
          .extra-info-desktop-3 {
            margin: 20px 16px;
            padding: 20px 18px;
          }
          .extra-columns {
            flex-direction: column;
            gap: 20px;
          }
          .extra-col {
            padding: 0;
          }
          .extra-col:not(:last-child)::after {
            display: none;
          }
          .mini-photo-col img {
            max-height: none;
          }
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
    <body class="${embedUrl ? 'has-video' : ''}">
      ${embedUrl ? `
      <div class="video-background">
        <iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>
      <div class="video-overlay"></div>
      ` : ''}
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
      ${embedUrl ? `
        <div class="video-hero">
          <div class="video-card">
            <h1>${property.propertyType} ${t.propertyIn} ${city}, ${country}</h1>
            ${property.description ? `<p>${property.description}</p>` : ''}
            <div class="video-details">
              <div class="video-detail"><i class="fal fa-ruler-combined"></i> ${property.surface} m²</div>
              ${property.rooms ? `<div class="video-detail"><i class="fal fa-home"></i> ${property.rooms}</div>` : ''}
              ${property.bedrooms ? `<div class="video-detail"><i class="fal fa-bed"></i> ${property.bedrooms}</div>` : ''}
              ${property.yearBuilt ? `<div class="video-detail"><i class="fal fa-calendar-alt"></i> ${property.yearBuilt}</div>` : ''}
            </div>
            <div class="video-actions">
              <span class="video-price">${formattedPrice} €</span>
              <button id="visitBtn" class="visit-btn">${t.visit}</button>
            </div>
          </div>
        </div>
      ` : `
        <div class="page-content">
          <h1>${property.propertyType} ${t.propertyIn} ${city}, ${country}</h1>
          ${property.description ? `<p>${property.description}</p>` : ''}
          <div class="info-row">
            <p><i class="fal fa-ruler-combined"></i> ${property.surface} m²</p>
            ${property.rooms ? `<p><i class="fal fa-home"></i> ${property.rooms}</p>` : ''}
            ${property.bedrooms ? `<p><i class="fal fa-bed"></i> ${property.bedrooms}</p>` : ''}
            ${property.yearBuilt ? `<p><i class="fal fa-calendar-alt"></i> ${property.yearBuilt}</p>` : ''}
            ${property.pool ? `<p><i class="fas fa-swimming-pool"></i> ${t.pool}</p>` : ''}
            ${property.wateringSystem ? `<p><i class="fas fa-water"></i> ${t.wateringSystem}</p>` : ''}
            ${property.carShelter ? `<p><i class="fas fa-car"></i> ${t.carShelter}</p>` : ''}
            <p><i class="fas fa-parking"></i> ${t.parking}: ${property.parking ? t.yes : t.no}</p>
            ${property.caretakerHouse ? `<p><i class="fas fa-house-user"></i> ${t.caretakerHouse}</p>` : ''}
            ${property.electricShutters ? `<p><i class="fas fa-window-maximize"></i> ${t.electricShutters}</p>` : ''}
            ${property.outdoorLighting ? `<p><i class="fas fa-lightbulb"></i> ${t.outdoorLighting}</p>` : ''}
          </div>
          <div class="video-actions" style="justify-content:flex-start;">
            <span class="video-price" style="color:#000;">${formattedPrice} €</span>
            <button id="visitBtn" class="visit-btn">${t.visit}</button>
          </div>
          ${property.photos?.[0] ? `<div style="margin-top:30px;"><img src="/uploads/${property.photos[0]}" alt="${property.propertyType}" style="max-width:100%;border-radius:12px;"></div>` : ''}
        </div>
      `}
      <div class="extra-info-desktop">
        <hr />
        <h2>${t.addInfo}</h2>
        <div class="extra-columns">
          <div class="extra-col">
            <div class="info-label">${t.keyInfo}</div>
            <div class="info-item">${t.price} : ${formattedPrice} €</div>
            <div class="info-item"><i class="fal fa-ruler-combined"></i> ${property.surface} m²</div>
            ${property.rooms ? `<div class="info-item"><i class="fal fa-home"></i> ${property.rooms}</div>` : ''}
            ${property.bedrooms ? `<div class="info-item"><i class="fal fa-bed"></i> ${property.bedrooms}</div>` : ''}
            <div class="info-item"><i class="fal fa-calendar-alt"></i> ${property.yearBuilt || t.notProvided}</div>
          </div>
          <div class="extra-col">
            <div class="info-label">${t.features}</div>
            ${property.pool ? `<div class="info-item"><i class="fas fa-swimming-pool"></i> ${t.pool}</div>` : ''}
            ${property.wateringSystem ? `<div class="info-item"><i class="fas fa-water"></i> ${t.wateringSystem}</div>` : ''}
            ${property.carShelter ? `<div class="info-item"><i class="fas fa-car"></i> ${t.carShelter}</div>` : ''}
            <div class="info-item"><i class="fas fa-parking"></i> ${t.parking}: ${property.parking ? t.yes : t.no}</div>
            ${property.caretakerHouse ? `<div class="info-item"><i class="fas fa-house-user"></i> ${t.caretakerHouse}</div>` : ''}
            ${property.electricShutters ? `<div class="info-item"><i class="fas fa-window-maximize"></i> ${t.electricShutters}</div>` : ''}
            ${property.outdoorLighting ? `<div class="info-item"><i class="fas fa-lightbulb"></i> ${t.outdoorLighting}</div>` : ''}
          </div>
          <div class="extra-col">
            <div class="info-label">${t.contact}</div>
            ${property.contactFirstName || property.contactLastName ? `<div class="info-item"><i class="fal fa-user"></i> ${property.contactFirstName || ''} ${property.contactLastName || ''}</div>` : ''}
            ${property.contactPhone ? `<div class="info-item"><i class="fal fa-phone"></i> ${property.contactPhone}</div>` : ''}
            ${property.contactEmail ? `<div class="info-item"><i class="fal fa-envelope"></i> ${property.contactEmail}</div>` : ''}
          </div>
        </div>
      </div>
      ${miniPhotos.length ? `
      <div class="extra-info-desktop-3">
        <hr />
        <h2>${t.miniGallery}</h2>
        <div class="extra-columns mini-photos">
          ${miniPhotos.map(photo => `
            <div class="extra-col mini-photo-col">
              <img src="/uploads/${photo}" alt="${property.propertyType}" />
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      <script>
        const visitButton = document.getElementById('visitBtn');
        if (visitButton) {
          visitButton.addEventListener('click', function() {
            alert('${property.contactFirstName || ''} ${property.contactLastName || ''} - ${property.contactPhone || ''}');
          });
        }
      </script>
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
   const { price, surface, country, city, postalCode, propertyType, description, language } = req.body;
   const rawVideoUrl = (req.body.videoUrl || '').trim();
   const hasVideo = rawVideoUrl.length > 0;

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

    if (hasVideo) {
      cleanupUploadedFiles(req.files);
    } else {
      if (req.files.photo1?.[0]) {
        const p1 = `public/uploads/${Date.now()}-photo1.jpg`;
        await sharp(req.files.photo1[0].path).resize(800).jpeg({ quality: 80 }).toFile(p1);
        photo1 = path.basename(p1);
        fs.unlinkSync(req.files.photo1[0].path);
      }

      if (req.files.photo2?.[0]) {
        const p2 = `public/uploads/${Date.now()}-photo2.jpg`;
        await sharp(req.files.photo2[0].path).resize(800).jpeg({ quality: 80 }).toFile(p2);
        photo2 = path.basename(p2);
        fs.unlinkSync(req.files.photo2[0].path);
      }
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
      videoUrl: rawVideoUrl,
      photos: hasVideo ? [] : [photo1, photo2].filter(Boolean)
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
