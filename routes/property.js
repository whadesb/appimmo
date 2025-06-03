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



function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const seoKeywords = require('../utils/seoKeywords'); 
async function generateLandingPage(property) {
  const lang = property.language || 'fr';
  const city = property.city || '';
  const country = property.country || '';

  const slug = slugify(`${property.propertyType}-${city}-${country}`, { lower: true });
  const filename = `${property._id}-${slug}.html`;
  const filePath = path.join(__dirname, '../public/landing-pages', filename);
  const fullUrl = `https://uap.immo/landing-pages/${filename}`;

  const GTM_ID = 'GTM-TF7HSC3N';
  const GA_MEASUREMENT_ID = 'G-0LN60RQ12K';

  const keywordsList = seoKeywords[lang]?.[country] || [];
  const keywords = keywordsList.sort(() => 0.5 - Math.random()).slice(0, 3);

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

      <!-- Google Tag Manager -->
      <script>
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      </script>
      <!-- Fin Google Tag Manager -->

      <script type="application/ld+json">${JSON.stringify(jsonLD)}</script>

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
      height: auto;
      padding: 40px 20px;
      gap: 30px;
align-items: stretch;
    }
.property-details.one-line {
  display: flex;
  flex-direction: row;
  gap: 30px;
  margin: 20px 0;
}

    
.slider {
  flex: 2;
  overflow: hidden;
  position: relative;
  height: auto; 
  display: flex;
  flex-direction: column;
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

    .slides img:nth-child(1) { animation-delay: 0s; }
    .slides img:nth-child(2) { animation-delay: 5s; }

    @keyframes slide {
      0%, 50% { opacity: 1; }
      55%, 100% { opacity: 0; }
    }

   .property-info {
  flex: 0.8;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%; 
}

    .property-lorem {
      font-size: 1.2rem;
      border-bottom: 1px solid #C4B990;
      padding-bottom: 5px;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 400;
    }

    h2 {
      font-size: 1.6rem;
      font-weight: 300;
    }

    .property-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .detail {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .detail i {
      color: #C4B990;
    }

    .construction-year {
      font-size: 1.1rem;
    }

    .property-description {
      background: #f7f7f7;
      padding: 15px;
      border: 1px solid #ddd;
    }

    .section-title {
      font-size: 1.4rem;
      margin-bottom: 10px;
    }

    .price {
      background-color: #c4b9905f;
      padding: 10px 20px;
      font-size: 1.5rem;
      font-weight: 500;
      width: fit-content;
      text-transform: uppercase;
    }

    /* Bloc Infos complémentaires */
    .extra-info-desktop {
      display: none;
      max-width: 1400px;
      margin: 40px auto;
      padding: 20px;
      background: #ffffff;
    }
.extra-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 30px;
  border: 1px solid #eee;
  padding: 20px;
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

.other-info {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start; /* Aligne en haut */
  align-items: flex-start;
}


.other-info li {
  font-size: 1.2rem; /* Plus grande et pro */
  color: #2b2b2b;
  margin-bottom: 12px;
  font-family: "Lora", serif;
  line-height: 1.6;
}

.extra-col ul.other-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}

.other-info li {
  font-size: 1.1rem;
  color: #3c3c3c;
  line-height: 1.8;
  font-family: "Lora", serif;
}
.main-info-section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.main-info-section .info-label {
  font-weight: 500;
  margin-bottom: 10px;
  font-size: 1.3rem;
}

.main-info-section .info-item {
  padding: 6px 12px;
  font-size: 1.4rem;
  color: #3c3c3c;
  margin: 2px 0;
  border-radius: 4px;
  width: fit-content;
}

.extra-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 30px;
  border: 1px solid #eee;
  padding: 20px;
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

.other-info {
  list-style: none;
  padding: 0;
}

.other-info li {
  margin-bottom: 10px;
  font-size: 1rem;
}

    .extra-info-desktop hr {
      border: none;
      border-top: 1px solid #ddd;
      margin-bottom: 25px;
    }

    .extra-info-desktop h2 {
      font-size: 1.6rem;
      margin-bottom: 20px;
    }

    .dpe-section {
      margin-top: 10px;
    }

    .dpe-label {
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 1.1rem;
    }

    .dpe-bar {
      display: flex;
      flex-direction: column;
      width: 220px;
    }

    .bar {
      padding: 6px 12px;
      color: white;
      font-weight: bold;
      font-size: 1rem;
      margin: 2px 0;
      border-radius: 4px;
      opacity: 0.5;
    }

    .bar.A { background-color: #009966; width: 40%; }
    .bar.B { background-color: #66CC00; width: 50%; }
    .bar.C { background-color: #FFCC00; width: 60%; }
    .bar.D { background-color: #FF9900; width: 70%; }
    .bar.E { background-color: #FF6600; width: 80%; }
    .bar.F { background-color: #FF3300; width: 90%; }
    .bar.G { background-color: #CC0000; width: 100%; }

    .bar.active {
      opacity: 1;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.4);
    }

    .bar.pending {
      background-color: #ccc !important;
      color: #333;
      width: 100% !important;
      opacity: 1 !important;
      box-shadow: none !important;
    }
.extra-info-desktop h2 {
  font-size: 1.6rem;
  font-weight: 400;
  margin-bottom: 20px;
}

.extra-col .info-label {
  font-size: 1.35rem;
  font-weight: 400;
  font-family: "Lora", serif;
  margin-bottom: 12px;
}


    /* Responsive mobile */
    @media screen and (max-width: 768px) {
     html, body {
  overflow-x: hidden;
}

.container {
  max-width: 100% !important;
  padding: 20px 10px;
}

.slider {
  width: 100% !important;
  overflow: hidden;
}
    .slider img {
      width: 100vw !important;
      height: auto;
      object-fit: cover;
    }
      .slides, .slides img {
        position: relative;
        height: auto;
        opacity: 1;
        animation: none;
      }

      .extra-info-desktop {
        display: block;
      }

      .dpe-bar {
        width: 100%;
        max-width: 250px;
      }

    }

    /* Affiche le bloc en desktop */
    @media screen and (min-width: 769px) {
      .extra-info-desktop {
        display: block;
      }
.container {
    height: 75vh;
  }
.property-details.one-line {
    display: flex;
    flex-direction: row;
    gap: 30px;
    margin: 20px 0;
  }
#map {
  width: 100%;
  height: 389px;
  min-width: 400px;
  border: 1px solid #ddd;
  border-radius: 8px;
}


.extra-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.extra-col.map-col {
  flex: 1.5; /* un peu plus que les autres colonnes */
}

.extra-col .info-label,
.dpe-label {
  font-size: 1.35rem;
  font-weight: 400;
  margin-bottom: 12px;
  font-family: "Lora", serif;
}

.extra-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.extra-columns {
  align-items: flex-start;
}


    }
  </style>
</head>
<body>

  <!-- Google Tag Manager (noscript) -->
  <noscript>
    <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>
  </noscript>

  <!-- Bloc principal -->
  <div class="container">
    <div class="slider">
      <div class="slides">
        <img src="/uploads/${property.photos[0] || 'default.jpg'}" alt="Image 1" />
        <img src="/uploads/${property.photos[1] || 'default.jpg'}" alt="Image 2" />
      </div>
    </div>
    <div class="property-info">
      <p class="property-lorem">UAP Immo Annonce</p>
      <h1>Propriété à ${property.city}, ${property.country}</h1>
      <h2>Type de bien: ${property.propertyType}</h2>
      <div class="property-details one-line">
  <div class="detail">
    <i class="fal fa-ruler-combined"></i>
    <p>${property.surface} m²</p>
  </div>
  <div class="detail">
    <i class="fal fa-bed"></i>
    <p>${property.bedrooms} Chambre${property.bedrooms > 1 ? 's' : ''}</p>
  </div>
  <div class="detail">
    <i class="fal fa-home"></i>
    <p>${property.rooms} Pièce${property.rooms > 1 ? 's' : ''}</p>
  </div>
</div>


      <div class="construction-year">Année de construction: ${property.yearBuilt || 'Non renseignée'}</div>

      <div class="property-description">
        <div class="section-title">Visite guidée</div>
        ${property.description || 'Aucune description fournie.'}
      </div>

      <div class="price">Prix: ${Number(property.price).toLocaleString('fr-FR')} €</div>
    </div>
  </div>

  <!-- Bloc secondaire en dessous -->
 <div class="extra-info-desktop">
  <hr />
  <h2>Informations complémentaires</h2>

  <div class="extra-columns">
<!-- Colonne 1 : DPE -->
<div class="extra-col">
  <div class="info-label">DPE</div>
  <div class="dpe-bar">
    ${['A','B','C','D','E','F','G'].map(letter => `
      <div class="bar ${letter} ${property.dpe.toUpperCase() === letter ? 'active' : ''} ${property.dpe.toLowerCase() === 'en cours' ? 'pending' : ''}">
        ${letter}
      </div>
    `).join('')}
  </div>
</div>

<!-- Colonne 2 : Informations clés -->
<div class="extra-col">
  <div class="info-label">Informations clés</div>
  <div class="info-item">Prix : ${Number(property.price).toLocaleString('fr-FR')} €</div>
  <div class="info-item">Pièces : ${property.rooms}</div>
  <div class="info-item">Chambres : ${property.bedrooms}</div>
  <div class="info-item">Année : ${property.yearBuilt || 'Non renseignée'}</div>
</div>

<!-- Colonne 3 : Localisation -->
<div class="extra-col map-col">
  <div class="info-label">Localisation</div>
  <div id="map"></div>
</div>

  </div>
</div>
<script type="application/ld+json">
${JSON.stringify(jsonLD)}
</script>
</body>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    const city = "${property.city.replace(/"/g, '\\"')}";
    const country = "${property.country.replace(/"/g, '\\"')}";
    const fullAddress = city + ", " + country;

    fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(fullAddress))
      .then(response => response.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = data[0].lat;
          const lon = data[0].lon;

          const map = L.map('map').setView([lat, lon], 13);
          map.invalidateSize(); // important

          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map);

          L.marker([lat, lon]).addTo(map)
            .bindPopup("<b>" + city + "</b><br>" + country).openPopup();
        } else {
          document.getElementById('map').innerHTML = "Carte non disponible.";
        }
      })
      .catch(err => {
        console.error(err);
        document.getElementById('map').innerHTML = "Erreur lors du chargement de la carte.";
      });
  });
</script>
 </html>
  `;


  fs.writeFileSync(filePath, template);

  addToSitemap(fullUrl);
  pingSearchEngines("https://uap.immo/sitemap.xml");

  return `/landing-pages/${filename}`;
}

// Route pour ajouter une nouvelle propriété
router.post('/add-property', authMiddleware, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, surface, price, city, country, dpe, description } = req.body;

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
            dpe: dpe || 'En cours',
    description: description || '',
            userId: req.user._id,
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

        const { rooms, surface, price, city, country, dpe } = req.body;

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
// Route pour récupérer les landing pages de l'utilisateur connecté
router.get('/user/landing-pages', async (req, res) => {
    try {
        console.log("Requête reçue : /property/user/landing-pages");
        console.log("Utilisateur connecté :", req.user ? req.user._id : "Non connecté");

        if (!req.user) {
            return res.status(401).json({ error: "Non autorisé" });
        }

        const landingPages = await Property.find({ createdBy: req.user._id });

        console.log("Landing Pages trouvées :", landingPages);
        res.json(landingPages);
    } catch (error) {
        console.error("Erreur lors du chargement des landing pages :", error);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});


module.exports = router;
