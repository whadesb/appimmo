// lib/landing/index.js
// Source unique de génération des landing pages.
// Remplace les copies de generateLandingPage dans server.js et routes/property.js.

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const slugify = require('slugify');
const seoKeywords = require('../../utils/seoKeywords');

const TEMPLATE_PATH = path.join(__dirname, 'template.ejs');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'public', 'landing-pages');
const SITE_URL = process.env.SITE_URL || 'https://uap.immo';
const GTM_ID = process.env.GTM_ID || 'GTM-TF7HSC3N';

const THEMES = ['foret', 'marine', 'terre', 'pierre', 'bordeaux', 'encre'];

const translations = {
  fr: {
    adLabel: 'Annonce UAP Immo', propertyHeading: 'Propriété à', propertyType: 'Type de bien',
    yearBuilt: 'Année de construction', price: 'Prix de vente', pricePerSqm: 'le mètre carré',
    guidedTour: 'Le bien', addInfo: 'Informations complémentaires', keyInfo: 'Informations clés',
    equipment: 'Équipements', location: 'Localisation', energy: 'Performance énergétique',
    photos: 'Photos', morePhotos: 'photos', seeAllPhotos: 'Voir toutes les photos',
    scrollHint: 'Description, équipements et localisation',
    videoHint: 'Visite vidéo en lecture automatique',
    surfaceUnit: 'mètres carrés', roomsLabel: 'pièces', bedroomsLabel: 'chambres', yearLabel: 'année',
    pool: 'Piscine', wateringSystem: 'Arrosage automatique', carShelter: 'Abri voiture',
    parking: 'Parking', caretakerHouse: 'Maison de gardien', electricShutters: 'Volets électriques',
    outdoorLighting: 'Éclairage extérieur', doubleGlazing: 'Double vitrage', barbecue: 'Barbecue',
    visit: 'Demander une visite', yes: 'Oui', no: 'Non', notProvided: 'Non renseignée',
    noDescription: 'Aucune description fournie.', mapUnavailable: 'Carte non disponible.',
    inProgress: 'Diagnostic en cours', addressNote: 'Adresse exacte communiquée lors de la prise de rendez-vous.',
    publishedBy: 'Annonce publiée via UAP Immo', legal: 'Mentions légales', terms: "Conditions d'utilisation",
    enableSound: 'Activer le son'
  },
  en: {
    adLabel: 'UAP Real Estate listing', propertyHeading: 'Property in', propertyType: 'Property type',
    yearBuilt: 'Year built', price: 'Asking price', pricePerSqm: 'per square metre',
    guidedTour: 'The property', addInfo: 'Additional information', keyInfo: 'Key information',
    equipment: 'Features', location: 'Location', energy: 'Energy performance',
    photos: 'Photos', morePhotos: 'photos', seeAllPhotos: 'View all photos',
    scrollHint: 'Description, features and location',
    videoHint: 'Video tour playing',
    surfaceUnit: 'square metres', roomsLabel: 'rooms', bedroomsLabel: 'bedrooms', yearLabel: 'built',
    pool: 'Swimming pool', wateringSystem: 'Automatic watering', carShelter: 'Car shelter',
    parking: 'Parking', caretakerHouse: "Caretaker's house", electricShutters: 'Electric shutters',
    outdoorLighting: 'Outdoor lighting', doubleGlazing: 'Double glazing', barbecue: 'Barbecue',
    visit: 'Request a viewing', yes: 'Yes', no: 'No', notProvided: 'Not provided',
    noDescription: 'No description provided.', mapUnavailable: 'Map unavailable.',
    inProgress: 'Assessment in progress', addressNote: 'Exact address shared when booking a viewing.',
    publishedBy: 'Listed via UAP Immo', legal: 'Legal notice', terms: 'Terms of use',
    enableSound: 'Enable sound'
  }
};

function getEmbedUrl(url) {
  if (!url) return '';
  const match = String(url).match(/(?:youtube\.com\/.*v=|youtu\.be\/)([^&?/]+)/);
  if (!match || !match[1]) return '';
  const id = match[1];
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return '';
  return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&mute=1&controls=0&showinfo=0`;
}

function buildViewModel(property) {
  const lang = translations[property.language] ? property.language : 'fr';
  const t = translations[lang];
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';

  const city = property.city || '';
  const country = property.country || '';
  const slug = slugify(`${property.propertyType || 'bien'}-${city}-${country}`, { lower: true, strict: true });
  const filename = `${property._id}-${slug}.html`;
  const fullUrl = `${SITE_URL}/landing-pages/${filename}`;

  const embedUrl = getEmbedUrl(property.videoUrl);
  // Le modèle demandé fait foi ; repli sur la galerie si la vidéo est absente ou invalide.
  const layout = property.layout === 'video' && embedUrl ? 'video' : 'photo';

  const theme = THEMES.includes(property.theme) ? property.theme : 'foret';

  const photos = Array.isArray(property.photos) ? property.photos.filter(Boolean) : [];
  const price = Number(property.price || 0);
  const surface = Number(property.surface || 0);

  const keywordsList = (seoKeywords[lang] && seoKeywords[lang][country]) || [];
  const keywords = keywordsList.slice(0, 3);

  const description = property.description || '';
  const metaDescription = description.slice(0, 160);

  const features = [
    { on: property.pool, label: t.pool },
    { on: property.parking, label: t.parking },
    { on: property.carShelter, label: t.carShelter },
    { on: property.wateringSystem, label: t.wateringSystem },
    { on: property.electricShutters, label: t.electricShutters },
    { on: property.outdoorLighting, label: t.outdoorLighting },
    { on: property.caretakerHouse, label: t.caretakerHouse },
    { on: property.doubleGlazing, label: t.doubleGlazing },
    { on: property.barbecue, label: t.barbecue }
  ].filter(f => f.on).map(f => f.label);

  const dpe = String(property.dpe || '').trim();
  const dpePending = dpe.toLowerCase() === 'en cours' || dpe === '';

  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: `${property.propertyType || ''} à vendre à ${city}`.trim(),
    description: metaDescription,
    address: { '@type': 'PostalAddress', addressLocality: city, postalCode: property.postalCode || '', addressCountry: country },
    floorSize: { '@type': 'QuantitativeValue', value: surface, unitCode: 'MTK' },
    numberOfRooms: property.rooms || 1,
    photo: photos.map(p => `${SITE_URL}/uploads/${p}`),
    url: fullUrl
  };

  return {
    t, lang, locale, theme, layout, embedUrl,
    property, city, country, photos,
    price, surface,
    priceLabel: price.toLocaleString(locale),
    pricePerSqm: surface > 0 ? Math.round(price / surface).toLocaleString(locale) : null,
    features, dpe, dpePending,
    metaDescription, keywords, fullUrl, filename, jsonLD,
    siteUrl: SITE_URL, gtmId: GTM_ID,
    contactName: [property.contactFirstName, property.contactLastName].filter(Boolean).join(' '),
    contactPhone: property.contactPhone || '',
    initials: [property.contactFirstName, property.contactLastName]
      .filter(Boolean).map(s => s.charAt(0).toUpperCase()).join('')
  };
}

async function renderLandingPage(property) {
  const view = buildViewModel(property);
  const html = await ejs.renderFile(TEMPLATE_PATH, view, { async: true });
  return { html, filename: view.filename, fullUrl: view.fullUrl };
}

async function generateLandingPage(property) {
  const { html, filename, fullUrl } = await renderLandingPage(property);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), html, 'utf8');
  return { url: `/landing-pages/${filename}`, filename, fullUrl };
}

module.exports = { generateLandingPage, renderLandingPage, buildViewModel, THEMES, translations };
