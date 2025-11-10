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
      adLabel: 'UAP Immo Annonce',
      propertyHeading: 'Propriété à',
      propertyType: 'Type de bien',
      yearBuilt: 'Année de construction',
      guidedTour: 'Visite guidée',
      addInfo: 'Informations complémentaires',
      keyInfo: 'Informations clés',
      location: 'Localisation',
      notProvided: 'Non renseignée',
      noDescription: 'Aucune description fournie.',
      mapUnavailable: 'Carte non disponible.',
      mapError: 'Erreur lors du chargement de la carte.',
      inProgress: 'En cours',
      galleryTitle: 'Galerie photos',
      gallerySubtitle: 'Découvrez d’autres vues du bien.',
      galleryAlt: 'Photo du bien immobilier',
      previous: 'Précédent',
      next: 'Suivant'
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
      no: 'No',
      adLabel: 'UAP Real Estate Ad',
      propertyHeading: 'Property in',
      propertyType: 'Property Type',
      yearBuilt: 'Year built',
      guidedTour: 'Guided tour',
      addInfo: 'Additional information',
      keyInfo: 'Key information',
      location: 'Location',
      notProvided: 'Not provided',
      noDescription: 'No description provided.',
      mapUnavailable: 'Map not available.',
      mapError: 'Error loading the map.',
      inProgress: 'In progress',
      galleryTitle: 'Photo gallery',
      gallerySubtitle: 'Browse additional views of the property.',
      galleryAlt: 'Property photo',
      previous: 'Previous',
      next: 'Next'
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
      no: 'No',
      adLabel: 'Anuncio UAP Immo',
      propertyHeading: 'Propiedad en',
      propertyType: 'Tipo de propiedad',
      yearBuilt: 'Año de construcción',
      guidedTour: 'Visita guiada',
      addInfo: 'Información adicional',
      keyInfo: 'Información clave',
      location: 'Ubicación',
      notProvided: 'No especificado',
      noDescription: 'No se proporcionó descripción.',
      mapUnavailable: 'Mapa no disponible.',
      mapError: 'Error al cargar el mapa.',
      inProgress: 'En curso',
      galleryTitle: 'Galería de fotos',
      gallerySubtitle: 'Descubre más vistas de la propiedad.',
      galleryAlt: 'Foto de la propiedad',
      previous: 'Anterior',
      next: 'Siguiente'
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
      no: 'Não',
      adLabel: 'Anúncio UAP Immo',
      propertyHeading: 'Propriedade em',
      propertyType: 'Tipo de imóvel',
      yearBuilt: 'Ano de construção',
      guidedTour: 'Visita guiada',
      addInfo: 'Informações adicionais',
      keyInfo: 'Informações chave',
      location: 'Localização',
      notProvided: 'Não fornecido',
      noDescription: 'Nenhuma descrição fornecida.',
      mapUnavailable: 'Mapa indisponível.',
      mapError: 'Erro ao carregar o mapa.',
      inProgress: 'Em andamento',
      galleryTitle: 'Galeria de fotos',
      gallerySubtitle: 'Descubra outras vistas do imóvel.',
      galleryAlt: 'Foto do imóvel',
      previous: 'Anterior',
      next: 'Seguinte'
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

  const allPhotos = Array.isArray(property.photos) ? property.photos.filter(Boolean) : [];
  const extraPhotosFromIndex = Array.isArray(property.photos)
    ? property.photos.slice(2).filter(Boolean)
    : [];
  const videoGalleryPhotos = embedUrl ? (extraPhotosFromIndex.length > 0 ? extraPhotosFromIndex : allPhotos) : [];


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
        }
        /* CSS pour la galerie de photos */
        .gallery-section {
          max-width: 1100px;
          margin: 40px auto;
          padding: 20px;
        }
        .video-gallery {
          position: relative;
          max-width: 100%;
          margin: 0 auto;
          overflow: hidden;
        }
        .video-gallery-track {
          display: flex;
          gap: 24px;
          transition: transform 0.3s ease-in-out;
        }
        .video-gallery-item {
          flex: 0 0 calc((100% - 48px) / 3); /* 3 items avec 2 gaps de 24px */
        }
        .video-gallery-item img {
          width: 100%;
          height: 260px;
          object-fit: cover;
          border-radius: 12px;
        }
        .video-gallery-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          z-index: 10;
        }
        .video-gallery-btn.prev { left: 10px; }
        .video-gallery-btn.next { right: 10px; }
        .video-gallery-btn:disabled { opacity: 0.3; cursor: default; }
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
    
        ${embedUrl && videoGalleryPhotos.length ? `
        <div class="gallery-section">
            <hr style="border: none; border-top: 1px solid #ddd; margin-bottom: 25px;"/>
            <h2 style="font-size: 1.6rem; font-weight: 400; margin-bottom: 10px; color: ${embedUrl ? '#3c3c3c' : '#000'}">${t.galleryTitle}</h2>
            <p class="gallery-subtitle" style="margin-bottom: 28px; font-size: 1rem; color: #6a6a6a;">${t.gallerySubtitle}</p>
            <div class="video-gallery">
              <button class="video-gallery-btn prev" aria-label="${t.previous}">&#10094;</button>
              <div class="video-gallery-track">
                ${videoGalleryPhotos.map(photo => `
                  <div class="video-gallery-item"><img src="/uploads/${photo}" alt="${t.galleryAlt}" loading="lazy" /></div>
                `).join('')}
              </div>
              <button class="video-gallery-btn next" aria-label="${t.next}">&#10095;</button>
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

        // Logique du carrousel vidéo/photos
        const videoGalleryTrack = document.querySelector('.video-gallery-track');
        if (videoGalleryTrack) {
          const galleryItems = Array.from(videoGalleryTrack.querySelectorAll('.video-gallery-item'));
          const prevGallery = document.querySelector('.video-gallery-btn.prev');
          const nextGallery = document.querySelector('.video-gallery-btn.next');
          let galleryIndex = 0;

          const getVisibleGalleryItems = () => {
            if (window.innerWidth <= 640) return 1;
            if (window.innerWidth <= 1024) return 2;
            return 3;
          };

          const updateGallery = () => {
            if (!galleryItems.length) return;
            const style = getComputedStyle(videoGalleryTrack);
            const gap = parseFloat(style.columnGap || style.gap || '0');
            const itemWidth = galleryItems[0].getBoundingClientRect().width;
            const visible = getVisibleGalleryItems();
            const maxIndex = Math.max(0, galleryItems.length - visible);
            if (galleryIndex > maxIndex) {
              galleryIndex = maxIndex;
            }
            
            // 🔑 CORRECTION DU SYNTAXERROR: Utilisation de la concaténation standard
            videoGalleryTrack.style.transform = 'translateX(-' + (galleryIndex * (itemWidth + gap)) + 'px)';
            
            if (prevGallery) {
              prevGallery.disabled = galleryIndex === 0;
              prevGallery.style.display = galleryItems.length <= visible ? 'none' : '';
            }
            if (nextGallery) {
              nextGallery.disabled = galleryIndex >= maxIndex;
              nextGallery.style.display = galleryItems.length <= visible ? 'none' : '';
            }
          };

          if (nextGallery) {
            nextGallery.addEventListener('click', () => {
              const visible = getVisibleGalleryItems();
              const maxIndex = Math.max(0, galleryItems.length - visible);
              if (galleryIndex < maxIndex) {
                galleryIndex += 1;
                updateGallery();
              }
            });
          }

          if (prevGallery) {
            prevGallery.addEventListener('click', () => {
              if (galleryIndex > 0) {
                galleryIndex -= 1;
                updateGallery();
              }
            });
          }

          window.addEventListener('resize', updateGallery);
          updateGallery();
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
