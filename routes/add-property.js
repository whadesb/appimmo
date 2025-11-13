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

// Assurez-vous que les dépendances (fs, path, slugify, seoKeywords, addToSitemap, pingSearchEngines) sont déclarées une seule fois en début de fichier.

async function generateLandingPage(property) {
    const lang = property.language || 'fr';
    const city = property.city || '';
    const country = property.country || '';

    // --- Traductions étendues et ajout du label pour le 3e conteneur vidéo ---
    const translations = {
        fr: {
            adLabel: 'UAP Immo Annonce', propertyHeading: 'Propriété à', propertyType: 'Type de bien', yearBuilt: 'Année de construction', guidedTour: 'Visite guidée', price: 'Prix',
            addInfo: 'Informations complémentaires', keyInfo: 'Informations clés', location: 'Localisation', pool: 'Piscine', wateringSystem: 'Arrosage automatique',
            carShelter: 'Abri voiture', parking: 'Parking', caretakerHouse: 'Maison de gardien', electricShutters: 'Stores électriques', outdoorLighting: 'Éclairage extérieur',
            visit: 'Visiter', yes: 'Oui', no: 'Non', notProvided: 'Non renseignée', noDescription: 'Aucune description fournie.',
            mapUnavailable: 'Carte non disponible.', mapError: 'Erreur lors du chargement de la carte.', inProgress: 'En cours',
            secondSection: 'Seconde Section', // Ajout du label de la seconde section
            videoExtra: 'Troisième Bloc Vidéo' // Nouveau label pour le bloc conditionnel
        },
        en: {
            adLabel: 'UAP Real Estate Ad', propertyHeading: 'Property in', propertyType: 'Property Type', yearBuilt: 'Year built', guidedTour: 'Guided tour', price: 'Price',
            addInfo: 'Additional information', keyInfo: 'Key information', location: 'Location', pool: 'Pool', wateringSystem: 'Watering system',
            carShelter: 'Car shelter', parking: 'Parking', caretakerHouse: 'Caretaker house', electricShutters: 'Electric shutters', outdoorLighting: 'Outdoor lighting',
            visit: 'Visit', yes: 'Yes', no: 'No', notProvided: 'Not provided', noDescription: 'No description provided.',
            mapUnavailable: 'Map not available.', mapError: 'Error loading the map.', inProgress: 'In progress',
            secondSection: 'Second Section', videoExtra: 'Third Video Block'
        },
        es: {
            adLabel: 'Anuncio UAP Immo', propertyHeading: 'Propiedad en', propertyType: 'Tipo de propiedad', yearBuilt: 'Año de construcción', guidedTour: 'Visita guiada', price: 'Precio',
            addInfo: 'Información adicional', keyInfo: 'Información clave', location: 'Ubicación', pool: 'Piscina', wateringSystem: 'Sistema de riego',
            carShelter: 'Cochera', parking: 'Estacionamiento', caretakerHouse: 'Casa del guardián', electricShutters: 'Persianas eléctricas', outdoorLighting: 'Iluminación exterior',
            visit: 'Visitar', yes: 'Sí', no: 'No', notProvided: 'No especificado', noDescription: 'No se proporcionó descripción.',
            mapUnavailable: 'Mapa no disponible.', mapError: 'Error al cargar el mapa.', inProgress: 'En curso',
            secondSection: 'Segunda Sección', videoExtra: 'Tercer Bloque de Vídeo'
        },
        pt: {
            adLabel: 'Anúncio UAP Immo', propertyHeading: 'Propriedade em', propertyType: 'Tipo de imóvel', yearBuilt: 'Ano de construção', guidedTour: 'Visita guiada', price: 'Preço',
            addInfo: 'Informações adicionais', keyInfo: 'Informações chave', location: 'Localização', pool: 'Piscina', wateringSystem: 'Sistema de irrigação',
            carShelter: 'Abrigo para carro', parking: 'Estacionamento', caretakerHouse: 'Casa do zelador', electricShutters: 'Persianas elétricas', outdoorLighting: 'Iluminação externa',
            visit: 'Visitar', yes: 'Sim', no: 'Não', notProvided: 'Não fornecido', noDescription: 'Nenhuma descrição fornecida.',
            mapUnavailable: 'Mapa indisponível.', mapError: 'Erro ao carregar o mapa.', inProgress: 'Em andamento',
            secondSection: 'Segunda Seção', videoExtra: 'Terceiro Bloco de Vídeo'
        }
    };
    // --- Fin Traductions ---

    const t = translations[lang] || translations.fr;

    const slug = slugify(`${property.propertyType}-${city}-${country}`, { lower: true });
    const filename = `${property._id}-${slug}.html`;
    
    // CHEMIN D'ÉCRITURE (Corrigé pour correspondre au express.static(path.join(__dirname, 'public')))
    const filePath = path.join(__dirname, 'public', 'landing-pages', filename); 
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
    // const GA_MEASUREMENT_ID = 'G-0LN60RQ12K'; // Non utilisé dans le template, mais gardé en commentaire.

    const jsonLD = {
        // ... (JSON-LD reste inchangé) ...
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
    
    // --- CONTENEUR D'INFORMATIONS ADDITIONNELLES (Section 1 et 2) ---
    // Ce bloc est affiché dans les deux modes (Vidéo et Photo)
    const extraInfoContainer = `
        <div class="extra-info-desktop">
            <hr />
            <h2>${t.addInfo}</h2>
            <div class="extra-columns">
                <div class="extra-col">
                    <div class="info-label">DPE : ${
                        property.dpe?.toLowerCase() === 'en cours'
                            ? `<em>${t.inProgress}</em>`
                            : `<strong>${property.dpe || t.notProvided}</strong>`
                    }</div>
                    <div class="dpe-bar">
                        ${['A','B','C','D','E','F','G'].map(letter => `
                            <div class="bar ${letter} ${property.dpe?.toUpperCase() === letter ? 'active' : ''} ${property.dpe?.toLowerCase() === 'en cours' ? 'pending' : ''}">
                                ${letter}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="extra-col">
                    <div class="info-label">${t.keyInfo}</div>
                    <div class="info-item">${t.price} : ${formattedPrice} €</div>
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

                <div class="extra-col map-col">
                    <div class="info-label">${t.location}</div>
                    <div id="map" style="height: 250px;">${t.mapUnavailable}</div>
                </div>
            </div>
            
            <hr />
            <h2>${t.addInfo} - ${t.secondSection}</h2>
            <div class="extra-columns">
                <div class="extra-col">
                    <div class="info-label">Titre 1 (Futur Contenu)</div>
                    <p style="font-size:1rem; color:#666;">Ce conteneur est prêt à recevoir votre contenu futur.</p>
                </div>

                <div class="extra-col">
                    <div class="info-label">Titre 2 (Futur Contenu)</div>
                    <p style="font-size:1rem; color:#666;">Il est structuré en colonnes pour faciliter l'ajout d'informations.</p>
                </div>
                
                <div class="extra-col map-col">
                    <div class="info-label">Titre 3 (Futur Contenu)</div>
                    <p style="font-size:1rem; color:#666;">Troisième colonne pour d'autres détails.</p>
                </div>
            </div>
        </div>
    `;
    
    // --- CONTENEUR SUPPLÉMENTAIRE SPÉCIFIQUE VIDÉO (Le 3ème conteneur que vous voulez après les deux premiers) ---
    const videoOnlyExtraContainer = `
        <div class="extra-info-desktop video-specific-container">
            <hr />
            <h2>${t.videoExtra}</h2>
            <p style="font-size:1rem; color:#666;">Ce conteneur est visible uniquement en mode vidéo et suit les deux sections d'informations complémentaires.</p>
        </div>
    `;
    // --- FIN CONTENEUR SUPPLÉMENTAIRE ---

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
            <style>
                /* Styles de base de votre ancienne version */
                * {
                    margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif;
                }
                body {
                    background-color: #ffffff; color: #3c3c3c; line-height: 1.5;
                }
                /* Correction clé pour le mode vidéo : retire le flexbox du body pour permettre le scroll */
                body.has-video {
                    background-color: #000; color: #ffffff; min-height: 100vh;
                    /* Retiré: display: flex; flex-direction: column; */
                }
                /* Styles Vidéo */
                .video-background { position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: -1; }
                .video-background iframe { width: 100%; height: 100%; pointer-events: none; }
                .video-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: -1; }
                .video-hero { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 60px 20px; text-align: center; }
                .video-card { background: rgba(0, 0, 0, 0.55); padding: 50px 40px; border-radius: 28px; max-width: 960px; width: 100%; display: flex; flex-direction: column; gap: 24px; }
                .video-card h1 { font-size: 2.8rem; margin: 0; color: #ffffff; }
                .video-card p { margin: 0; font-size: 1.1rem; line-height: 1.6; color: #f2f2f2; }
                .video-highlight { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
                .video-highlight .item { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; }
                .video-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 20px; }
                .video-actions .price { background-color: #c4b990; color: #000000; font-size: 1.5rem; font-weight: 600; padding: 14px 32px; border-radius: 999px; }
                .video-actions .visit-btn { background: none; border: none; border-radius: 999px; color: #ffffff; padding: 14px 32px; cursor: pointer; font-size: 1.4rem; transition: opacity 0.2s ease; }
                .video-actions .visit-btn:hover { opacity: 0.85; }
                /* Styles Page Photo */
                .container { max-width: 1400px; width: 100%; display: flex; flex-direction: row; background-color: white; border-radius: 0; overflow: hidden; margin: 0 auto; height: auto; padding: 40px 20px; gap: 30px; align-items: stretch; }
                .property-info { flex: 0.8; padding: 0 40px; display: flex; flex-direction: column; justify-content: space-between; }
                .property-lorem { font-size: 1.2rem; border-bottom: 1px solid #C4B990; padding-bottom: 5px; }
                /* Styles de base de vos éléments (H1, details, price, etc.) */
                h1 { font-size: 1.8rem; font-weight: 400; line-height: 1.15; margin-bottom: 15px; }
                .property-details.one-line { display: flex; flex-direction: row; gap: 30px; margin: 20px 0; }
                .detail { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
                .detail i { color: #C4B990; }
                .price-row { display: flex; gap: 10px; }
                .price { background-color: #f7f7f7; padding: 10px 20px; font-size: 1.5rem; font-weight: 500; width: 100%; text-transform: uppercase; margin: 20px 0; text-align: center; flex: 1; }
                /* NOUVEAUX STYLES (Infos complémentaires) */
                .extra-info-desktop {
                    max-width: 960px; /* Alignement avec le contenu principal du mode photo */
                    margin: 40px auto;
                    padding: 20px;
                    background: #ffffff;
                    color: #000;
                    position: relative; 
                    z-index: 2;
                    display: block; /* Force l'affichage pour le mode photo */
                }
                .has-video .extra-info-desktop {
                    background: rgba(255, 255, 255, 0.95); 
                    color: #000;
                    border-radius: 12px;
                    padding: 30px;
                    margin-top: 20px;
                }
                .extra-info-desktop h2 { font-size: 1.6rem; margin-bottom: 20px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                .extra-columns { display: flex; flex-wrap: wrap; gap: 30px; justify-content: space-between; padding: 20px 0; }
                .extra-col { flex: 1; min-width: 250px; padding: 0 10px; position: relative; }
                .info-label { font-weight: bold; margin-bottom: 10px; }
                .info-item { margin: 8px 0; display: flex; align-items: center; gap: 10px; font-size: 1rem; }
                .info-item i { color: #000; }
                .dpe-bar { display: flex; flex-direction: column; width: 100%; max-width: 200px; }
                .bar { padding: 4px 8px; color: white; font-weight: bold; margin: 2px 0; border-radius: 4px; opacity: 0.5; }
                .bar.A { background-color: #009966; } .bar.B { background-color: #66CC00; } .bar.C { background-color: #FFCC00; } 
                .bar.D { background-color: #FF9900; } .bar.E { background-color: #FF6600; } .bar.F { background-color: #FF3300; }
                .bar.G { background-color: #CC0000; } .bar.active { opacity: 1; box-shadow: 0 0 5px rgba(0, 0, 0, 0.4); }
                /* Responsive Ajusté */
                @media (max-width: 768px) {
                     .extra-info-desktop { padding: 10px; margin: 20px auto; }
                     .has-video .extra-info-desktop { border-radius: 0; padding: 20px 10px; }
                     .extra-columns { flex-direction: column; gap: 10px; padding: 10px 0; }
                     .extra-col { min-width: unset; padding: 0 5px; }
                     #map { height: 200px; }
                }
            </style>
            <script>
                // Google Tag Manager
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
                        ${property.description ? `<p>${property.description}</p>` : `<p>${t.noDescription}</p>`}
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
                    ${property.description ? `<p>${property.description}</p>` : `<p>${t.noDescription}</p>`}
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
            
            ${extraInfoContainer}

            ${embedUrl ? videoOnlyExtraContainer : ''}

            <script>
                // Logique JS
                document.addEventListener("DOMContentLoaded", function () {
                    const contactInfo = '${property.contactFirstName || ''} ${property.contactLastName || ''} - ${property.contactPhone || ''}';
                    const visitButton = document.getElementById('visitBtn');

                    if (visitButton) {
                        visitButton.addEventListener('click', function() {
                            alert(contactInfo);
                        });
                    }

                    // Logique de la carte (Leaflet)
                    const mapElement = document.getElementById('map');
                    if (mapElement && typeof L !== 'undefined') { 
                        const city = "${property.city || ''}".replace(/"/g, '');
                        const country = "${property.country || ''}".replace(/"/g, '');
                        const fullAddress = city + ", " + country;

                        fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(fullAddress))
                            .then(response => response.json())
                            .then(data => {
                                if (data && data.length > 0) {
                                    const lat = data[0].lat;
                                    const lon = data[0].lon;
                                    
                                    const map = L.map('map').setView([lat, lon], 13);
                                    setTimeout(() => { map.invalidateSize(); }, 400); 

                                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    }).addTo(map);

                                    L.marker([lat, lon]).addTo(map)
                                        .bindPopup("<b>" + city + "</b><br>" + country).openPopup();
                                } else {
                                    mapElement.innerHTML = "${t.mapUnavailable}";
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                mapElement.innerHTML = "${t.mapError}";
                            });
                    }
                    // Le reste du JS (carousel, etc.) devrait être ici si nécessaire.
                });
            </script>
        </body>
        </html>`;
    
    // --- Écriture du fichier avec vérification du répertoire ---
    const targetDir = path.join(__dirname, 'public', 'landing-pages'); 
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
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
