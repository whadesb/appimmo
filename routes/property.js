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

  const translations = {
    fr: {
      adLabel: 'UAP Immo Annonce',
      propertyHeading: 'Propriété à',
      propertyType: 'Type de bien',
      yearBuilt: 'Année de construction',
      guidedTour: 'Visite guidée',
      price: 'Prix',
      addInfo: 'Informations complémentaires',
      keyInfo: 'Informations clés',
      location: 'Localisation',
      pool: 'Piscine',
      wateringSystem: 'Arrosage automatique',
      carShelter: 'Abri voiture',
      parking: 'Parking',
      caretakerHouse: 'Maison de gardien',
      electricShutters: 'Stores électriques',
      outdoorLighting: 'Éclairage extérieur',
      visit: 'Visiter',
      yes: 'Oui',
      no: 'Non',
      notProvided: 'Non renseignée',
      noDescription: 'Aucune description fournie.',
      mapUnavailable: 'Carte non disponible.',
      mapError: 'Erreur lors du chargement de la carte.',
      inProgress: 'En cours'
    },
    en: {
      adLabel: 'UAP Real Estate Ad',
      propertyHeading: 'Property in',
      propertyType: 'Property Type',
      yearBuilt: 'Year built',
      guidedTour: 'Guided tour',
      price: 'Price',
      addInfo: 'Additional information',
      keyInfo: 'Key information',
      location: 'Location',
      pool: 'Pool',
      wateringSystem: 'Watering system',
      carShelter: 'Car shelter',
      parking: 'Parking',
      caretakerHouse: 'Caretaker house',
      electricShutters: 'Electric shutters',
      outdoorLighting: 'Outdoor lighting',
      visit: 'Visit',
      yes: 'Yes',
      no: 'No',
      notProvided: 'Not provided',
      noDescription: 'No description provided.',
      mapUnavailable: 'Map not available.',
      mapError: 'Error loading the map.',
      inProgress: 'In progress'
    },
    es: {
      adLabel: 'Anuncio UAP Immo',
      propertyHeading: 'Propiedad en',
      propertyType: 'Tipo de propiedad',
      yearBuilt: 'Año de construcción',
      guidedTour: 'Visita guiada',
      price: 'Precio',
      addInfo: 'Información adicional',
      keyInfo: 'Información clave',
      location: 'Ubicación',
      pool: 'Piscina',
      wateringSystem: 'Sistema de riego',
      carShelter: 'Cochera',
      parking: 'Estacionamiento',
      caretakerHouse: 'Casa del guardián',
      electricShutters: 'Persianas eléctricas',
      outdoorLighting: 'Iluminación exterior',
      visit: 'Visitar',
      yes: 'Sí',
      no: 'No',
      notProvided: 'No especificado',
      noDescription: 'No se proporcionó descripción.',
      mapUnavailable: 'Mapa no disponible.',
      mapError: 'Error al cargar el mapa.',
      inProgress: 'En curso'
    },
    pt: {
      adLabel: 'Anúncio UAP Immo',
      propertyHeading: 'Propriedade em',
      propertyType: 'Tipo de imóvel',
      yearBuilt: 'Ano de construção',
      guidedTour: 'Visita guiada',
      price: 'Preço',
      addInfo: 'Informações adicionais',
      keyInfo: 'Informações chave',
      location: 'Localização',
      pool: 'Piscina',
      wateringSystem: 'Sistema de irrigação',
      carShelter: 'Abrigo para carro',
      parking: 'Estacionamento',
      caretakerHouse: 'Casa do zelador',
      electricShutters: 'Persianas elétricas',
      outdoorLighting: 'Iluminação externa',
      visit: 'Visitar',
      yes: 'Sim',
      no: 'Não',
      notProvided: 'Não fornecido',
      noDescription: 'Nenhuma descrição fornecida.',
      mapUnavailable: 'Mapa indisponível.',
      mapError: 'Erro ao carregar o mapa.',
      inProgress: 'Em andamento'
    }
  };

  const t = translations[lang] || translations.fr;

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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

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
      font-family: Arial, sans-serif;
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
  padding: 0 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  gap: 5px;
}

    .property-lorem {
      font-size: 1.2rem;
      border-bottom: 1px solid #C4B990;
      padding-bottom: 5px;
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 400;
      line-height: 1.15;
    }

    h2 {
      font-size: 1.2rem;
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
      margin: 8px 0;
    }

    .detail i,
    .detail p {
      font-size: 14px;
    }

    .detail i {
      color: #C4B990;
    }

    .construction-year {
      font-size: 1.1rem;
      margin: 20px 0;
    }

    .property-description {
      background: #f7f7f7;
      padding: 15px;
      border: 1px solid #ddd;
      margin: 20px 0;
    }

    .section-title {
      font-size: 1.4rem;
      margin-bottom: 10px;
    }

    .price-row {
      display: flex;
      gap: 10px;
    }

    .price {
      background-color: #f7f7f7;
      padding: 10px 20px;
      font-size: 1.5rem;
      font-weight: 500;
      width: 100%;
      text-transform: uppercase;
      margin: 20px 0;
      text-align: center;
      flex: 1;
    }

    .visit-btn {
      width: 100%;
      margin: 20px 0;
      flex: 1;
      background-color: #C4B990;
      color: #fff;
      border: none;
      padding: 10px 20px;
      cursor: pointer;
    }
    .visit-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
    }
    .visit-modal-content {
      background: #fff;
      padding: 20px;
      border-radius: 4px;
      text-align: center;
      position: relative;
    }
    .visit-modal .close {
      position: absolute;
      top: 10px;
      right: 20px;
      cursor: pointer;
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
  font-family: Arial, sans-serif;
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
  font-family: Arial, sans-serif;
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
  font-family: Arial, sans-serif;
  margin-bottom: 12px;
}

  .info-item {
    margin: 10px 0;
  }


  @media screen and (max-width: 768px) {
  html, body {
    overflow-x: hidden;
    font-family: Arial, sans-serif;
    color: #3c3c3c;
  }

  .container {
    flex-direction: column;
    padding: 0;
    gap: 0;
  }

  .slider {
    width: 100%;
    overflow: hidden;
  }

  .slider img {
    width: 100%;
    height: auto;
    object-fit: cover;
    display: block;
  }

  .slides,
  .slides img {
    position: relative;
    height: auto;
    opacity: 1;
    animation: none;
  }
h1 {
  font-size: 1.8rem;
  line-height: 1.3;
  font-weight: 500;
  margin-bottom: 15px;
}

  .property-info {
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
    font-family: Arial, sans-serif;
    font-size: 1.1rem;
  }

  .property-lorem,
  .construction-year,
  .property-details,
  .detail p {
    font-size: 14px;
  }

  .detail i {
    font-size: 14px;
  }

  .section-title {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .price-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .property-description {
    margin-top: 20px;
    margin-bottom: 20px;
    font-size: 1.2rem;
    line-height: 1.6;
  }

  .construction-year {
    margin: 20px 0;
  }

.price {
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 12px 15px;
  font-size: 1.4rem;
  font-weight: 600;
  background-color: #f7f7f7;
  text-transform: uppercase;
  border-radius: 4px;
  display: block;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

  .visit-btn {
    width: 100%;
    margin: 20px 0;
    flex: 1;
    background-color: #C4B990;
    color: #fff;
    border: none;
    padding: 10px 20px;
    cursor: pointer;
  }

  .extra-info-desktop {
    display: block;
    padding: 10px 20px;
    font-family: Arial, sans-serif;
    text-align: left; /* aligné comme "Type de bien" */
  }

  .extra-info-desktop h2 {
    font-size: 1.4rem;
    margin-bottom: 20px;
    text-align: left;
    font-weight: 500;
 margin-top: 0;
  }

  .extra-columns {
    flex-direction: column;
    gap: 20px;
    padding: 0;
    border: none;
  }

  .extra-col {
    flex: 1;
    padding: 10px 0;
    border: none;
    position: relative;
  }

  .extra-col:not(:last-child)::after {
    content: none;
  }

  .info-label {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .info-item {
    font-size: 1.25rem;
    margin: 10px 0;
  }

  .dpe-bar {
    width: 100%;
    max-width: 250px;
  }

  .extra-col.map-col {
    padding: 10px 0;
  }

  #map {
    width: 100%;
    height: 250px;
    border-radius: 8px;
    border: 1px solid #ccc;
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
  font-family: Arial, sans-serif;
}

.extra-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.extra-columns {
  align-items: flex-start;
}


    .photo-carousel {
      position: relative;
      max-width: 1400px;
      width: 100%;
      margin: 20px auto;
      padding: 0 20px;
      overflow: hidden;
    }
    .photo-carousel .carousel-track {
      display: flex;
      width: 100%;
      gap: 30px;
      transition: transform 0.3s ease-in-out;
    }
 .photo-carousel img {
      width: 45%;
      height: 150px;
      object-fit: contain;
      cursor: pointer;
    }
    .photo-carousel .carousel-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.5);
      color: #fff;
      border: none;
      padding: 5px 10px;
      cursor: pointer;
    }
    .photo-carousel .carousel-btn.prev { left: 0; }
    .photo-carousel .carousel-btn.next { right: 0; }
    @media (max-width: 768px) {
      .photo-carousel img { width: 50%; }
    }
    .mini-carousel {
      position: relative;
      width: 100%;
      margin: 10px auto;
      overflow: hidden;
    }
    .mini-carousel .mini-track {
      display: flex;
      transition: transform 0.3s ease-in-out;
      justify-content: center;
    }
    .mini-carousel img {
      width: 20%;
      height: 60px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .fullscreen-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .fullscreen-overlay img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    }
    .fullscreen-overlay .close {
      position: absolute;
      top: 20px;
      right: 30px;
      color: #fff;
      font-size: 30px;
      cursor: pointer;
    }
    .mini-carousel .mini-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.5);
      color: #fff;
      border: none;
      padding: 5px 10px;
      cursor: pointer;
    }
    .mini-carousel .mini-btn.prev { left: 0; }
    .mini-carousel .mini-btn.next { right: 0; }
    @media (max-width: 768px) {
      .mini-carousel img { width: 33.33%; }
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
      <p class="property-lorem">${t.adLabel}</p>
      <h1>${t.propertyHeading}<br> ${property.city}, ${property.country}</h1>
      <h2>${t.propertyType}: ${property.propertyType}</h2>
      <div class="property-details one-line">
  <div class="detail">
    <i class="fal fa-ruler-combined"></i>
    <p>${property.surface} m²</p>
  </div>
  <div class="detail">
    <i class="fal fa-bed"></i>
    <p>${property.bedrooms}</p>
  </div>
  <div class="detail">
    <i class="fal fa-home"></i>
    <p>${property.rooms}</p>
  </div>
</div>


      <div class="construction-year">${t.yearBuilt}: ${property.yearBuilt || t.notProvided}</div>

      <div class="property-description">
        <div class="section-title">${t.guidedTour}</div>
        ${property.description || t.noDescription}
      </div>

      <div class="price-row">
        <div class="price">${Number(property.price).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €</div>
        <button class="visit-btn" id="visitBtn">${t.visit}</button>
        <div id="visitModal" class="visit-modal">
          <div class="visit-modal-content">
            <span id="closeModal" class="close">&times;</span>
            <p>${property.contactFirstName || ''} ${property.contactLastName || ''}</p>
            <p>${property.contactPhone || ''}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  ${property.photos.slice(2).length > 0 ? `
  <div class="photo-carousel">
    <button class="carousel-btn prev">&#10094;</button>
    <div class="carousel-track">
      ${property.photos.slice(2,10).map(p => `<img src="/uploads/${p}" alt="Photo" />`).join('')}
    </div>
    <button class="carousel-btn next">&#10095;</button>
  </div>
  ` : ''}

  ${property.photos.slice(10).length > 0 ? `
  <div class="mini-carousel">
    <button class="mini-btn prev">&#10094;</button>
    <div class="mini-track">
      ${property.photos.slice(10,13).map(p => `<img src="/uploads/${p}" alt="Photo" />`).join('')}
    </div>
    <button class="mini-btn next">&#10095;</button>
  </div>
  ` : ''}

  <div id="fullscreenOverlay" class="fullscreen-overlay">
    <span class="close">&times;</span>
    <img id="fullscreenImg" src="" alt="Photo en plein écran" />
  </div>

  <!-- Bloc secondaire en dessous -->
 <div class="extra-info-desktop">
  <hr />
  <h2>${t.addInfo}</h2>

  <div class="extra-columns">
<!-- Colonne 1 : DPE -->
<div class="extra-col">
  <div class="info-label">DPE : ${
    property.dpe.toLowerCase() === 'en cours'
      ? `<em>${t.inProgress}</em>`
      : `<strong>${property.dpe}</strong>`
  }</div>
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
  <div class="info-label">${t.keyInfo}</div>
  <div class="info-item">${t.price} : ${Number(property.price).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €</div>
  <div class="info-item"><i class="fal fa-ruler-combined"></i> ${property.surface} m²</div>
  <div class="info-item"><i class="fal fa-home"></i> ${property.rooms}</div>
  <div class="info-item"><i class="fal fa-bed"></i> ${property.bedrooms}</div>
  <div class="info-item"><i class="fal fa-calendar-alt"></i> ${property.yearBuilt || t.notProvided}</div>
  ${property.pool ? `<div class="info-item"><i class="fas fa-swimming-pool"></i> ${t.pool}</div>` : ''}
  ${property.wateringSystem ? `<div class="info-item"><i class="fas fa-water"></i> ${t.wateringSystem}</div>` : ''}
  ${property.carShelter ? `<div class="info-item"><i class="fas fa-car"></i> ${t.carShelter}</div>` : ''}
  <div class="info-item"><i class="fas fa-parking"></i> ${t.parking}: ${property.parking ? t.yes : t.no}</div>
  ${property.caretakerHouse ? `<div class="info-item"><i class="fas fa-house-user"></i> ${t.caretakerHouse}</div>` : ''}
  ${property.electricShutters ? `<div class="info-item"><i class="fas fa-window-maximize"></i> ${t.electricShutters}</div>` : ''}
  ${property.outdoorLighting ? `<div class="info-item"><i class="fas fa-lightbulb"></i> ${t.outdoorLighting}</div>` : ''}
</div>

<!-- Colonne 3 : Localisation -->
<div class="extra-col map-col">
  <div class="info-label">${t.location}</div>
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
          document.getElementById('map').innerHTML = "${t.mapUnavailable}";
        }
      })
      .catch(err => {
        console.error(err);
        document.getElementById('map').innerHTML = "${t.mapError}";
      });

    const visitBtn = document.getElementById('visitBtn');
    const visitModal = document.getElementById('visitModal');
    const closeModal = document.getElementById('closeModal');
    if (visitBtn && visitModal && closeModal) {
      visitBtn.addEventListener('click', () => {
        visitModal.style.display = 'flex';
      });
      closeModal.addEventListener('click', () => {
        visitModal.style.display = 'none';
      });
      visitModal.addEventListener('click', (e) => {
        if (e.target === visitModal) {
          visitModal.style.display = 'none';
        }
      });
    }

    const track = document.querySelector('.carousel-track');
    if (track) {
      const prev = document.querySelector('.carousel-btn.prev');
      const next = document.querySelector('.carousel-btn.next');
      let index = 0;
      function updateCarousel() {
        const imgWidth = track.querySelector('img').clientWidth;
        track.style.transform = \`translateX(-\${index * imgWidth}px)\`;
      }
      next.addEventListener('click', () => {
        const visible = window.innerWidth <= 768 ? 2 : 4;
        if (index < track.children.length - visible) {
          index += visible;
          if (index > track.children.length - visible) {
            index = track.children.length - visible;
          }
          updateCarousel();
        }
      });
      prev.addEventListener('click', () => {
        const visible = window.innerWidth <= 768 ? 2 : 4;
        if (index > 0) {
          index -= visible;
          if (index < 0) index = 0;
          updateCarousel();
        }
      });
      window.addEventListener('resize', updateCarousel);

      const fullscreenOverlay = document.getElementById('fullscreenOverlay');
      const fullscreenImg = document.getElementById('fullscreenImg');
      const closeFs = fullscreenOverlay.querySelector('.close');
      track.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => {
          fullscreenImg.src = img.src;
          fullscreenOverlay.style.display = 'flex';
        });
      });
      closeFs.addEventListener('click', () => {
        fullscreenOverlay.style.display = 'none';
      });
      fullscreenOverlay.addEventListener('click', (e) => {
        if (e.target === fullscreenOverlay) {
          fullscreenOverlay.style.display = 'none';
        }
      });
    }

    const miniTrack = document.querySelector('.mini-track');
    if (miniTrack) {
      const prevMini = document.querySelector('.mini-btn.prev');
      const nextMini = document.querySelector('.mini-btn.next');
      let miniIndex = 0;
      function updateMini() {
        const imgWidth = miniTrack.querySelector('img').clientWidth;
        miniTrack.style.transform = 'translateX(-' + miniIndex * imgWidth + 'px)';
      }
      nextMini.addEventListener('click', () => {
        const visibleMini = window.innerWidth <= 768 ? 1 : 3;
        if (miniIndex < miniTrack.children.length - visibleMini) {
          miniIndex += visibleMini;
          if (miniIndex > miniTrack.children.length - visibleMini) {
            miniIndex = miniTrack.children.length - visibleMini;
          }
          updateMini();
        }
      });
      prevMini.addEventListener('click', () => {
        const visibleMini = window.innerWidth <= 768 ? 1 : 3;
        if (miniIndex > 0) {
          miniIndex -= visibleMini;
          if (miniIndex < 0) miniIndex = 0;
          updateMini();
        }
      });
      window.addEventListener('resize', updateMini);
    }
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
    { name: 'photo2', maxCount: 1 },
    { name: 'extraPhotos', maxCount: 8 },
    { name: 'miniPhotos', maxCount: 3 }
]), async (req, res) => {
    const { rooms, surface, price, city, country, dpe, description } = req.body;

    let photo1 = null;
    let photo2 = null;
    let extraPhotos = [];
    let miniPhotos = [];

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
            rooms,
            surface,
            price,
            city,
            country,
            dpe: dpe || 'En cours',
    description: description || '',
            language: req.body.language || 'fr',
            userId: req.user._id,
            photos: [photo1, photo2, ...extraPhotos, ...miniPhotos]
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
    { name: 'photo2', maxCount: 1 },
    { name: 'extraPhotos', maxCount: 8 },
    { name: 'miniPhotos', maxCount: 3 }
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

        let extraPhotos = property.photos.slice(2,10);
        if (req.files.extraPhotos) {
            extraPhotos = [];
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

        let miniPhotos = property.photos.slice(10,13);
        if (req.files.miniPhotos) {
            miniPhotos = [];
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

        property.photos = property.photos.slice(0,2).concat(extraPhotos, miniPhotos);

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

