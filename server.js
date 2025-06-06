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
const mongoose = require('mongoose');
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
const crypto = require('crypto');
const { getPageStats } = require('./getStats');
const Page = require('./models/Page');
const nodemailer = require('nodemailer');
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
const { sendInvoiceByEmail, sendMailPending } = require('./utils/email');
const supportedLocales = ['fr', 'en'];
const { addToSitemap, pingSearchEngines } = require('./utils/seo');


const app = express();

// Middleware
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());
app.use(i18n.init);




app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 heures
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
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
});
// Middleware global pour rendre isAuthenticated et user accessibles dans toutes les vues EJS

// Middleware : prolonger la session active
app.use((req, res, next) => {
  const path = req.path;

  if (req.session && req.session.touch && req.isAuthenticated && req.isAuthenticated()) {
    req.session.touch();
  }

  next();
});

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
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
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

    console.log('🔍 Récupération des stats pour', pageId);
    console.log("👤 Utilisateur connecté :", req.user);


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

    console.log('✅ Stats récupérées :', stats);
    return res.json(stats);

  } catch (err) {
    console.error('❌ Erreur API /api/stats/:pageId =>', err.message || err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});




app.get('/:locale/payment', isAuthenticated, async (req, res) => {
    const { locale } = req.params;  // Récupérer la langue depuis l'URL
    const { propertyId } = req.query;

    try {
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).send('Property not found');
        }

        // Charger les traductions spécifiques à la langue
        const translationsPath = `./locales/${locale}/payment.json`;
        let i18n = {};

        try {
            i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
        } catch (error) {
            console.error(`Erreur lors du chargement des traductions pour ${locale}:`, error);
            return res.status(500).send('Erreur lors du chargement des traductions.');
        }

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
            PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID
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

app.post('/:lang/reset-password/:token', async (req, res) => {
  const { password, confirmPassword, code } = req.body;
  const locale = req.params.lang;

  if (password !== confirmPassword) {
    req.flash('error', 'Les mots de passe ne correspondent pas.');
    return res.redirect('back');
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Le token de réinitialisation est invalide ou a expiré.');
      return res.redirect(`/${locale}/forgot-password`);
    }

    if (user.resetPasswordCode !== code) {
      req.flash('error', locale === 'fr' ? 'Code de vérification incorrect.' : 'Invalid verification code.');
      return res.redirect('back');
    }

    user.setPassword(password, async (err) => {
      if (err) {
        req.flash('error', 'Erreur lors de la réinitialisation du mot de passe.');
        return res.redirect('back');
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



app.post('/:locale/login', (req, res, next) => {
    const locale = req.params.locale || 'fr';

    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error', 'Identifiants incorrects.');
            return res.redirect(`/${locale}/login`);
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            if (user.twoFactorEnabled) {
                req.session.tmpUserId = user._id;
                return res.redirect(`/${locale}/2fa`);
            }

            // Si la 2FA n’est pas activée, on va directement sur /user
            return res.redirect(`/${locale}/user`);
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
app.post('/logout', (req, res) => {
  req.logout?.(); // si tu utilises passport
  req.session.destroy(() => {
    res.redirect('/');
  });
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

// Route pour la page utilisateur avec locale et récupération des propriétés
app.get('/:locale/user', ensureAuthenticated, async (req, res) => {
  const { locale } = req.params;
  const user = req.user;

  if (!user) {
    return res.redirect(`/${locale}/login`);
  }

  // ✅ Débug : on récupère les annonces de tous les utilisateurs
  let userLandingPages = await Property.find({}); // TEMPORAIRE pour debug

  console.log("Liste brute des userId en base :");
  userLandingPages.forEach(page => {
    console.log("➡️", page.userId?.toString());
  });
  console.log("Utilisateur connecté :", user._id.toString());

  // ✅ Puis on récupère uniquement celles du user connecté (on réutilise la même variable)
  userLandingPages = await Property.find({ userId: user._id }); // REÉCRITURE de la variable

  const userTranslationsPath = `./locales/${locale}/user.json`;
  let userTranslations = {};

  try {
    userTranslations = JSON.parse(fs.readFileSync(userTranslationsPath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lors du chargement des traductions : ${error}`);
    return res.status(500).send('Erreur lors du chargement des traductions.');
  }

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
  stats: statsArray
});

});




app.get('/:locale/enable-2fa', isAuthenticated, async (req, res) => {
  const locale = req.params.locale || 'fr';

  try {
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

    const qrCode = await QRCode.toDataURL(otpAuthUrl);

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
    currentPath: req.originalUrl
});
});

app.post('/send-contact', async (req, res) => {
    const { firstName, lastName, email, message, type } = req.body;

    // Configurer les options d'email
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
        // Envoyer l'email avec le transporteur
        await sendEmail(mailOptions);
        const locale = req.cookies.locale || 'fr';
res.redirect(`/${locale}/contact?messageEnvoye=true`);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email :', error);
        res.status(500).send('Erreur lors de l\'envoi de l\'email.');
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
        messages: req.flash() // Pour afficher d'éventuelles erreurs d'inscription
    });
});

app.use('/pdf', pdfRoutes);

const axios = require('axios'); // tout en haut de ton fichier

app.post('/:locale/register', async (req, res) => {
  const { email, firstName, lastName, role, password, confirmPassword, 'g-recaptcha-response': captcha } = req.body;
  const locale = req.params.locale;

  // ⚠️ Si captcha vide
  if (!captcha) {
    req.flash('error', 'Veuillez valider le CAPTCHA.');
    return res.redirect(`/${locale}/register`);
  }

  // 🔍 Vérification reCAPTCHA
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

  // ✅ Validation email et mot de passe
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

  try {
    const newUser = await User.register(new User({ email, firstName, lastName, role }), password);
await sendAccountCreationEmail(newUser.email, newUser.firstName, newUser.lastName, locale);

    req.login(newUser, (err) => {
      if (err) {
        console.error('Erreur lors de la connexion automatique après inscription :', err);
        req.flash('error', 'Erreur de connexion automatique.');
        return res.redirect(`/${locale}/login`);
      }

      res.redirect(`/${locale}/enable-2fa`);
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription :', error.message);
    req.flash('error', `Une erreur est survenue lors de l'inscription : ${error.message}`);
    res.redirect(`/${locale}/register`);
  }
});

app.get('/:locale/2fa', (req, res) => {
  const { locale } = req.params;

  if (!req.session.tmpUserId) {
    return res.redirect(`/${locale}/login`);
  }

  const translationsPath = `./locales/${locale}/2fa.json`;
  let i18n = {};
  try {
    i18n = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lors du chargement des traductions pour ${locale}:`, error);
    return res.status(500).send('Erreur lors du chargement des traductions.');
  }

  res.render('2fa', {
  locale,
  i18n,
  messages: req.flash(),
  currentPath: req.originalUrl,
  showAccountButtons: false 
});


});



app.post('/:locale/2fa', async (req, res) => {
  const { locale } = req.params;
  const { code } = req.body;

  const tmpUserId = req.session.tmpUserId;

  if (!tmpUserId) {
    return res.redirect(`/${locale}/login`);
  }

  try {
    const user = await User.findById(tmpUserId);
    if (!user || !user.twoFactorSecret) {
      req.flash('error', 'Erreur de validation 2FA.');
      return res.redirect(`/${locale}/login`);
    }

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

    // Connexion réussie
    delete req.session.tmpUserId;
    req.login(user, (err) => {
      if (err) {
        req.flash('error', 'Erreur de connexion.');
        return res.redirect(`/${locale}/login`);
      }
      return res.redirect(`/${locale}/user`);
    });

  } catch (err) {
    console.error('Erreur 2FA:', err);
    req.flash('error', 'Une erreur est survenue.');
    res.redirect(`/${locale}/login`);
  }
});

app.post('/add-property', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
  try {
    if (typeof req.body.parking === 'undefined') {
      return res.status(400).send('Le champ parking est requis.');
    }
    const property = new Property({
      rooms: req.body.rooms,
      bedrooms: req.body.bedrooms,
      surface: req.body.surface,
      price: parseFloat(req.body.price),
      city: req.body.city,
postalCode: req.body.postalCode,
      country: req.body.country,
      description: req.body.description,
      yearBuilt: req.body.yearBuilt || null,
      pool: req.body.pool === 'true',
      propertyType: req.body.propertyType,
      fireplace: req.body.fireplace === 'true',
      wateringSystem: req.body.wateringSystem === 'true',
      carShelter: req.body.carShelter === 'true',
      parking: req.body.parking === 'true',
      caretakerHouse: req.body.caretakerHouse === 'true',
      electricShutters: req.body.electricShutters === 'true',
      outdoorLighting: req.body.outdoorLighting === 'true',
      contactFirstName: req.body.contactFirstName,
      contactLastName: req.body.contactLastName,
      contactPhone: req.body.contactPhone,
      language: req.body.language || 'fr',
      userId: req.user._id,
      dpe: req.body.dpe || 'En cours',
      photos: [req.files.photo1[0].filename, req.files.photo2[0].filename]
    });

    await property.save();

    const landingPageUrl = await generateLandingPage(property);
    property.url = landingPageUrl;
    await property.save();

    // ✅ Envoi d’email après sauvegarde complète
    const user = await User.findById(req.user._id);
    await sendPropertyCreationEmail(user, property);

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
    res.status(500).send('Erreur lors de l\'ajout de la propriété.');
  }
});

app.get('/property/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property || !property.userId.equals(req.user._id)) {
      return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
    }

    const locale = req.language || 'fr'; // ou req.query.lang || 'fr' selon ton système
    const currentPath = req.originalUrl;

    const i18n = {
      menu: {
        home: locale === 'fr' ? 'Accueil' : 'Home',
        contact: locale === 'fr' ? 'Contact' : 'Contact',
      }
    };

    res.render('edit-property', {
      property,
      locale,
      currentPath,
      i18n,
      isAuthenticated: req.isAuthenticated()
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la propriété:', error);
    res.status(500).send('Une erreur est survenue lors de la récupération de la propriété.');
  }
});

app.post('/property/update/:id', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property || !property.userId.equals(req.user._id)) {
      return res.status(403).send("Vous n'êtes pas autorisé à modifier cette propriété.");
    }

    // Mettre à jour les champs depuis le formulaire
    property.rooms = req.body.rooms;
    property.bedrooms = req.body.bedrooms;
    property.surface = req.body.surface;
    property.price = req.body.price;
    property.city = req.body.city;
    property.country = req.body.country;
    property.yearBuilt = req.body.yearBuilt;
    property.propertyType = req.body.propertyType;
    property.dpe = req.body.dpe;
    property.description = req.body.description;

    // Champs booléens des équipements (venant de <select> avec 'true' ou 'false' comme valeurs)
    property.pool = req.body.pool === 'true';
    property.doubleGlazing = req.body.doubleGlazing === 'true';
    property.wateringSystem = req.body.wateringSystem === 'true';
    property.barbecue = req.body.barbecue === 'true';
    property.carShelter = req.body.carShelter === 'true';
    property.parking = req.body.parking === 'true';
    property.caretakerHouse = req.body.caretakerHouse === 'true';
    property.electricShutters = req.body.electricShutters === 'true';
    property.outdoorLighting = req.body.outdoorLighting === 'true';

    // ➕ Mise à jour des photos si présentes
    if (req.files) {
      if (req.files.photo1 && req.files.photo1[0]) {
        property.photo1 = req.files.photo1[0].filename;
      }
      if (req.files.photo2 && req.files.photo2[0]) {
        property.photo2 = req.files.photo2[0].filename;
      }
    }

   await property.save();

// 🆕 Regénérer la landing page après mise à jour
const updatedLandingPageUrl = await generateLandingPage(property);
property.url = updatedLandingPageUrl;
await property.save();


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
    res.status(500).send("Erreur interne du serveur.");
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


app.post('/process-paypal-payment', isAuthenticated, async (req, res) => {
  try {
    const { orderID, propertyId, amount } = req.body;

    // 🔎 Étape 1 : Vérifier s’il y a déjà une commande active
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

    // 🔄 Étape 2 : Créer la nouvelle commande
    const newOrder = new Order({
      userId: req.user._id,
      propertyId,
      amount: parseFloat(amount),
      status: 'pending',
      paypalOrderId: orderID,
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 jours
    });

    await newOrder.save();

    // 📧 Étape 3 : Envoyer l’e-mail
    try {
      await sendMailPending(
  req.user.email,
  `${req.user.firstName} ${req.user.lastName}`,
  newOrder.orderId,
  amount
);
    } catch (err) {
      console.warn("📭 Erreur envoi mail d'attente :", err.message);
    }

    const locale = req.cookies.locale || 'fr';
    res.json({ success: true, redirectUrl: `/${locale}/user` });

  } catch (err) {
    console.error("❌ Erreur process-paypal-payment :", err);
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



function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const seoKeywords = require('./utils/seoKeywords'); 
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
  const filePath = path.join(__dirname, 'public/landing-pages', filename);
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
      font-family: Arial, sans-serif;
    }

    body {
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
  /* Removed fixed height to avoid overflowing */
  /* height: 100%; */
  /* Eliminated gap to keep elements compact */
  /* gap: 15px; */
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
      margin-bottom: 15px;
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
      font-size: 14px;
      overflow-wrap: break-word;
    }

    .section-title {
      font-size: 1.1rem;
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


    /* Responsive mobile */
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
h1 {
  font-size: 1.8rem;
  line-height: 1.3;
  font-weight: 500;
  margin-bottom: 15px;
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
    font-size: 1.1rem;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .property-description {
    margin-top: 20px;
    margin-bottom: 20px;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: break-word;
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


  .extra-info-desktop {
    display: block;
    padding: 10px 20px;
    font-family: Arial, sans-serif;
 margin-top: 0;
    text-align: left; /* aligné comme "Type de bien" */
  }

  .extra-info-desktop h2 {
    font-size: 1.4rem;
    margin-bottom: 20px;
    text-align: left;
    font-weight: 500;
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

    .visit-btn {
      width: 100%;
      margin: 20px 0;
      flex: 1;
      background: none;
      border: none;
      color: #000;
      font-weight: 600;
      padding: 12px 20px 16px;
      cursor: pointer;
      font-size: 1.2rem;
      font-family: sans-serif;
      position: relative;
    }

    .visit-btn::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 12.5%;
      width: 75%;
      height: 2px;
      background-color: currentColor;
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
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      min-width: 320px;
    }

    .contact-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .contact-item button {
      padding: 6px 12px;
      border: none;
      background: #eee;
      cursor: pointer;
    }
    .visit-modal .close {
      position: absolute;
      top: 10px;
      right: 20px;
      cursor: pointer;
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
      </div>
      <div id="visitModal" class="visit-modal">
        <div class="visit-modal-content">
          <span id="closeModal" class="close">&times;</span>
          <div class="contact-item">
            <span id="contactPhone">${property.contactPhone || ''}</span>
            <button id="copyPhoneBtn">Copier le téléphone</button>
          </div>
          <div class="contact-item">
            <span id="contactName">${property.contactFirstName || ''} ${property.contactLastName || ''}</span>
            <button id="copyNameBtn">Copier le nom</button>
          </div>
        </div>
      </div>
    </div>
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
    const copyPhoneBtn = document.getElementById('copyPhoneBtn');
    const copyNameBtn = document.getElementById('copyNameBtn');
    const contactPhone = document.getElementById('contactPhone');
    const contactName = document.getElementById('contactName');

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

    if (copyPhoneBtn && contactPhone) {
      copyPhoneBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(contactPhone.textContent.trim());
      });
    }

    if (copyNameBtn && contactName) {
      copyNameBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(contactName.textContent.trim());
      });
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

app.post('/paypal/webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource.id;

      // 👉 Ajout de cette ligne
      const isProduction = process.env.NODE_ENV === 'production';
      const paypalBaseUrl = isProduction
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

      // Étape 1 : Authentification
      const { data: tokenData } = await axios({
        method: 'post',
        url: `${paypalBaseUrl}/v1/oauth2/token`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_SECRET
        },
        data: 'grant_type=client_credentials'
      });

      const accessToken = tokenData.access_token;

      // Étape 2 : Capture
      const captureRes = await axios({
        method: 'post',
        url: `${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const captureData = captureRes.data;

      // Étape 3 : Infos paiement
      const email = captureData.payer.email_address;
      const amount = captureData.purchase_units[0].payments.captures[0].amount.value;
if (parseFloat(amount) !== expectedAmount) {
  console.warn(`❗ Montant incohérent : attendu ${expectedAmount}, reçu ${amount}`);
}
      const currency = captureData.purchase_units[0].payments.captures[0].amount.currency_code;
      const transactionId = captureData.purchase_units[0].payments.captures[0].id;

      // Étape 4 : Mettre à jour la commande
      const updated = await Order.findOneAndUpdate(
        { paypalOrderId: orderId },
        { status: 'paid' }
      );

      if (!updated) {
        console.warn(`⚠️ Aucune commande trouvée avec PayPal ID : ${orderId}`);
      }

      // Étape 5 : Envoyer la facture
      await sendInvoiceByEmail(email, transactionId, amount, currency);

      res.sendStatus(200);
    } else {
      res.sendStatus(200); // Ignorer autres événements
    }
  } catch (error) {
    console.error("❌ Erreur dans le webhook PayPal :", error.response?.data || error.message);
    res.sendStatus(500);
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
