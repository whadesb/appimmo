require('dotenv').config();

process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});

// Gérer les promesses rejetées non gérées
process.on('unhandledRejection', function (err, promise) {
  console.error('Unhandled Rejection:', err);
});

const express = require('express');
const path = require('path');
const helmet = require('helmet'); 
const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const User = require('./models/User');
const Property = require('./models/Property');
const Order = require('./models/Order');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const i18n = require('./i18n');
const compression = require('compression');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { spawn } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const { getPageStats } = require('./getStats');
const Page = require('./models/Page');
const nodemailer = require('nodemailer');
const { manager, trainChatbot } = require('./utils/chatbot');
const mongoSanitize = require('express-mongo-sanitize');
const { getMultiplePageStats } = require('./getStats');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const invalidLocales = [
    'favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php',
    'config', '.env', 'server_info.php', 'wp-config.php', 'index.js', 'settings.py'
];
const tempAuthStore = {}; // { sessionId: user }
const pdfRoutes = require('./routes/pdf');
const LandingPage = require('./models/Page'); // nom du fichier réel
const qrRoutes = require('./routes/qr');
const secretKey = process.env.RECAPTCHA_SECRET_KEY;
const { 
    sendInvoiceByEmail, 
    sendMailPending, 
    generateInvoicePDF, 
    sendAdminNewUser,     
    sendAdminNewProperty,  
    sendAdminNewOrder      
} = require('./utils/email');
const supportedLocales = ['fr', 'en'];
const { addToSitemap, pingSearchEngines } = require('./utils/seo');
const { generateLandingPage } = require('./lib/landing');

const app = express();
app.set('trust proxy', true);
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
      scriptSrc: [
    "'self'", 
    "https://www.googletagmanager.com", 
        "https://unpkg.com",
    "https://www.google-analytics.com", 
    "https://www.google.com", 
    "https://www.gstatic.com", 
    "https://www.paypalobjects.com", 
    "https://cdnjs.cloudflare.com",
    
    // 👇 CETTE LIGNE EST OBLIGATOIRE POUR BOOTSTRAP CDN 👇
    "https://cdn.jsdelivr.net", 
    
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com",
    "https://mainnet.demo.btcpayserver.org",
    "'unsafe-inline'", 
    "'unsafe-eval'"
],
        styleSrc: [
            "'self'", 
            "https://pro.fontawesome.com", 
            "https://unpkg.com", 
            "https://cdn.jsdelivr.net", 
            "https://fonts.googleapis.com", 
            "https://cdnjs.cloudflare.com",
            "https://mainnet.demo.btcpayserver.org", // <== AJOUT BTCPAY (Styles modale)
            "'unsafe-inline'"
        ],
        imgSrc: [
            "'self'", 
            "data:", 
            "https://flagcdn.com", 
            "https://www.google-analytics.com", 
            "https://www.paypalobjects.com",
            "https://www.paypal.com", 
            "https://t.paypal.com",
            "https://*.basemaps.cartocdn.com",
            "https://*.openstreetmap.org",
          "https://*.tile.openstreetmap.org",
            "https://mainnet.demo.btcpayserver.org" // <== AJOUT BTCPAY (QR Codes)
        ],
        connectSrc: [
            "'self'", 
            "https://www.google-analytics.com",
            "https://region1.google-analytics.com", 
            "https://nominatim.openstreetmap.org", 
            "https://www.google.com",
            "https://cdn.jsdelivr.net",
            "https://www.paypal.com",
            "https://www.sandbox.paypal.com",
            "https://mainnet.demo.btcpayserver.org" // <== AJOUT BTCPAY (API)
        ],
        frameSrc: [
            "'self'", 
            "https://www.youtube.com", 
            "https://www.google.com", 
            "https://www.recaptcha.net",
            "https://www.paypal.com",
            "https://www.sandbox.paypal.com",
            "https://mainnet.demo.btcpayserver.org" // <== AJOUT BTCPAY (Iframe)
        ],
        fontSrc: [
            "'self'", 
            "https://pro.fontawesome.com", 
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"], 
        formAction: [
            "'self'", 
            "https://www.paypal.com", 
            "https://www.sandbox.paypal.com",
            "https://mainnet.demo.btcpayserver.org" // <== AJOUT BTCPAY (Redirections)
        ] 
    }
}));
function getPaypalConfig() {
  const isLive = process.env.PAYPAL_ENV === 'live';
  return {
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: isLive ? process.env.PAYPAL_CLIENT_ID_LIVE : process.env.PAYPAL_CLIENT_ID_SANDBOX,
    secret:   isLive ? process.env.PAYPAL_SECRET_LIVE   : process.env.PAYPAL_SECRET_SANDBOX,
    webhookId:isLive ? process.env.PAYPAL_WEBHOOK_ID_LIVE: process.env.PAYPAL_WEBHOOK_ID_SANDBOX
  };
}
async function getPaypalAccessToken() {
  const cfg = getPaypalConfig();
  const { data } = await axios.post(
    `${cfg.baseUrl}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: cfg.clientId, password: cfg.secret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return data.access_token;
}

async function resolveCaptureIdFromOrder(orderID) {
  const cfg = getPaypalConfig();
  const accessToken = await getPaypalAccessToken();

  const { data } = await axios.get(
    `${cfg.baseUrl}/v2/checkout/orders/${orderID}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const cap = data?.purchase_units?.[0]?.payments?.captures?.[0];
  return cap?.id || null;
}

// Middleware
app.use(compression());
app.use(cookieParser());
app.use('/paypal/webhook', express.raw({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(mongoSanitize({
  // Optionnel: Empêche l'injection de $ dans les query params
  allowDots: true, 
}));
app.use(flash());
app.use(i18n.init);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { 
      maxAge: 1000 * 60 * 60 * 2, 
      
      // 🔑 CORRECTION CRITIQUE : Passer à false car Node voit du HTTP en interne
      secure: false, 
      
      sameSite: 'Lax',
      httpOnly: true
  }
}));
app.use('/', qrRoutes);
app.use('/property', require('./routes/property'));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({
  usernameField: 'email'
}, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ Connected to MongoDB');


}).catch((err) => {
  console.error('❌ Error connecting to MongoDB', err);
});

function isAuthenticatedJson(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ success: false, message: 'Non authentifié' });
}

// Middleware : prolonger la session active
app.use((req, res, next) => {
  const path = req.path;

  if (req.session && req.session.touch && req.isAuthenticated && req.isAuthenticated()) {
    req.session.touch();
  }

  next();
});

trainChatbot();
// Middleware : définir la locale en fonction de l’URL
app.use((req, res, next) => {
  const path = req.path;

  const ignoredPaths = [
    '/check-email',
    '/api',
    '/webhook',
    '/uploads',
  ];

  if (ignoredPaths.some(prefix => path.startsWith(prefix))) {
    return next();
  }

  const firstSegment = path.split('/')[1];
  req.locale = ['fr', 'en'].includes(firstSegment) ? firstSegment : 'fr';

  next();
});

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated?.() || false;
  res.locals.user = req.user || null;
  next();
});
app.get('/check-email', async (req, res) => {
  try {
    const email = req.query.email;
    const user = await User.findOne({ email });
    res.json({ exists: !!user });
  } catch (err) {
    console.error('Erreur dans /check-email:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// Middleware de déconnexion automatique après expiration de la session
app.use((req, res, next) => {
  const isExpired = req.session?.cookie?.expires < new Date();

  if (isExpired) {
    req.logout((err) => {
      if (err) return next(err);

      req.session.destroy((err) => {
        if (err) return next(err);

        res.clearCookie('connect.sid');

        // Détection de la langue à partir de l'URL visitée ou cookie
        let locale = req.cookies.locale || req.acceptsLanguages('en', 'fr') || 'fr';
        const urlLocale = req.originalUrl.split('/')[1];
        if (['fr', 'en'].includes(urlLocale)) {
          locale = urlLocale;
        }

        // Redirige proprement vers la bonne page de login
        res.redirect(`/${locale}/login`);
      });
    });
  } else {
    next();
  }
});



app.get('/user', (req, res) => {
  // Si l'utilisateur est authentifié, on redirige vers la bonne locale
  const locale = req.user?.locale || 'fr';
  return res.redirect(`/${locale}/user`);
});
app.post('/logout', isAuthenticated, (req, res) => {
  req.logout(() => {
    res.redirect(`/${req.locale || 'fr'}/login`);
  });
});


// Middleware d'authentification
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  
  // 🔑 CONTRÔLE DE SYNCHRONISATION CRITIQUE : 
  // Vérifier si l'ID utilisateur est présent dans l'objet session brut de Passport.
  if (req.session?.passport?.user) {
      // L'ID est là, forcer la désérialisation de l'utilisateur avant de continuer
      // (Cela permet d'atténuer la race condition)
      return next(); 
  }
  
  // Si aucune session n'est trouvée, rediriger
  const locale = req.params.locale || req.locale || req.cookies.locale || 'fr';
  return res.redirect(`/${locale}/login`);
}


function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    console.warn('Accès administrateur refusé pour l’utilisateur :', req.user?.email || req.user?._id);
  }

  if (req.accepts && req.accepts('json')) {
    return res.status(403).json({ success: false, message: 'Accès administrateur requis' });
  }

  return res.status(403).send('Accès refusé');
}


// Configuration de multer pour la gestion des fichiers uploadés
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo par fichier
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées !'));
    }
  }
});


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



app.get('/', (req, res) => {
    const acceptedLanguages = req.acceptsLanguages(); // Langues acceptées par le navigateur
    const defaultLocale = 'fr'; // Langue par défaut

    // Vérifier si l'utilisateur préfère l'anglais
    if (acceptedLanguages.includes('en')) {
        res.redirect('/en');
    } else {
        res.redirect(`/${defaultLocale}`); // Rediriger vers la langue par défaut (français)
    }
});

app.get('/api/stats/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const startDate = req.query.startDate || '2024-03-01';
    const endDate = req.query.endDate || '2025-03-21';

    const matchingProperty = await Property.findOne({ _id: pageId, userId: req.user._id });

    if (!matchingProperty) {
      return res.status(404).json({ error: 'Propriété non trouvée' });
    }

    if (!matchingProperty.url) {
      return res.status(500).json({ error: 'Champ "url" manquant' });
    }

    const pagePath = matchingProperty.url.startsWith('/landing-pages/')
      ? matchingProperty.url
      : `/landing-pages/${matchingProperty.url}`;

    const stats = await getPageStats(pagePath, startDate, endDate);

    if (!stats || typeof stats !== 'object') {
      console.error('❌ Statistiques non valides pour :', pagePath, stats);
      return res.status(500).json({ error: 'Statistiques non valides' });
    }

    // Supprimé : console.log('✅ Stats récupérées :', stats);
    return res.json(stats);

  } catch (err) {
    console.error('❌ Erreur API /api/stats/:pageId =>', err.message || err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

app.get('/:locale/payment', isAuthenticated, async (req, res) => {
  const { locale } = req.params;
  const { propertyId } = req.query;

  try {
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).send('Property not found');
    }

    const translationsPath = `./locales/${locale}/payment.json`;
    let i18n = {};
    try {
      i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
      console.error(`Erreur lors du chargement des traductions pour ${locale}:`, error);
      return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    const cfg = getPaypalConfig();

    res.render('payment', {
      locale,
      i18n,
      propertyId: property._id,
      rooms: property.rooms,
      surface: property.surface,
      price: property.price,
      city: property.city,
      country: property.country,
      url: property.url,
      currentPath: req.originalUrl,
      PAYPAL_CLIENT_ID: cfg.clientId,
      // 🔑 AJOUT : On passe l'utilisateur complet à la vue pour afficher ses infos
      user: req.user 
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).send('Error fetching property');
  }
});


app.get('/:locale', (req, res, next) => {
    const locale = req.params.locale;

    // Liste des routes qui ne doivent PAS être interprétées comme des locales
 const excludedPaths = [
        'favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php',
        'config', '.env', 'server_info.php', 'wp-config.php', 'index.js', 'settings.py',
        'crossdomain.xml', 'clientaccesspolicy.xml', 'security.txt',
        // AJOUT DE robots.txt POUR ÉVITER LES AVERTISSEMENTS
        'robots.txt', 
        'login', 'register', 'user', 'forgot-password', 'reset-password', 'contact', 'politique-confidentialite'
    ];
    // Si la route est exclue, on passe au middleware suivant
    if (excludedPaths.includes(locale)) {
        return next();
    }

    // Vérifier si la locale est bien 'fr' ou 'en', sinon rediriger vers 'fr'
    const validLocales = ['fr', 'en'];
    if (!validLocales.includes(locale)) {
        console.warn(`🔍 Valeur de locale invalide : ${locale}, utilisation de 'fr' par défaut.`);
        return res.redirect('/fr');
    }

    // Charger les traductions
    const translationsPath = `./locales/${locale}/index.json`;
    let translations = {};

    try {
        translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    // Affichage de la page index avec la langue correcte
   res.render('index', {
    locale: locale,
    i18n: translations,
    user: req.user || null,
currentPath: req.originalUrl 
});

});


app.get('/:locale/verify-2fa', async (req, res) => {
    const locale = req.params.locale || 'fr';
    const translationsPath = `./locales/${locale}/2fa.json`;
    let i18n = {};

    try {
        i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur chargement traductions 2FA:`, error);
        return res.status(500).send('Erreur chargement traductions');
    }

    if (!req.session.tmpUserId) {
        return res.redirect(`/${locale}/login`);
    }

    res.render('2fa', {
    locale,
    i18n,
    error: 'Code invalide. Veuillez réessayer.' // ← affiché dans la vue
});
});
app.post('/disable-2fa', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur lors de la désactivation 2FA :", err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});



// Middleware : accessible uniquement SI connecté
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    // Si la session brute a été trouvée par isAuthenticated, next() sera appelé et la désérialisation tentée.
    // Si la session est toujours perdue (isAuthenticated a fait la redirection), on procède à la déconnexion
    
    if (req.session?.passport?.user) {
        // La session est en cours de désérialisation, laissons le flux continuer
        return next();
    }
    
    req.flash('error', 'Votre session a expiré. Veuillez vous reconnecter.');
    res.redirect(`/${req.params.locale || 'fr'}/login`);
}

// Middleware : accessible uniquement SI NON connecté
function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }
  res.redirect(`/${req.params.locale || 'fr'}/dashboard`); // ou autre page pour les membres
}

app.get('/:locale/login', (req, res) => {
    const locale = req.params.locale || 'fr';
    const translationsPath = `./locales/${locale}/login.json`;
    let i18n = {};

    try {
        i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions pour ${locale}:`, error);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

        res.render('login', {
  locale,
  i18n,
  messages: req.flash(),
  currentPath: req.path // 👈 ici !
});

});


app.get('/stats/:urlPath', async (req, res) => {
    const urlPath = '/' + req.params.urlPath; // Exemple : "/landing-pages/page123.html"
    const views = await getPageViews(urlPath);
    res.json({ views });
});

app.get('/:lang/forgot-password', (req, res) => {
  const locale = req.params.lang;
  const passwordResetTranslationsPath = `./locales/${locale}/password-reset.json`;

  let passwordResetTranslations = {};

  try {
    passwordResetTranslations = JSON.parse(fs.readFileSync(passwordResetTranslationsPath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lors du chargement des traductions : ${error}`);
    return res.status(500).send('Erreur lors du chargement des traductions.');
  }

  // Rendre la page avec les traductions spécifiques à la langue choisie
  res.render('forgot-password', {
    title: passwordResetTranslations.title,
    locale: locale,  // Langue active
    i18n: passwordResetTranslations,  // Traductions spécifiques
    messages: req.flash(),
currentPath: req.originalUrl 
  });
});

// Redirection par défaut
app.get('/forgot-password', (req, res) => {
  res.redirect('/fr/forgot-password');
});


// Route pour la politique de confidentialité
app.get('/politique-confidentialite', (req, res) => {
  res.render('politique-confidentialite', { title: 'Politique de confidentialité' });
});

// Route pour gérer les cookies
app.get('/gerer-cookies', (req, res) => {
  res.render('gerer-cookies', { title: 'Gérer les cookies' });
});

app.post('/:lang/forgot-password', async (req, res) => {
  const { email } = req.body;
  const locale = req.params.lang;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Aucun compte trouvé avec cette adresse email.');
      return res.redirect(`/${locale}/forgot-password`);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
    user.resetPasswordCode = code;
    await user.save();

    const resetUrl = `http://${req.headers.host}/${locale}/reset-password/${token}`;
    await sendPasswordResetEmail(user, locale, resetUrl, code);

    req.flash('success', 'Un email avec des instructions pour réinitialiser votre mot de passe a été envoyé.');
    return res.redirect(`/${locale}/forgot-password?emailSent=true`);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    req.flash('error', 'Une erreur est survenue lors de la réinitialisation du mot de passe.');
    return res.redirect(`/${locale}/forgot-password`);
  }
});

app.get('/reset-password/:token', async (req, res) => {
  const locale = req.locale || 'fr';
  return res.redirect(`/${locale}/reset-password/${req.params.token}`);
});

app.get('/:lang/reset-password/:token', async (req, res) => {
  const locale = req.params.lang;
  const translationsPath = `./locales/${locale}/password-reset.json`;
  let i18n = {};
  try {
    i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Le token de réinitialisation est invalide ou a expiré.');
      return res.redirect('/forgot-password');
    }

    res.render('reset-password', {
      token: req.params.token,
      locale,
      i18n,
      messages: req.flash(),
      currentPath: req.originalUrl
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du token :', error);
    req.flash('error', 'Une erreur est survenue lors de la vérification du token.');
    res.redirect(`/${locale}/forgot-password`);
  }
});

app.post('/reset-password/:token', async (req, res) => {
  const locale = req.locale || 'fr';
  return res.redirect(`/${locale}/reset-password/${req.params.token}`);
});

// REMPLACEZ l'ancienne fonction app.post('/:lang/reset-password/:token', ...) par celle-ci

app.post('/:lang/reset-password/:token', async (req, res) => {
  const { password, confirmPassword, code } = req.body;
  const locale = req.params.lang;
  const resetUrl = `/${locale}/reset-password/${req.params.token}`; // URL de la page actuelle

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Le token de réinitialisation est invalide ou a expiré.');
      return res.redirect(`/${locale}/forgot-password`);
    }

    // --- LOGIQUE CORRIGÉE ---
    
    // 1. VÉRIFIER LE CODE D'ABORD
    if (user.resetPasswordCode !== code) {
      req.flash('error', locale === 'fr' ? 'Code de vérification incorrect.' : 'Invalid verification code.');
      return res.redirect(resetUrl); // Redirige vers la page actuelle
    }

    // 2. VÉRIFIER LES MOTS DE PASSE ENSUITE
    if (password !== confirmPassword) {
      req.flash('error', 'Les mots de passe ne correspondent pas.');
      return res.redirect(resetUrl); // Redirige vers la page actuelle
    }

    // 3. SI TOUT EST BON, METTRE À JOUR
    user.setPassword(password, async (err) => {
      if (err) {
        req.flash('error', 'Erreur lors de la réinitialisation du mot de passe.');
        return res.redirect(resetUrl); // Redirige vers la page actuelle
      }

      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.resetPasswordCode = undefined;
      await user.save();

      req.flash('success', 'Votre mot de passe a été mis à jour avec succès.');
      res.redirect(`/${locale}/login`);
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe :', error);
    req.flash('error', 'Une erreur est survenue lors de la mise à jour du mot de passe.');
    res.redirect(`/${locale}/forgot-password`);
  }
});
app.get('/api/stats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate = '30daysAgo', endDate = 'today' } = req.query;

    const property = await Property.findOne({ _id: id, userId: req.user._id });
    if (!property) return res.status(404).json({ error: 'Propriété non trouvée' });

    const pagePath = property.url.startsWith('/landing-pages/')
      ? property.url
      : `/landing-pages/${property.url}`;

    const stats = await getPageStats(pagePath, startDate, endDate);

    if (!stats || typeof stats !== 'object') {
      console.error('❌ Statistiques non valides pour :', pagePath, stats);
      return res.status(500).json({ error: 'Statistiques non valides' });
    }

    res.json(stats);
  } catch (error) {
    console.error('❌ Erreur API /api/stats/:id =>', error.message || error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// DANS server.js
app.post('/:locale/login', (req, res, next) => {
    const locale = req.params.locale || 'fr';

    passport.authenticate('local', (err, user, info) => {
        // 1. Gestion des erreurs techniques
        if (err) {
            console.error('❌ ERREUR AUTHENTICATION PASSPORT:', err);
            return next(err);
        }
        
        // 2. Gestion des mauvais identifiants
        if (!user) {
            console.warn('⚠️ CONNEXION ÉCHOUÉE: Identifiants incorrects.', info);
            req.flash('error', 'Identifiants incorrects.');
            return res.redirect(`/${locale}/login`);
        }
        
        console.log(`✅ AUTHENTIFICATION RÉUSSIE pour: ${user.email}.`);

        // 3. CAS AVEC 2FA ACTIVÉE
        if (user.twoFactorEnabled) {
            // On déconnecte toute session précédente par sécurité
            req.logout(() => {
                // 🔑 CRÉATION DU COOKIE TEMPORAIRE (SECURE: FALSE pour passer le proxy)
                res.cookie('2fa_pending_id', user._id.toString(), {
                    maxAge: 300000, // 5 minutes
                    httpOnly: true, 
                    secure: false, // 🔑 IMPORTANT: false pour éviter le blocage proxy
                    sameSite: 'Lax'
                });
                
                console.log('➡️ 2FA requise. Cookie temporaire défini. Redirection vers /2fa.');
                return res.redirect(`/${locale}/2fa`);
            });
            return; 
        }

        // 4. CAS SANS 2FA (Connexion standard)
        req.logIn(user, (err) => {
            if (err) {
                console.error('❌ ERREUR REQ.LOGIN:', err);
                return next(err);
            }
            // Sauvegarde forcée de la session avant redirection
            req.session.save((saveErr) => {
                if (saveErr) return next(saveErr);
                console.log('✅ CONNEXION TERMINÉE (Sans 2FA). Redirection vers /user.');
                return res.redirect(`/${locale}/user`);
            });
        });
    })(req, res, next);
});
// Route pour enregistrer le choix de l'utilisateur concernant la durée du consentement
app.post('/set-cookie-consent', (req, res) => {
    const { duration } = req.body; // Récupère la durée choisie par l'utilisateur

    // Définir la durée en jours
    let maxAge;
    switch(duration) {
        case '3mois':
            maxAge = 90 * 24 * 60 * 60 * 1000; // 3 mois
            break;
        case '6mois':
            maxAge = 180 * 24 * 60 * 60 * 1000; // 6 mois
            break;
        case '2ans':
            maxAge = 2 * 365 * 24 * 60 * 60 * 1000; // 2 ans
            break;
        case '3ans':
            maxAge = 3 * 365 * 24 * 60 * 60 * 1000; // 3 ans
            break;
        case '1an':
        default:
            maxAge = 365 * 24 * 60 * 60 * 1000; // 1 an par défaut
            break;
    }

    // Enregistrement du cookie pour la durée choisie
    res.cookie('cookie_consent', 'accepted', { maxAge: maxAge, httpOnly: true });
    res.json({ message: 'Consentement enregistré', maxAge: maxAge });
});


app.get('/:locale/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie('connect.sid');
            // Redirige vers la page de login avec la bonne langue
            res.redirect(`/${req.params.locale}/login`);
        });
    });
});

// Assurez-vous que mongoose est accessible (const mongoose = require('mongoose');)

app.get('/:locale/user', ensureAuthenticated, async (req, res) => {
  const { locale } = req.params;
  const user = req.user;

  if (!user) {
    return res.redirect(`/${locale}/login`);
  }

  // --- LOGIQUE ADMIN POUR LA VUE GLOBALE ---
  let adminUsers = [];
  let adminOrders = [];
  let adminProperties = []; // Initialisation ici
  
  const isAdminUser = user && user.role === 'admin';
  const UserModel = mongoose.model('User'); 
  const PropertyModel = mongoose.model('Property'); // Récupération du modèle Property

  if (isAdminUser) {
      try {
          // 1. RÉCUPÉRATION DES UTILISATEURS
          adminUsers = await UserModel.find({}).sort({ createdAt: -1 }).lean(); 
          
          // 2. RÉCUPÉRATION DES PROPRIÉTÉS (LE FIX)
          adminProperties = await PropertyModel.find({}) 
              .sort({ createdAt: -1 })
              .lean();
          // Supprimé : console.log(`[ROUTE USER] Propriétés Admin chargées : ${adminProperties.length}`);

          // 3. RÉCUPÉRATION DES COMMANDES
          adminOrders = await Order.find({})
              .sort({ paidAt: -1, createdAt: -1 })
              .populate('userId', 'firstName lastName email')
              .lean();
          
      } catch (e) {
          console.error("Erreur Mongoose dans la route /user lors de la récup. admin:", e);
      }
  }
  // --- FIN LOGIQUE ADMIN ---

  // ✅ Récupération des propriétés de l'utilisateur connecté (logique existante)
  let userLandingPages = await Property.find({ userId: user._id });

  // ✅ Récupération des traductions (logique existante)
  const userTranslationsPath = `./locales/${locale}/user.json`;
  let userTranslations = {};
  try {
      userTranslations = JSON.parse(fs.readFileSync(userTranslationsPath, 'utf8'));
  } catch (error) {
      console.error(`Erreur lors du chargement des traductions : ${error}`);
  }

  // ✅ Calcul des statistiques (logique existante)
  const statsArray = await Promise.all(
      userLandingPages.map(async (property) => {
          const stats = await getPageStats(property.url);
          return {
              page: property.url,
              ...stats
          };
      })
  );

  res.render('user', {
      locale,
      user,
      i18n: userTranslations,
      currentPath: req.originalUrl,
      userLandingPages,
      stats: statsArray,
      currentUser: user,
      
      // 🔑 PASSAGE DES VARIABLES ADMINISTRATEUR :
      adminUsers: adminUsers, 
      adminOrders: adminOrders, 
      adminProperties: adminProperties, // <<--- Maintenant rempli ici
      isAdminUser: isAdminUser, 
      
      activeSection: 'account' // Section par défaut
  });
});

app.get('/admin/users', isAuthenticated, isAdmin, async (req, res, next) => {
    const locale = req.user?.locale || req.locale || 'fr';
    const user = req.user;
    const isAdminUser = true;

    // 1. Définir les variables comme vides avant le bloc try
    let userLandingPages = [];
    let statsArray = [];
    let userTranslations = {};
    let adminUsers = []; // Initialisation pour le try/catch
    let adminOrders = [];
    let adminProperties = [];

    try {
        // 2. Récupération des traductions (la logique est OK)
        const userTranslationsPath = `./locales/${locale}/user.json`;
        try {
            userTranslations = JSON.parse(fs.readFileSync(userTranslationsPath, 'utf8'));
        } catch (error) {
            console.error(`Erreur lors du chargement des traductions : ${error}`);
        }

        // 3. Récupération de TOUS les utilisateurs (la requête critique)
        const UserModel = mongoose.model('User');
        adminUsers = await UserModel.find({}).sort({ createdAt: -1 }).lean(); // On utilise lean() pour la robustesse

        adminOrders = await Order.find({})
            .sort({ paidAt: -1, createdAt: -1 })
            .populate('userId', 'firstName lastName email')
            .lean();


        res.render('user', {
            locale,
            user,
            i18n: userTranslations, // Doit être passé après chargement
            currentPath: req.originalUrl,
            userLandingPages,       // Tableau vide si non calculé
            stats: statsArray,       // Tableau vide
            currentUser: user,
            adminUsers,             // Le tableau rempli (taille 6)
            adminOrders,
            adminProperties,
            activeSection: 'admin-users',
            isAdminUser: isAdminUser
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs admin :', error);
        next(error);
    }
});



app.get('/admin/download-photos/:propertyId', isAuthenticated, isAdmin, async (req, res) => {
    const { propertyId } = req.params;
    let tempDir;
    let zipPath;

    try {
        const property = await Property.findById(propertyId).lean();

        if (!property || !Array.isArray(property.photos) || property.photos.length === 0) {
            return res.status(404).send('Aucune photo trouvée pour cette propriété.');
        }

        const uploadsDir = path.join(__dirname, 'public/uploads');
        const filesToArchive = property.photos.reduce((acc, filename) => {
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                acc.push(filePath);
            } else {
                console.warn(`Fichier photo manquant: ${filePath}`);
            }
            return acc;
        }, []);

        if (filesToArchive.length === 0) {
            return res.status(404).send('Aucune photo disponible pour cette propriété.');
        }

        const zipName = `photos-propriete-${propertyId}.zip`;
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'appimmo-'));
        zipPath = path.join(tempDir, zipName);

        const zipArgs = ['-j', '-q', zipPath, '--', ...filesToArchive];

        await new Promise((resolve, reject) => {
            const zipProcess = spawn('zip', zipArgs);
            zipProcess.on('error', reject);
            zipProcess.stderr.on('data', (data) => {
                console.error('zip stderr:', data.toString());
            });
            zipProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`zip process exited with code ${code}`));
                }
            });
        });

        return res.download(zipPath, zipName, async (err) => {
            try {
                if (zipPath) {
                    await fs.promises.unlink(zipPath);
                }
            } catch (cleanupError) {
                if (cleanupError && cleanupError.code !== 'ENOENT') {
                    console.warn('Erreur lors de la suppression du ZIP temporaire :', cleanupError);
                }
            }

            try {
                if (tempDir) {
                    await fs.promises.rm(tempDir, { recursive: true, force: true });
                }
            } catch (cleanupError) {
                if (cleanupError && cleanupError.code !== 'ENOENT') {
                    console.warn('Erreur lors de la suppression du dossier temporaire :', cleanupError);
                }
            }

            if (err) {
                console.error('Erreur lors de l\'envoi du ZIP :', err);
                if (!res.headersSent) {
                    res.status(500).send('Erreur lors de l\'envoi du fichier.');
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du ZIP de photos :', error);

        try {
            if (zipPath) {
                await fs.promises.unlink(zipPath);
            }
        } catch (cleanupError) {
            if (cleanupError && cleanupError.code !== 'ENOENT') {
                console.warn('Erreur lors du nettoyage du ZIP temporaire :', cleanupError);
            }
        }

        try {
            if (tempDir) {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            if (cleanupError && cleanupError.code !== 'ENOENT') {
                console.warn('Erreur lors du nettoyage du dossier temporaire :', cleanupError);
            }
        }

        return res.status(500).send('Erreur interne du serveur lors du téléchargement des photos.');
    }
});


// Route GET pour télécharger toutes les photos d'une propriété en ZIP
app.get('/admin/download-photos/:propertyId', isAuthenticated, isAdmin, async (req, res) => {
    const { propertyId } = req.params;
    let tempDir;
    let zipPath;

    try {
        // 1. Récupérer les informations de la propriété (inclut le tableau 'photos')
        const property = await Property.findById(propertyId).lean();

        if (!property || !Array.isArray(property.photos) || property.photos.length === 0) {
            return res.status(404).send('Aucune photo trouvée pour cette propriété.');
        }

        // 2. Construire la liste des chemins de fichiers réels
        // Votre code d'upload utilise 'public/uploads'
        const uploadsDir = path.join(__dirname, 'public/uploads'); 
        
        const filesToArchive = property.photos.reduce((acc, filename) => {
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                acc.push(filePath);
            } else {
                console.warn(`Fichier photo manquant: ${filePath}`);
            }
            return acc;
        }, []);

        if (filesToArchive.length === 0) {
            return res.status(404).send('Aucune photo disponible pour cette propriété.');
        }

        // 3. Créer un répertoire temporaire et le chemin du fichier ZIP
        const zipName = `photos-propriete-${propertyId}.zip`;
        // Utilisez fs.promises.mkdtemp qui est asynchrone
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'appimmo-'));
        zipPath = path.join(tempDir, zipName);

        // 4. Exécuter la commande 'zip' pour créer l'archive
        const zipArgs = ['-j', '-q', zipPath, '--', ...filesToArchive];

        await new Promise((resolve, reject) => {
            // Utiliser 'spawn' pour exécuter la commande zip
            const zipProcess = spawn('zip', zipArgs);
            
            // Log les erreurs de la commande zip
            zipProcess.stderr.on('data', (data) => {
                console.error('zip stderr:', data.toString());
            });
            
            zipProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`zip process exited with code ${code}`));
                }
            });
            zipProcess.on('error', reject);
        });

        // 5. Envoyer le fichier ZIP en téléchargement
        return res.download(zipPath, zipName, async (err) => {
            // Nettoyage après envoi (important!)
            try {
                if (zipPath) await fs.promises.unlink(zipPath);
                if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                if (cleanupError.code !== 'ENOENT') {
                    console.warn('Erreur lors du nettoyage du ZIP temporaire :', cleanupError);
                }
            }

            if (err) {
                console.error('Erreur lors de l\'envoi du ZIP :', err);
                if (!res.headersSent) {
                    res.status(500).send('Erreur lors de l\'envoi du fichier.');
                }
            }
        });

    } catch (error) {
        console.error('Erreur lors de la création du ZIP de photos pour admin :', error);
        
        // Tentative de nettoyage si l'erreur se produit avant l'envoi
        try {
            if (zipPath) await fs.promises.unlink(zipPath);
            if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
             // Ignorer les erreurs de nettoyage
        }

        return res.status(500).send('Erreur interne du serveur lors du téléchargement des photos.');
    }
});
const renderAdminOrders = async (req, res, next) => {
    const { userId } = req.params;
    const localeParam = req.params.locale;
    const locale = localeParam || req.user?.locale || req.locale || 'fr';
    const UserModel = mongoose.model('User');
    const OrderModel = mongoose.model('Order');

    const i18nPath = `./locales/${locale}/user.json`;
    let i18n = {};
    try {
        i18n = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));
    } catch (e) {
        console.error(`Erreur lors du chargement des traductions : ${e}`);
    }

    try {
        const userOrders = await OrderModel.find({ userId: userId })
            .sort({ paidAt: -1, createdAt: -1 })
            .lean();

        const targetUser = await UserModel.findById(userId).lean();

        res.render('admin-orders', {
            locale,
            user: req.user,
            targetUser,
            userOrders,
            i18n,
            currentPath: req.originalUrl
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes admin :', error);
        next(error);
    }
};

app.get('/admin/orders/:userId', isAuthenticated, isAdmin, renderAdminOrders);
app.get('/:locale/admin/orders/:userId', isAuthenticated, isAdmin, renderAdminOrders);
app.get('/:locale/enable-2fa', isAuthenticated, async (req, res) => { // ⬅️ AJOUT DE 'async' ICI
  const locale = req.params.locale || 'fr';

  try {
    // L'ID est maintenant accessible via req.user (car req.logIn a réussi)
    // Nous vérifions si l'utilisateur est bien connecté via isAuthenticated
    if (!req.isAuthenticated()) {
        return res.redirect(`/${locale}/login`);
    }

    const user = await User.findById(req.user._id);

    // Si l'utilisateur a déjà un secret, on ne le régénère pas
    if (!user.twoFactorSecret) {
      const secret = speakeasy.generateSecret({ name: `UAP Immo (${user.email})` });
      user.twoFactorSecret = secret.base32;
      await user.save();
    }

    const otpAuthUrl = speakeasy.otpauthURL({
      secret: user.twoFactorSecret,
      label: `UAP Immo (${user.email})`,
      issuer: 'UAP Immo',
      encoding: 'base32'
    });

    const qrCode = await QRCode.toDataURL(otpAuthUrl); // L'await est maintenant valide

    const translationsPath = `./locales/${locale}/enable-2fa.json`;
    const i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

res.render('enable-2fa', {
  locale,
  i18n,
  user,
  qrCode,
  messages: req.flash(),
  currentPath: req.originalUrl,
  showAccountButtons: false // 🔐 cache Mon compte / Déconnexion
});
  } catch (error) {
    console.error("Erreur dans GET /enable-2fa :", error);
    req.flash('error', 'Erreur lors de la génération du code QR.');
    res.redirect(`/${locale}/user`);
  }
});

  


app.post('/:locale/enable-2fa', isAuthenticated, async (req, res) => {
  const locale = req.params.locale || 'fr';
  const { code } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user.twoFactorSecret) {
      req.flash('error', 'Secret 2FA manquant. Rechargez la page.');
      return res.redirect(`/${locale}/enable-2fa`);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });

    if (!verified) {
      req.flash('error', 'Code invalide. Veuillez réessayer.');
      return res.redirect(`/${locale}/enable-2fa`);
    }

    user.twoFactorEnabled = true;
    await user.save();

    req.flash('success', '2FA activée avec succès.');
    res.redirect(`/${locale}/user`);
  } catch (err) {
    console.error("Erreur POST enable-2fa :", err);
    req.flash('error', 'Une erreur est survenue.');
    res.redirect(`/${locale}/enable-2fa`);
  }
});




app.get('/faq', (req, res) => {
  const locale = req.locale || 'fr';
  res.render('faq', {
    title: 'faq',
    locale,
    currentPath: req.originalUrl
  });
});

app.get('/:lang/contact', (req, res) => {
    // Récupérer la langue depuis l'URL
    const locale = req.params.lang || 'en'; // 'en' par défaut si aucune langue n'est spécifiée
    const messageEnvoye = req.query.messageEnvoye === 'true';

    // Charger les traductions globales et spécifiques à la page
    const globalTranslationsPath = `./locales/${locale}/global.json`;
    const contactTranslationsPath = `./locales/${locale}/contact.json`;

    let globalTranslations = {};
    let contactTranslations = {};

    try {
        globalTranslations = JSON.parse(fs.readFileSync(globalTranslationsPath, 'utf8'));
        contactTranslations = JSON.parse(fs.readFileSync(contactTranslationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    // Fusionner les traductions globales et spécifiques
    const i18n = { ...globalTranslations, ...contactTranslations };

    // Rendre la page contact avec les traductions
   res.render('contact', {
    title: contactTranslations.title,
    i18n: i18n,
    locale: locale, 
    messageEnvoye: messageEnvoye,
    currentPath: req.originalUrl,
    // 🔑 AJOUT DE LA CLÉ PUBLIQUE ICI POUR LE WIDGET
    RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY
});
});

app.post('/send-contact', async (req, res) => {
    const { firstName, lastName, email, message, type, 'g-recaptcha-response': captcha } = req.body;
    const locale = req.cookies.locale || 'fr';
    const contactUrl = `/${locale}/contact`;

    // 1. VÉRIFICATION DU CAPTCHA
    if (!captcha) {
        console.warn("Tentative de soumission sans CAPTCHA.");
        // Gérer le cas où le captcha est manquant (rediriger avec un message si possible)
        return res.redirect(`${contactUrl}?error=captcha_missing`);
    }

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        const verificationURL = `https://www.google.com/recaptcha/api/siteverify`;

        const response = await axios.post(verificationURL, null, {
            params: {
                secret: secretKey,
                response: captcha,
            },
        });

        if (!response.data.success) {
            console.warn("CAPTCHA échoué pour l'email:", email);
            // Redirection vers la page de contact avec un indicateur d'échec
            return res.redirect(`${contactUrl}?error=captcha_failed`);
        }
        
        // --- 2. TRAITEMENT DE L'EMAIL (Uniquement si CAPTCHA SUCCESS) ---

        // Configurer les options d'email
        const mailOptions = {
            from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
            to: process.env.CONTACT_EMAIL,
            subject: `Nouveau message de contact - Type: ${type}`,
            html: `
                <p><b>Nom :</b> ${firstName} ${lastName}</p>
                <p><b>Email :</b> ${email}</p>
                <p><b>Type :</b> ${type}</p>
                <p><b>Message :</b><br>${message}</p>
            `
        };

        // Envoyer l'email
        await sendEmail(mailOptions);
        
        // Redirection en cas de succès
        res.redirect(`${contactUrl}?messageEnvoye=true`);
    } catch (error) {
        console.error('Erreur lors de la vérification CAPTCHA ou de l\'envoi de l\'email :', error.message || error);
        // Redirection générique en cas d'erreur interne
        res.redirect(`${contactUrl}?error=internal_error`);
    }
});
app.get('/:locale/register', (req, res) => {
    const locale = req.params.locale || 'fr'; // Récupérer la langue dans l'URL ou 'fr' par défaut
    const translationsPath = path.join(__dirname, 'locales', locale, 'register.json');
    let i18n = {};

    try {
        i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8')); // Charger les traductions
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions pour ${locale}:`, error);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    res.render('register', {
        locale: locale,
        i18n: i18n,
        messages: req.flash(),
currentPath: req.originalUrl,
RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY 
    });
});



app.use('/pdf', pdfRoutes);

const axios = require('axios'); // tout en haut de ton fichier

app.post('/:locale/register', async (req, res) => {
  const { email, firstName, lastName, password, confirmPassword, 'g-recaptcha-response': captcha } = req.body;
  const locale = req.params.locale;

  // 1. VÉRIFICATION CAPTCHA
  if (!captcha) {
    req.flash('error', 'Veuillez valider le CAPTCHA.');
    return res.redirect(`/${locale}/register`);
  }

  // 2. VÉRIFICATION DE L'API CAPTCHA
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify`;

    const response = await axios.post(verificationURL, null, {
        params: {
            secret: secretKey,
            response: captcha,
        },
    });

    if (!response.data.success) {
      req.flash('error', 'CAPTCHA invalide. Veuillez réessayer.');
      return res.redirect(`/${locale}/register`);
    }
  } catch (err) {
    console.error("Erreur reCAPTCHA :", err);
    req.flash('error', 'Erreur de vérification CAPTCHA.');
    return res.redirect(`/${locale}/register`);
  }

  // 3. VALIDATION EMAIL ET MOT DE PASSE (Exécuté uniquement si le CAPTCHA est bon)
  if (!validator.isEmail(email)) {
    req.flash('error', 'L\'adresse email n\'est pas valide.');
    return res.redirect(`/${locale}/register`);
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Les mots de passe ne correspondent pas.');
    return res.redirect(`/${locale}/register`);
  }

  const passwordRequirements = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRequirements.test(password)) {
    req.flash('error', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole spécial.');
    return res.redirect(`/${locale}/register`);
  }

  // 4. CRÉATION DU COMPTE ET CONNEXION (Logique principale)
  try {
    // Création de l'utilisateur Mongoose
    const newUser = await User.register(new User({ 
            email, 
            firstName, 
            lastName, 
            role: 'user' 
        }), password);
        
        await sendAccountCreationEmail(newUser.email, newUser.firstName, newUser.lastName, locale);
    // 👇 AJOUTER CECI ICI 👇
await sendAdminNewUser(newUser); 
// 👆 FIN AJOUT 👆

console.log(`[REGISTER DEBUG] Compte créé pour ${newUser.email}. Tentative de login...`);
    // Connexion via Passport (Async)
    req.logIn(newUser, (err) => {
      if (err) {
            console.error('❌ ERREUR REQ.LOGIN APRÈS INSCRIPTION:', err);
        req.flash('error', 'Erreur de connexion automatique.');
        return res.redirect(`/${locale}/login`);
      }

      console.log('✅ REQ.LOGIN RÉUSSI. Tentative de redirection vers 2FA.');
      res.redirect(`/${locale}/enable-2fa`);
    });

  } catch (error) { // <-- Ce catch gère les erreurs Mongoose/Email/etc.
    console.error('Erreur lors de l\'inscription :', error.message);
    req.flash('error', `Une erreur est survenue lors de l'inscription : ${error.message}`);
    res.redirect(`/${locale}/register`);
  }
});
// DANS server.js
app.get('/:locale/2fa', async (req, res) => {
  const { locale } = req.params;

  // 🔑 LECTURE DU COOKIE TEMPORAIRE
  // On cherche l'ID dans le cookie défini par la route login
  const userId = req.cookies['2fa_pending_id']; 

  // Si pas de cookie, l'utilisateur n'a rien à faire ici -> Login
  if (!userId) {
    console.warn('⚠️ 2FA GET: Cookie "2fa_pending_id" manquant. Retour au login.');
    return res.redirect(`/${locale}/login`);
  }
  
  const translationsPath = `./locales/${locale}/2fa.json`;
  let i18n = {};

  try {
    i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    
    // On vérifie que l'utilisateur existe toujours
    const user = await User.findById(userId);

    if (!user || !user.twoFactorEnabled) {
        // Si l'utilisateur n'est pas valide, on nettoie le cookie
        res.clearCookie('2fa_pending_id');
        return res.redirect(`/${locale}/login`);
    }

    // Génération du QR Code (pour affichage si besoin)
    const otpAuthUrl = speakeasy.otpauthURL({
      secret: user.twoFactorSecret,
      label: `UAP Immo (${user.email})`,
      issuer: 'UAP Immo',
      encoding: 'base32'
    });

    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    res.render('2fa', {
      locale,
      i18n,
      messages: req.flash(),
      currentPath: req.originalUrl,
      showAccountButtons: false
    });

  } catch (error) {
    console.error("Erreur dans GET /2fa :", error);
    return res.status(500).send('Erreur serveur 2FA');
  }
});
app.post('/:locale/2fa', async (req, res) => {
  const { locale } = req.params;
  const { code } = req.body;

  // Lecture du cookie
  const userId = req.cookies['2fa_pending_id'];

  if (!userId) {
    console.warn('⚠️ 2FA POST: Cookie manquant. Retour au login.');
    return res.redirect(`/${locale}/login`);
  }

  try {
    const user = await User.findById(userId);
    
    if (!user || !user.twoFactorSecret) {
        req.flash('error', 'Erreur utilisateur.');
        return res.redirect(`/${locale}/login`);
    }

    // Vérification du code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      req.flash('error', 'Code 2FA invalide.');
      return res.redirect(`/${locale}/2fa`);
    }

    // ✅ CODE VALIDE : CRÉATION DE LA SESSION FINALE
    req.login(user, (err) => {
      if (err) {
        console.error('❌ ÉCHEC REQ.LOGIN POST-2FA:', err);
        req.flash('error', 'Erreur de session.');
        return res.redirect(`/${locale}/login`);
      }

      // 1. Nettoyage du cookie temporaire
      // IMPORTANT : On utilise exactement les mêmes options (secure: false) pour pouvoir le supprimer
      res.clearCookie('2fa_pending_id', {
          secure: false, // 🔑 IMPORTANT
          sameSite: 'Lax'
      });

      // 2. Sauvegarde forcée de la session avant redirection
      req.session.save((saveErr) => {
          if (saveErr) console.error("Erreur sauvegarde session:", saveErr);
          
          console.log(`✅ 2FA validée. Session ${req.sessionID} sauvée. Redirection...`);
          return res.redirect(`/${locale}/user`);
      });
    });

  } catch (err) {
    console.error('Erreur POST 2FA:', err);
    req.flash('error', 'Erreur serveur.');
    res.redirect(`/${locale}/login`);
  }
});
app.post('/api/user/update-address', isAuthenticated, async (req, res) => {
    try {
        const { street, city, zipCode, country } = req.body;

        // Mise à jour de l'utilisateur connecté
        const user = await User.findByIdAndUpdate(req.user._id, {
            billingAddress: {
                street: street || '',
                city: city || '',
                zipCode: zipCode || '',
                country: country || ''
            }
        }, { new: true }); // Retourne l'objet mis à jour

        res.json({ success: true, message: 'Adresse mise à jour', user: user });
    } catch (error) {
        console.error('Erreur mise à jour adresse :', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la sauvegarde.' });
    }
});
// REMPLACEZ app.post('/add-property', ...) PAR CECI :
app.post('/add-property', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 },
  { name: 'extraPhotos', maxCount: 8 },
  { name: 'miniPhotos', maxCount: 3 }
]), async (req, res) => {
  try {
    if (typeof req.body.parking === 'undefined') {
      cleanupUploadedFiles(req.files); // Nettoyer en cas d'erreur
      return res.status(400).send('Le champ parking est requis.');
    }
    const rawVideoUrl = (req.body.videoUrl || '').trim();
    const hasVideo = rawVideoUrl.length > 0;

    // On vérifie les photos obligatoires SEULEMENT s'il n'y a PAS de vidéo
    if (!hasVideo && (!req.files.photo1?.[0] || !req.files.photo2?.[0])) {
      cleanupUploadedFiles(req.files);
      return res.status(400).send('Deux photos sont requises lorsque aucun lien vidéo n’est fourni.');
    }

    // On traite TOUJOURS les photos, qu'il y ait une vidéo ou non
    const mainPhotos = [];
    if (req.files.photo1?.[0]) {
      mainPhotos.push(req.files.photo1[0].filename);
    }
    if (req.files.photo2?.[0]) {
      mainPhotos.push(req.files.photo2[0].filename);
    }

    const extraPhotos = [];
    if (req.files.extraPhotos) {
      req.files.extraPhotos.slice(0, 8).forEach(f => extraPhotos.push(f.filename));
    }

    const miniPhotos = [];
    if (req.files.miniPhotos) {
      req.files.miniPhotos.slice(0, 3).forEach(f => miniPhotos.push(f.filename));
    }

    const photos = [...mainPhotos, ...extraPhotos, ...miniPhotos].filter(Boolean);

    // Si vidéo, on nettoie les fichiers uploadés (Multer les sauvegarde par défaut)
    // MAIS on garde 'photos' pour la galerie
    if (hasVideo) {
        // Note : si 'photos' est vide, on pourrait vouloir quand même nettoyer
    } else {
        // S'il n'y a pas de vidéo, on nettoie les fichiers que si les photos principales manquent
        if (photos.length < 2) {
             cleanupUploadedFiles(req.files);
             return res.status(400).send('Deux photos principales sont requises lorsque aucun lien vidéo n’est fourni.');
        }
    }


    const property = new Property({
      rooms: Number(req.body.rooms),
      bedrooms: Number(req.body.bedrooms),
      surface: Number(req.body.surface),
      price: parseFloat(req.body.price),
      city: req.body.city,
      postalCode: req.body.postalCode,
      country: req.body.country,
      description: req.body.description,
      yearBuilt: req.body.yearBuilt || null,
      pool: req.body.pool === 'true',
      propertyType: req.body.propertyType,
      doubleGlazing: req.body.doubleGlazing === 'true',
      wateringSystem: req.body.wateringSystem === 'true',
      barbecue: req.body.barbecue === 'true',
      carShelter: req.body.carShelter === 'true',
      parking: req.body.parking === 'true',
      caretakerHouse: req.body.caretakerHouse === 'true',
      electricShutters: req.body.electricShutters === 'true',
      outdoorLighting: req.body.outdoorLighting === 'true',
      contactFirstName: req.body.contactFirstName,
      contactLastName: req.body.contactLastName,
      contactPhone: req.body.contactPhone,
      videoUrl: rawVideoUrl,
      language: req.body.language || 'fr',
      userId: req.user._id,
      dpe: req.body.dpe || 'En cours',
            theme: ['foret','marine','terre','pierre','bordeaux','encre'].includes(req.body.theme) ? req.body.theme : 'foret',
      layout: req.body.layout === 'video' ? 'video' : 'photo',
      photos: photos // <-- On sauvegarde TOUJOURS les photos
    });

    await property.save();

      const { url: landingPageUrl, fullUrl } = await generateLandingPage(property);
    property.url = landingPageUrl;
    await property.save();
    addToSitemap(fullUrl);
    pingSearchEngines('https://uap.immo/sitemap.xml');
    
    // ✅ Envoi d’email après sauvegarde complète
    const user = await User.findById(req.user._id);
    await sendPropertyCreationEmail(user, property);
    await sendAdminNewProperty(user, property);

  const successMessage = `
  <div class="alert alert-success small text-muted" role="alert">
  <p class="mb-1">✅ Propriété ajoutée avec succès !</p>
  <p class="mb-1">URL de la landing page : 
    <a href="${property.url}" target="_blank" class="text-decoration-underline">${property.url}</a>
  </p>
  <p class="mb-0">
    👉 <a href="#" onclick="showSection('created-pages'); return false;" class="btn btn-link p-0 align-baseline">Voir ma page dans la liste</a>
  </p>
</div>
`;
    res.send(successMessage);
  } catch (error) {
    console.error("Erreur lors de l'ajout de la propriété :", error);
    cleanupUploadedFiles(req.files); // Nettoyer en cas d'erreur
    res.status(500).send('Erreur lors de l\'ajout de la propriété.');
  }
});

// REMPLACEZ app.post('/property/update/:id', ...) PAR CECI :
app.post('/property/update/:id', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 },
  { name: 'extraPhotos', maxCount: 8 },
  { name: 'miniPhotos', maxCount: 3 }
]), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property || !property.userId.equals(req.user._id)) {
      return res.status(403).send("Vous n'êtes pas autorisé à modifier cette propriété.");
    }

    if (typeof req.body.parking === 'undefined') {
      cleanupUploadedFiles(req.files);
      return res.status(400).send('Le champ parking est requis.');
    }

    const rawVideoUrl = (req.body.videoUrl || '').trim();
    const hasVideo = rawVideoUrl.length > 0;
    const postalCodePattern = /^\d{5}$/;
    const allowedLanguages = ['fr', 'en', 'es', 'pt'];

    if (!postalCodePattern.test(req.body.postalCode || '')) {
      cleanupUploadedFiles(req.files);
      return res.status(400).send('Le code postal doit contenir exactement 5 chiffres.');
    }

    // Mettre à jour les champs depuis le formulaire
    property.rooms = Number(req.body.rooms);
    property.bedrooms = Number(req.body.bedrooms);
    property.surface = Number(req.body.surface);
    property.price = parseFloat(req.body.price);
    property.city = req.body.city;
    property.postalCode = req.body.postalCode;
    property.country = req.body.country;
    property.yearBuilt = req.body.yearBuilt || null;
    property.propertyType = req.body.propertyType;
    property.dpe = req.body.dpe || 'En cours';
    property.description = req.body.description;
    property.contactFirstName = req.body.contactFirstName;
    property.contactLastName = req.body.contactLastName;
    property.contactPhone = req.body.contactPhone;
    property.language = allowedLanguages.includes(req.body.language) ? req.body.language : property.language;
    property.videoUrl = rawVideoUrl;
        property.theme = ['foret','marine','terre','pierre','bordeaux','encre'].includes(req.body.theme) ? req.body.theme : (property.theme || 'foret');
    property.layout = req.body.layout === 'video' ? 'video' : 'photo';

    // Champs booléens
    property.pool = req.body.pool === 'true';
    property.doubleGlazing = req.body.doubleGlazing === 'true';
    property.wateringSystem = req.body.wateringSystem === 'true';
    property.barbecue = req.body.barbecue === 'true';
    property.carShelter = req.body.carShelter === 'true';
    property.parking = req.body.parking === 'true';
    property.caretakerHouse = req.body.caretakerHouse === 'true';
    property.electricShutters = req.body.electricShutters === 'true';
    property.outdoorLighting = req.body.outdoorLighting === 'true';

    // --- LOGIQUE PHOTOS CORRIGÉE ---
    const existingPhotos = Array.isArray(property.photos) ? property.photos : [];
    let mainPhotos = existingPhotos.slice(0, 2);
    let extraPhotos = existingPhotos.slice(2, 10);
    let miniPhotos = existingPhotos.slice(10, 13);

    if (req.files?.photo1?.[0]) {
      mainPhotos[0] = req.files.photo1[0].filename;
    }
    if (req.files?.photo2?.[0]) {
      mainPhotos[1] = req.files.photo2[0].filename;
    }

    if (req.files?.extraPhotos?.length) {
      extraPhotos = req.files.extraPhotos.slice(0, 8).map(file => file.filename);
    }

    if (req.files?.miniPhotos?.length) {
      miniPhotos = req.files.miniPhotos.slice(0, 3).map(file => file.filename);
    }

    const combinedPhotos = [...mainPhotos, ...extraPhotos, ...miniPhotos].filter(Boolean);

    // On vérifie les photos obligatoires SEULEMENT s'il n'y a PAS de vidéo
    if (!hasVideo && combinedPhotos.length < 2) {
      cleanupUploadedFiles(req.files);
      return res.status(400).send('Deux photos sont requises lorsque aucun lien vidéo n’est fourni.');
    }
    
    // On sauvegarde toujours le tableau de photos combinées
    property.photos = combinedPhotos;
    // --- FIN DE LA LOGIQUE CORRIGÉE ---

    await property.save();

    // 🆕 Regénérer la landing page après mise à jour
      const { url: updatedLandingPageUrl, fullUrl } = await generateLandingPage(property);
    property.url = updatedLandingPageUrl;
    await property.save();
    addToSitemap(fullUrl);
    pingSearchEngines('https://uap.immo/sitemap.xml');

    // Localisation + traduction pour le rendu
    const locale = req.language || 'fr';
    const currentPath = req.originalUrl;
    const i18n = {
      menu: {
        home: locale === 'fr' ? 'Accueil' : 'Home',
        contact: locale === 'fr' ? 'Contact' : 'Contact',
      }
    };

    res.render('edit-property', {
      property,
      successMessage: "Votre annonce a été mise à jour avec succès.",
      locale,
      currentPath,
      i18n,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la propriété :', error.message);
    console.error(error.stack);
    cleanupUploadedFiles(req.files); // Nettoyer en cas d'erreur
    res.status(500).send("Erreur interne du serveur.");
  }
});
// server.js (Ajouter ce bloc)

app.get('/:locale/property/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property) {
             return res.status(404).send('Propriété introuvable.');
        }

        // Vérification de l'autorisation: permet l'accès si c'est le propriétaire ou un admin
        if (!property.userId.equals(req.user._id) && req.user.role !== 'admin') {
            return res.status(403).send('Accès non autorisé à cette propriété.');
        }

        // Assurez-vous que req.locale est défini (utilisé dans la navbar/footer)
        const locale = req.params.locale || 'fr'; 
        
        // Traductions minimales nécessaires pour edit-property.ejs
        const i18n = { 
            menu: {
                home: locale === 'fr' ? 'Accueil' : 'Home',
                contact: locale === 'fr' ? 'Contact' : 'Contact',
            }
        };

        // Rendre la vue EJS
        res.render('edit-property', {
            property,
            locale,
            i18n,
            currentPath: req.originalUrl,
            isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
            successMessage: req.flash('success') 
        });

    } catch (error) {
        console.error('Erreur (EDIT PROPERTY) :', error);
        res.status(500).send('Erreur interne du serveur lors de la récupération de la propriété.');
    }
});
app.get('/user/properties', isAuthenticated, async (req, res) => {
  try {
    const properties = await Property.find({ userId: req.user._id });
    res.json(properties);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des propriétés :", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la récupération des propriétés." });
  }
});

app.get('/user/landing-pages', isAuthenticated, async (req, res) => {
  try {
    const landingPages = await Property.find({ userId: req.user._id });

    // Enrichir chaque propriété avec "hasActiveOrder"
    const enrichedPages = await Promise.all(
      landingPages.map(async (page) => {
        const activeOrder = await Order.findOne({
          userId: req.user._id,
          propertyId: page._id,
          status: { $in: ['pending', 'paid'] },
          expiryDate: { $gt: new Date() }
        });

        return {
          ...page.toObject(),
          hasActiveOrder: !!activeOrder // true ou false
        };
      })
    );

    res.json(enrichedPages);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des landing pages :", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la récupération des landing pages." });
  }
});

app.get('/:locale/cgu', (req, res) => {
    const locale = req.params.locale || 'fr';

    // Chargement des traductions pour le menu/footer (on réutilise user.json ou global.json)
    // Assurez-vous que le chemin est correct par rapport à votre structure
    const translationsPath = `./locales/${locale}/user.json`; 
    let i18n = {};
    try {
        i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (e) {
        console.error("Erreur chargement trad CGU:", e);
        // Fallback minimal pour éviter le crash si le fichier manque
        i18n = { menu: { home: 'Home', contact: 'Contact' }, footer: {} }; 
    }

    res.render('cgu', {
        locale: locale,
        i18n: i18n,
        currentPath: req.originalUrl,
        // isAuthenticated et user sont gérés par le middleware global res.locals
    });
});

// Redirection par défaut
app.get('/cgu', (req, res) => {
    res.redirect('/fr/cgu');
})
app.post('/process-paypal-payment', isAuthenticated, async (req, res) => {
  const axios = require('axios');
  const cfg = getPaypalConfig();
  const requestId = crypto.randomUUID();

  try {
    const { orderID, propertyId, amount } = req.body;
    // --- DÉFINITION DES DONNÉES DE LA FACTURE ---

const fullName = `${req.user.firstName} ${req.user.lastName}`;
const clientDetails = {
    userId: req.user._id.toString(),
    firstName: req.user.firstName,
    lastName: req.user.lastName,
};
const companyDetails = {
    name: 'UAP Immo',
    address: ['123 Rue de la Liberté', '75000 Paris'], // 👈 REMPLACER PAR VOS VRAIES ADRESSES
    siret: '123 456 789 00012', // 👈 REMPLACER PAR VOTRE VRAI SIRET
    tva: 'FR12345678901', // 👈 REMPLACER PAR VOTRE VRAI NUMÉRO (ou N/A)
};
const serviceDetails = {
    product: 'Pack de diffusion publicitaire',
    duration: '90 jours',
};
// --- FIN DÉFINITION DES DONNÉES DE LA FACTURE ---

    // 1) Vérifier pas de commande active
    const existingActiveOrder = await Order.findOne({
      userId: req.user._id,
      propertyId,
      status: { $in: ['pending', 'paid'] },
      expiryDate: { $gt: new Date() }
    });
    if (existingActiveOrder) {
      return res.status(400).json({ success: false, message: "Vous avez déjà une commande active pour cette annonce." });
    }

    // 2) OAuth
    const { data: token } = await axios.post(
      `${cfg.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: cfg.clientId, password: cfg.secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    const accessToken = token.access_token;

    // 3) Récupérer l'order PayPal (vérif montant/devise)
    const orderResp = await axios.get(
      `${cfg.baseUrl}/v2/checkout/orders/${orderID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const pu = orderResp.data.purchase_units?.[0];
    const orderAmount = pu?.amount?.value;
    const orderCurrency = pu?.amount?.currency_code;

    if (String(orderAmount) !== String(amount) || orderCurrency !== 'EUR') {
      console.warn('Montant/devise incohérents', { orderAmount, orderCurrency, amount });
      return res.status(400).json({ success: false, message: 'Montant ou devise invalide.' });
    }

    // 4) Capture (idempotente)
    const captureRes = await axios.post(
      `${cfg.baseUrl}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': requestId
        },
        validateStatus: () => true
      }
    );

    if (captureRes.status === 201 || captureRes.status === 200) {
      // ⚙️ Extraire captureId
      const capture = captureRes.data?.purchase_units?.[0]?.payments?.captures?.[0] || null;
      const captureId = capture?.id || null;

      // 5) Enregistrer la commande locale (PAID)
      const newOrder = new Order({
        userId: req.user._id,
        propertyId,
        amount: parseFloat(amount),
        status: 'paid',
        paypalOrderId: orderID,
        paypalCaptureId: captureId,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 jours
      });
      await newOrder.save();
      await sendAdminNewOrder(req.user, newOrder, 'PayPal');
      console.log('✅ Order enregistrée comme PAID', {
        orderId: newOrder._id.toString(),
        paypalOrderId: orderID,
        captureId
      });

     // ... dans le bloc if (captureRes.status === 201 || captureRes.status === 200)

    // 6) Email / facture
    try {
        await sendInvoiceByEmail(
            req.user.email,                    // to
            fullName,                          // fullName (Nouveau)
            newOrder.orderId,                  // orderIdUap (Nouveau: Réf interne de la BDD)
            orderID,                           // paypalOrderId
            captureId,                         // paypalCaptureId
            String(amount),                    // amount
            'EUR',                             // currency
            // --- Données complètes pour generateInvoicePDF (Transmises par sendInvoiceByEmail) ---
            clientDetails,
            companyDetails,
            serviceDetails
        );
        console.log('📧 Email de facture envoyé à', req.user.email);
    } catch (e) {
console.warn('📧 Envoi facture KO :', e?.message || e);
         }

      const locale = req.cookies.locale || 'fr';
      return res.json({ success: true, redirectUrl: `/${locale}/user` });
    }

    if (captureRes.status === 422) {
      // ORDER_ALREADY_CAPTURED : marque payé et envoie l'email
      const updated = await Order.findOneAndUpdate(
        { paypalOrderId: orderID },
        {
          $set: {
            status: 'paid',
            expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          }
        },
        { upsert: true, new: true }
      );

      // ... dans le bloc if (captureRes.status === 422)

    // ... (Logique de mise à jour de la commande 'updated')

    try {
        await sendInvoiceByEmail(
            req.user.email,                    // to
            fullName,                          // fullName (Nouveau)
            updated.orderId,                   // orderIdUap (Nouveau)
            orderID,                           // paypalOrderId
            updated.paypalCaptureId,           // paypalCaptureId (Provient du modèle mis à jour)
            String(amount),                    // amount
            'EUR',                             // currency
            // --- Données complètes pour generateInvoicePDF ---
            clientDetails,
            companyDetails,
            serviceDetails
        );
        console.log('📧 Email de facture envoyé (422) à', req.user.email);
    } catch (e) {
console.warn('📧 Envoi facture KO :', e?.message || e);
         }

      const locale = req.cookies.locale || 'fr';
      return res.json({ success: true, redirectUrl: `/${locale}/user` });
    }

    console.error('Capture PayPal a échoué:', captureRes.status, captureRes.data);
    return res.status(400).json({ success: false, message: 'Capture échouée' });
  } catch (err) {
    console.error('Erreur /process-paypal-payment:', err?.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur PayPal' });
  }
});


app.post('/process-btcpay-payment', isAuthenticated, async (req, res) => {
  try {
    const { propertyId, amount } = req.body;

    const existingActiveOrder = await Order.findOne({
      userId: req.user._id,
      propertyId,
      status: { $in: ['pending', 'paid'] },
      expiryDate: { $gt: new Date() }
    });

    if (existingActiveOrder) {
      return res.status(400).json({
        success: false,
        message: "Vous avez déjà une commande active pour cette annonce."
      });
    }

    const newOrder = new Order({
      userId: req.user._id,
      propertyId,
      amount: parseFloat(amount),
      status: 'pending',
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    const invoiceRes = await axios.post(
      `${process.env.BTCPAY_URL}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`,
      {
        amount: parseFloat(amount),
        currency: 'EUR',
        metadata: { orderId: newOrder.orderId, propertyId }
      },
      { headers: { Authorization: `token ${process.env.BTCPAY_API_KEY}` } }
    );

    newOrder.btcPayInvoiceId = invoiceRes.data.id;
    await newOrder.save();
    await sendAdminNewOrder(req.user, newOrder, 'Bitcoin (Pending)');

    try {
      await sendMailPending(
        req.user.email,
        `${req.user.firstName} ${req.user.lastName}`,
        newOrder.orderId,
        amount
      );
    } catch (err) {
      console.warn("📭 Erreur envoi mail d'attente BTC :", err.message);
    }

    res.json({ success: true, invoiceUrl: invoiceRes.data.checkoutLink });
  } catch (err) {
    console.error("❌ Erreur process-btcpay-payment :", err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});




app.get('/user/orders', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id }).populate('propertyId');

        const today = new Date();
        const ordersWithDaysRemaining = orders.map(order => {
            const orderObj = order.toObject(); // Convertir en objet JS standard
            if (order.expiryDate) {
                const expirationDate = new Date(order.expiryDate);
                
                console.log("🔹 Date d'expiration:", expirationDate);
                console.log("🔹 Date actuelle:", today);

                orderObj.expiryDateFormatted = expirationDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
                orderObj.daysRemaining = Math.max(0, Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24)));
            } else {
                console.error("❌ expiryDate non défini pour la commande :", order._id);
                orderObj.expiryDateFormatted = "Indisponible";
                orderObj.daysRemaining = "Indisponible";
            }

            return orderObj;
        });

        res.json(ordersWithDaysRemaining);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes :', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
    }
});

app.get('/user/orders/:orderId/invoice', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Sécurisation : L'admin peut tout voir, l'utilisateur ne voit que les siennes
    const query = { _id: orderId };
    if (!req.user || req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    if (order.status !== 'paid') {
      return res.status(400).json({ error: 'La facture est disponible après confirmation du paiement.' });
    }
    
    // --- DÉFINITION DES CONSTANTES POUR LE PDF ---
    // Ces infos sont nécessaires car elles ne sont pas en BDD
    const clientDetails = {
        userId: req.user._id.toString(),
        firstName: req.user.firstName,
        lastName: req.user.lastName,
    };
    const companyDetails = {
        name: 'UAP Immo',
        address: ['123 Rue de la Liberté', '75000 Paris'], // 👈 VOS ADRESSES
        siret: '123 456 789 00012', // 👈 VOTRE SIRET
        tva: 'FR12345678901', // 👈 VOTRE TVA
    };
    const serviceDetails = {
        product: 'Pack de diffusion publicitaire',
        duration: '90 jours',
    };

    // 🧠 DÉTECTION INTELLIGENTE DU MODE DE PAIEMENT
    // Si btcPayInvoiceId existe, c'est du Bitcoin, sinon c'est PayPal
    const paymentMethod = order.btcPayInvoiceId ? 'Bitcoin' : 'PayPal';

    const { invoicePath, fileBase } = await generateInvoicePDF({
      orderIdUap: order.orderId,
      
      // Si Bitcoin, on affiche l'ID BTCPay, sinon l'ID PayPal
      paypalOrderId: order.paypalOrderId || (order.btcPayInvoiceId ? 'BTCPAY-' + order.btcPayInvoiceId : '-'),
      
      // Si Bitcoin, on met 'CRYPTO', sinon le Capture ID PayPal
      paypalCaptureId: order.paypalCaptureId || (order.btcPayInvoiceId ? 'CRYPTO' : '-'),
      
      amount: order.amount,
      currency: order.currency || 'EUR',
      
      // Passage des objets complets
      client: clientDetails,
      companyInfo: companyDetails,
      serviceDetails: serviceDetails,
      
      // Passage du mode de paiement pour l'affichage dans le PDF
      paymentMethod: paymentMethod 
    });

    // Téléchargement du fichier
    return res.download(invoicePath, `facture-${fileBase}.pdf`);

  } catch (error) {
    console.error('Erreur lors de la génération de la facture :', error);
    return res.status(500).json({ error: 'Impossible de générer la facture.' });
  }
});





const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function getLandingPagesFromDB(userId) {
  return await Property.find({ createdBy: userId });
}



async function sendEmail(mailOptions) {
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email envoyé avec succès à :', mailOptions.to);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email :', error);
  }
}

async function sendAccountCreationEmail(email, firstName, lastName, locale = 'fr') {
  const loginUrl = locale === 'fr' ? 'https://uap.immo/fr/login' : 'https://uap.immo/en/login';

  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Bienvenue chez UAP Immo / Welcome to UAP Immo',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #52566f;">Bienvenue chez UAP Immo !</h2>
        <p>Bonjour ${firstName} ${lastName},</p>

        <p>Nous sommes ravis de vous compter parmi nos utilisateurs. Votre compte a été créé avec succès !</p>

        <p style="font-size: 16px;"><strong>Récapitulatif :</strong></p>
        <ul style="font-size: 16px;">
          <li><strong>Nom :</strong> ${lastName}</li>
          <li><strong>Prénom :</strong> ${firstName}</li>
          <li><strong>Email :</strong> ${email}</li>
          <li><strong>Accès plateforme :</strong> <a href="${loginUrl}" style="color: #52566f;">Se connecter à votre espace UAP Immo</a></li>
        </ul>

        <p>Nous vous invitons à vérifier vos informations dans votre espace personnel. Si vous constatez une erreur, n'hésitez pas à nous contacter.</p>

        <h3 style="color: #52566f;">Comment fonctionne notre plateforme ?</h3>
        <p>Depuis votre espace, vous pouvez créer une page dédiée à votre bien en enregistrant ses informations et en ajoutant deux photos de qualité.</p>
        <p>La page est générée immédiatement, disponible depuis votre espace, et optimisée pour le référencement naturel (SEO). Ce service est <strong>gratuit</strong>.</p>
        <p>Vous avez aussi la possibilité d’acheter un <strong>pack de diffusion</strong> professionnelle pour <strong>500€</strong>, incluant une <strong>diffusion ciblée sur 90 jours</strong>.</p>

        <p>Si vous avez la moindre question, notre équipe est là pour vous accompagner.</p>

        <p>Cordialement,<br>L’équipe UAP Immo</p>

        <hr>

        <h2 style="color: #52566f;">Welcome to UAP Immo!</h2>
        <p>Hello ${firstName} ${lastName},</p>

        <p>We're excited to have you on board. Your account has been successfully created!</p>

        <p style="font-size: 16px;"><strong>Summary:</strong></p>
        <ul style="font-size: 16px;">
          <li><strong>Last Name:</strong> ${lastName}</li>
          <li><strong>First Name:</strong> ${firstName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Platform access:</strong> <a href="${loginUrl}" style="color: #52566f;">Log in to your UAP Immo space</a></li>
        </ul>

        <p>Please verify your information in your dashboard. If you notice any mistake, feel free to contact us.</p>

        <h3 style="color: #52566f;">How does the platform work?</h3>
        <p>From your dashboard, you can create a page for your property by filling in its details and uploading two high-quality photos.</p>
        <p>The page is generated instantly, SEO-optimized, and <strong>completely free</strong>.</p>
        <p>You may also purchase a <strong>professional promotion pack</strong> for <strong>€500</strong>, which includes <strong>targeted distribution for 90 days</strong>.</p>

        <p>If you need any assistance, our team is here to help.</p>

        <p>Best regards,<br>The UAP Immo Team</p>

        <hr>
        <p style="font-size: 12px; color: #888;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre. Pour toute assistance, contactez-nous à <a href="mailto:support@uap.company">support@uap.company</a>.</p>
      </div>
    `
  };

  await sendEmail(mailOptions);
}

async function sendPasswordResetEmail(user, locale, resetUrl, code) {
  const subject = 'Réinitialisation du mot de passe / Password Reset';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #52566f;">Réinitialisation de votre mot de passe</h2>
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser le mot de passe de votre compte UAP Immo.</p>
      <p>Utilisez le code suivant pour confirmer votre demande :</p>
      <p style="font-size: 24px; font-weight: bold; color: #52566f;">${code}</p>
      <p>Ou cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
      <p><a href="${resetUrl}" style="color: #52566f; text-decoration: underline;">Réinitialiser mon mot de passe</a></p>
      <p>Ce code et ce lien expirent dans 1 heure.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
      <p>Cordialement,<br>L'équipe UAP Immo</p>
      <hr>
      <h2 style="color: #52566f;">Password Reset</h2>
      <p>Hello,</p>
      <p>You requested to reset the password for your UAP Immo account.</p>
      <p>Use the following code to confirm your request:</p>
      <p style="font-size: 24px; font-weight: bold; color: #52566f;">${code}</p>
      <p>Or click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="color: #52566f; text-decoration: underline;">Reset my password</a></p>
      <p>This code and link are valid for 1 hour.</p>
      <p>If you did not make this request, you can ignore this email.</p>
      <p>Regards,<br>The UAP Immo Team</p>
      <hr>
      <p style="font-size: 12px; color: #888;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre. / This email was sent automatically. Please do not reply.</p>
    </div>
  `;

  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject,
    html
  };

  await sendEmail(mailOptions);
}
async function sendPropertyCreationEmail(user, property) {
const creationDate = new Date(property.createdAt || Date.now()).toLocaleDateString('fr-FR');

const mailOptions = {
  from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
  to: user.email,
  subject: 'Votre annonce a bien été publiée sur UAP Immo',
  html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2c3e50;">Bonjour ${user.firstName} ${user.lastName},</h2>
    <p>Nous avons le plaisir de vous confirmer que votre annonce a été générée avec succès le <strong>${creationDate}</strong>.</p>

    <h3 style="color: #2c3e50;">📄 Détails de votre annonce :</h3>
    <ul style="list-style-type: none; padding: 0;">
      <li><strong>Type de bien :</strong> ${property.propertyType}</li>
      <li><strong>Ville :</strong> ${property.city}</li>
      <li><strong>Pays :</strong> ${property.country}</li>
      <li><strong>Surface :</strong> ${property.surface} m²</li>
      <li><strong>Prix :</strong> ${Number(property.price).toLocaleString('fr-FR')} €</li>
      <li><strong>Nombre de pièces :</strong> ${property.rooms}</li>
      <li><strong>Chambres :</strong> ${property.bedrooms}</li>
    </ul>

    <p>🔗 Vous pouvez consulter votre annonce ici :<br />
    <a href="https://uap.immo${property.url}" style="color: #1e87f0;" target="_blank">https://uap.immo${property.url}</a></p>

    <hr />

    <p>✅ <strong>Partage gratuit :</strong> Vous pouvez librement partager cette URL.</p>
    <p>📈 <strong>Référencement inclus :</strong> Votre annonce est optimisée pour le SEO dès sa mise en ligne.</p>
    <p>📊 <strong>Statistiques :</strong> Depuis votre espace personnel, consultez les vues, sources de trafic, etc.</p>
    <p>✏️ <strong>Modification gratuite :</strong> Corrigez ou mettez à jour votre annonce à tout moment.</p>
    <p>🚀 <strong>Boost de diffusion :</strong> Achetez un <strong>pack de diffusion</strong> depuis votre tableau de bord pour une visibilité maximale.</p>
    <p>📱 <strong>QR Code :</strong> Scannez votre QR code pour le partager, l’imprimer ou l’intégrer dans un flyer.</p>

    <p style="margin-top: 20px;">
      👉 Accédez à votre espace : <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Site officiel : <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Merci de votre confiance,<br />
    <strong>L’équipe UAP Immo</strong></p>

    <hr style="margin-top: 40px;" />

    <h2 style="color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h2>
    <p>Your property listing was successfully created on <strong>${creationDate}</strong>.</p>

    <h3 style="color: #2c3e50;">📄 Listing Details:</h3>
    <ul style="list-style-type: none; padding: 0;">
      <li><strong>Property type:</strong> ${property.propertyType}</li>
      <li><strong>City:</strong> ${property.city}</li>
      <li><strong>Country:</strong> ${property.country}</li>
      <li><strong>Surface:</strong> ${property.surface} m²</li>
      <li><strong>Price:</strong> €${Number(property.price).toLocaleString('en-US')}</li>
      <li><strong>Rooms:</strong> ${property.rooms}</li>
      <li><strong>Bedrooms:</strong> ${property.bedrooms}</li>
    </ul>

    <p>🔗 You can view your listing here:<br />
    <a href="https://uap.immo${property.url}" style="color: #1e87f0;" target="_blank">https://uap.immo${property.url}</a></p>

    <hr />

    <p>✅ <strong>Free sharing:</strong> Share this link freely.</p>
    <p>📈 <strong>SEO ready:</strong> Your page is optimized for search engines.</p>
    <p>📊 <strong>Analytics:</strong> Track views and traffic sources from your dashboard.</p>
    <p>✏️ <strong>Free edits:</strong> Update your listing anytime, for free.</p>
    <p>🚀 <strong>Boost listing:</strong> Purchase a <strong>promotion pack</strong> to increase visibility.</p>
    <p>📱 <strong>QR Code:</strong> Use your QR code to share, print, or display your listing.</p>

    <p style="margin-top: 20px;">
      👉 Go to your dashboard: <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Website: <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Thank you for choosing UAP Immo,<br />
    <strong>The UAP Immo Team</strong></p>
  </div>
  `
};



  await sendEmail(mailOptions);
}


app.post('/user/orders/renew', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.body;
    const existingOrder = await Order.findById(orderId);

    if (!existingOrder) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const orderDate = new Date(existingOrder.createdAt);
    const expirationDate = new Date(orderDate);
    expirationDate.setDate(orderDate.getDate() + 90);

    if (new Date() < expirationDate) {
      return res.status(400).json({ error: 'Cette commande n\'est pas encore expirée.' });
    }

    const newOrder = new Order({
      userId: existingOrder.userId,
      propertyId: existingOrder.propertyId,
      amount: existingOrder.amount,
      status: 'pending'
    });

    await newOrder.save();
    res.json({ message: 'Commande renouvelée avec succès.', orderId: newOrder._id });
  } catch (error) {
    console.error('Erreur lors du renouvellement de la commande :', error);
    res.status(500).json({ error: 'Erreur lors du renouvellement de la commande' });
  }
});


app.post('/send-contact', async (req, res) => {
  const { firstName, lastName, email, message, type } = req.body;

  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: process.env.CONTACT_EMAIL,
    subject: 'Nouveau message de contact',
    html: `
      <p><b>Nom :</b> ${firstName} ${lastName}</p>
      <p><b>Email :</b> ${email}</p>
      <p><b>Type :</b> ${type}</p>
      <p><b>Message :</b><br>${message}</p>
    `
  };

  try {
    await sendEmail(mailOptions);
    res.redirect('/contact?messageEnvoye=true');
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email :', error);
    res.status(500).send('Erreur lors de l\'envoi de l\'email.');
  }
});

app.post('/paypal/webhook', async (req, res) => {
  const axios = require('axios');
  const cfg = getPaypalConfig();

  try {
    // 1) OAuth
    const { data: token } = await axios.post(
      `${cfg.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: cfg.clientId, password: cfg.secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    const accessToken = token.access_token;

    // 2) Vérifier la signature
    const transmissionId   = req.header('paypal-transmission-id');
    const transmissionTime = req.header('paypal-transmission-time');
    const certUrl          = req.header('paypal-cert-url');
    const authAlgo         = req.header('paypal-auth-algo');
    const transmissionSig  = req.header('paypal-transmission-sig');
    const webhookEvent     = JSON.parse(req.body.toString('utf8')); // RAW -> string -> JSON

    const { data: verify } = await axios.post(
      `${cfg.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: cfg.webhookId, // TON ID de webhook sandbox
        webhook_event: webhookEvent
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (verify.verification_status !== 'SUCCESS') {
      console.warn('Webhook PayPal signature INVALID');
      return res.sendStatus(400);
    }

    // 3) Événement AUTHENTIQUE
    const event = webhookEvent;

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const orderId = capture?.supplementary_data?.related_ids?.order_id;

      // Idempotence: marque payé si pas déjà fait
      if (orderId) {
        await Order.findOneAndUpdate(
          { paypalOrderId: orderId },
          {
            $set: {
              status: 'paid',
              expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            }
          },
          { upsert: false }
        );
      }
      // (optionnel) email payé / facture ici...
    }

    // Répondre vite
    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook PayPal error:", error?.response?.data || error.message);
    return res.sendStatus(500);
  }
});
app.post('/paypal/mark-paid', isAuthenticatedJson, async (req, res) => {
  try {
    const { orderID, propertyId, amount, currency, captureId } = req.body;

    if (!orderID || !propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants (orderID, propertyId).'
      });
    }

    // --- DÉFINITION DES DONNÉES DE LA FACTURE POUR L'ENVOI D'EMAIL ---
    // Ces constantes sont définies ici pour être utilisées par le bloc asynchrone ci-dessous
    const fullName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
    const clientDetails = {
      userId: req.user._id.toString(),
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    };
    const companyDetails = {
        name: 'UAP Immo',
        address: ['123 Rue de la Liberté', '75000 Paris'], // 👈 VOS VRAIES ADRESSES
        siret: '123 456 789 00012', // 👈 VOTRE VRAI SIRET
        tva: 'FR12345678901', // 👈 VOTRE VRAI NUMÉRO (ou N/A)
    };
    const serviceDetails = {
      product: 'Pack de diffusion publicitaire',
      duration: '90 jours',
    };
    // -----------------------------------------------------------------

    // ✅ Si le captureId n'est pas fourni par le front, on tente de le récupérer chez PayPal
    let effectiveCaptureId = captureId || null;
    if (!effectiveCaptureId) {
      // Assurez-vous que resolveCaptureIdFromOrder est défini et fonctionne
      try {
        effectiveCaptureId = await resolveCaptureIdFromOrder(orderID);
      } catch (e) {
        console.warn('⚠️ Impossible de résoudre captureId via PayPal :', e?.message || e);
      }
    }

    // 🔎 Upsert commande
    let order = await Order.findOne({
      userId: req.user._id,
      propertyId,
      paypalOrderId: orderID
    });

    const paidAmount = parseFloat(amount || order?.amount || '500.00');

    if (!order) {
      order = new Order({
        userId: req.user._id,
        propertyId,
        amount: paidAmount,
        status: 'paid',
        paypalOrderId: orderID,
        paypalCaptureId: effectiveCaptureId,
        currency: currency || 'EUR',
        paidAt: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      });
      await order.save();
    } else {
      order.status = 'paid';
      order.paidAt = new Date();
      order.amount = paidAmount;
      order.currency = currency || order.currency || 'EUR';
      order.paypalCaptureId = effectiveCaptureId || order.paypalCaptureId;
      order.expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await order.save();
    }

    // ⚡️ Réponse immédiate
    const responseLocale =
      (req.cookies && req.cookies.locale) ||
      (req.params && req.params.locale) ||
      'fr';

    res.json({ success: true, redirectUrl: `/${responseLocale}/user` });

    // 📧 Email asynchrone (le bloc qui plantait)
    // On utilise l'objet 'order' mis à jour par l'upsert
    (async () => {
      try {
        await sendInvoiceByEmail(
          req.user.email,
          fullName,
          order.orderId,
          order.paypalOrderId,
          order.paypalCaptureId || '-',
          String(order.amount),
          order.currency || 'EUR',
          // Passage des 3 objets de données définis juste au-dessus
          clientDetails, 
          companyDetails, 
          serviceDetails
        );
        console.log('📧 Facture envoyée (async) avec succès pour', req.user.email);
      } catch (e) {
        console.warn('📧 Envoi facture KO (async) :', e?.message || e);
      }
    })();

  } catch (err) {
    console.error('❌ /paypal/mark-paid :', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.post('/btcpay/webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;
    const invoiceId = event.invoiceId || event.data?.id;

    if (['InvoicePaid', 'InvoicePaidInFull', 'InvoiceSettled'].includes(event.type)) {
      
      const order = await Order.findOneAndUpdate(
        { btcPayInvoiceId: invoiceId },
        { status: 'paid', paidAt: new Date() }, 
        { new: true } 
      ).populate('userId');

      if (order) {
        const user = order.userId;

        const clientDetails = {
            userId: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
        };
        const companyDetails = {
            name: 'UAP Immo',
            address: ['123 Rue de la Liberté', '75000 Paris'], // 👈 VOS ADRESSES
            siret: '123 456 789 00012', 
            tva: 'FR12345678901',
        };
        const serviceDetails = {
            product: 'Pack de diffusion publicitaire (BTC)',
            duration: '90 jours',
        };

        console.log(`💰 Paiement BTC confirmé pour la commande ${order.orderId}`);

        try {
            // Envoi de l'email avec le paramètre 'Bitcoin' à la fin
            await sendInvoiceByEmail(
              user.email,
              `${user.firstName} ${user.lastName}`,
              order.orderId,
              'BTCPAY-' + invoiceId, 
              'CRYPTO',              
              String(order.amount),
              'EUR',
              clientDetails,   
              companyDetails,  
              serviceDetails,
              'Bitcoin' // <== INDIQUE QUE C'EST UN PAIEMENT CRYPTO
            );
        } catch (emailErr) {
            console.error('⚠️ Erreur envoi email facture BTC:', emailErr.message);
        }

      } else {
        console.warn(`⚠️ Webhook BTC: Aucune commande trouvée pour Invoice ID : ${invoiceId}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erreur dans le webhook BTCPay :', error);
    res.sendStatus(500);
  }
});

// 🤖 ROUTE API CHATBOT
// 🤖 ROUTE API CHATBOT (Correction de la syntaxe)
app.post('/api/chat', isAuthenticated, isAdmin, async (req, res) => {
    const { message } = req.body;
    const user = req.user;

    try {
        let answer = null;
        let action = null; // Pour une action unique
        let actions = null; // Pour plusieurs actions (boutons)

        // 1. DÉTECTION INTELLIGENTE D'ID (Priorité absolue)
        const orderIdMatch = message.match(/(ORD-\d+|[0-9a-fA-F]{24})/);
        
        if (orderIdMatch) {
            const detectedId = orderIdMatch[0];
            
            // A. Est-ce une COMMANDE ?
            const order = await Order.findOne({ 
                $or: [{ orderId: detectedId }, { _id: (mongoose.isValidObjectId(detectedId) ? detectedId : null) }],
                userId: user._id 
            });

            if (order) {
                const today = new Date();
                const expiryDate = new Date(order.expiryDate);
                const daysLeft = Math.max(0, Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)));
                const statusMap = { 'paid': 'Payée ✅', 'pending': 'En attente ⏳' };
                
                answer = `**Commande ${order.orderId}** trouvée.<br>` +
                         `• Statut : ${statusMap[order.status] || order.status}<br>` +
                         `• Montant : ${order.amount} ${order.currency}<br>` +
                         (order.status === 'paid' ? `• Diffusion : Reste **${daysLeft} jours**` : '• Diffusion : Non active');
                
                action = { type: 'script', code: "showSection('orders');", label: "Voir dans Mes Commandes" };
                
                // On arrête ici et on envoie la réponse pour la commande
                return res.json({ response: answer, action });
            }

            // B. Est-ce une PROPRIÉTÉ ?
            if (mongoose.isValidObjectId(detectedId)) {
                const property = await Property.findOne({ _id: detectedId, userId: user._id });
                if (property) {
                    const dateCreation = new Date(property.createdAt).toLocaleDateString('fr-FR');
                    
                    answer = `**Page trouvée :** ${property.propertyType} à ${property.city}.<br>` +
                             `Créée le : ${dateCreation}.<br>` +
                             `Que voulez-vous faire ?`;
                    
                    // Tableau de plusieurs actions
                    actions = [
                        { 
                            type: 'link', 
                            url: property.url, 
                            label: "Voir la page",
                            style: "btn-outline-dark"
                        },
                        { 
                            type: 'script', 
                            code: `editProperty('${property._id}')`, 
                            label: "Modifier",
                            style: "btn-dark"
                        }
                    ];
                    
                    // On arrête ici et on envoie la réponse pour la propriété
                    return res.json({ response: answer, actions: actions });
                }
            }
        }

        // 2. ANALYSE NLP CLASSIQUE (Si aucun ID n'a été traité)
        const result = await manager.process('fr', message);
        const intent = result.intent;
        answer = result.answer; 

        // 3. RÉPONSES DYNAMIQUES (Surcharge la réponse par défaut)

        // --- PROFIL & ADRESSE ---
        if (intent === 'profile.info') {
             answer = "Vos informations personnelles sont dans l'onglet **Mon Profil**.";
             action = { type: 'script', code: "showSection('account');", label: "Voir mon profil" };
        }

        if (intent === 'profile.address') {
            if (user.billingAddress && user.billingAddress.street) {
                answer = `Adresse actuelle : ${user.billingAddress.street}, ${user.billingAddress.city}.`;
                action = { type: 'script', code: "openAddressEdit();", label: "Modifier mon adresse" };
            } else {
                answer = "Aucune adresse enregistrée. C'est nécessaire pour la facturation.";
                action = { type: 'script', code: "openAddressEdit();", label: "Ajouter une adresse" };
            }
        }

        if (intent === 'account.password') {
            answer = "Pour changer votre mot de passe, cliquez ci-dessous :";
            action = { type: 'link', text: 'Réinitialiser mot de passe', url: `/${req.locale}/forgot-password` };
        }

        // --- CRÉATION ---
        if (intent === 'listing.create') {
            answer = "Pour créer une annonce, suivez le guide en 4 étapes (Infos, Équipements, Photos, Description).";
            action = { type: 'script', code: "showSection('landing');", label: "Ouvrir le formulaire" };
        }
        
        if (intent === 'property.create') {
             answer = "Pour créer une annonce, cliquez sur le bouton ci-dessous.";
             action = { type: 'script', code: "showSection('landing');", label: "Ouvrir le formulaire" };
        }

        // --- COMMANDES ---
        if (intent === 'order.last') {
            const lastOrder = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 });
            if (lastOrder) {
                const statusMap = { 'paid': 'Payée ✅', 'pending': 'En attente ⏳' };
                answer = `Votre dernière commande (${lastOrder.orderId}) est **${statusMap[lastOrder.status]}**.`;
                action = { type: 'script', code: "showSection('orders');", label: "Voir mes commandes" };
            } else {
                answer = "Aucune commande trouvée.";
                action = { type: 'script', code: "showSection('landing');", label: "Créer une annonce" };
            }
        }
        
        if (intent === 'order.invoice') {
            const paidOrders = await Order.find({ userId: user._id, status: 'paid' });
            if (paidOrders.length > 0) {
                answer = `Vous avez **${paidOrders.length} facture(s)**. Téléchargez-les ici :`;
                action = { type: 'script', code: "showSection('orders');", label: "Voir mes commandes" };
            } else {
                answer = "Vous n'avez aucune facture disponible.";
            }
        }
        
        // --- STATISTIQUES ---
        if (intent === 'stats.info') {
             action = { type: 'script', code: "showSection('donnees');", label: "Voir le tableau" };
        }
        
        // --- PAIEMENT ---
        if (intent === 'payment.broadcast') {
            answer = "Pour diffuser, allez dans 'Pages créées' et cliquez sur le **Mégaphone**.";
            action = { type: 'script', code: "showSection('created-pages');", label: "Voir mes pages" };
        }

        // Fallback
        if (!answer && result.score < 0.5) {
            answer = "Je n'ai pas bien compris. Essayez de me donner un numéro de commande (ORD-...) ou demandez 'Comment créer une page'.";
        }

        res.json({ response: answer || "Désolé, je n'ai pas compris.", intent, action });

    } catch (error) { // L'accolade fermante du TRY est ici
        console.error('Erreur Chatbot:', error);
        res.status(500).json({ response: "Erreur interne." });
    }
});
try {
    // On essaie de lire les certificats
    const privateKey = fs.readFileSync('/home/ec2-user/appimmo/ssl/server.key', 'utf8');
    const certificate = fs.readFileSync('/home/ec2-user/appimmo/ssl/server.crt', 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    // Création du serveur HTTPS
    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(443, () => {
        console.log('✅ Serveur HTTPS lancé sur le port 443 (Sécurisé)');
    });

} catch (e) {
    console.error("❌ Erreur démarrage HTTPS :", e.message);
    // Si le HTTPS échoue (ex: certificats manquants), on lance en HTTP sur 8080 pour ne pas tout casser
    app.listen(8080, () => {
        console.log('⚠️ Fallback: Serveur HTTP de secours lancé sur le port 8080');
    });
}

// 3. Serveur de Redirection HTTP (Port 80) -> HTTPS
// Redirige automatiquement http://uap.immo vers https://uap.immo
try {
    http.createServer((req, res) => {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(80, () => {
        console.log('🔄 Serveur de redirection HTTP > HTTPS actif sur le port 80');
    });
} catch (e) {
    console.warn("⚠️ Impossible de lancer le serveur de redirection sur le port 80 (Permission denied ou occupé ?)");
}
