require('dotenv').config();
console.log("Stripe Public Key:", process.env.STRIPE_PUBLIC_KEY);

process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});

// Gérer les promesses rejetées non gérées
process.on('unhandledRejection', function (err, promise) {
  console.error('Unhandled Rejection:', err);
});
//ajout 2 lignes en dessous
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const flash = require('express-flash');

const path = require('path');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const LocalStrategy = require('passport-local').Strategy;

const User = require('./models/User');
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

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
const { getMultiplePageStats } = require('./getStats');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const invalidLocales = [
    'favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php',
    'config', '.env', 'server_info.php', 'wp-config.php', 'index.js', 'settings.py'
];
const tempAuthStore = {}; // { sessionId: user }
const pdfRoutes = require('./routes/pdf');
const { sendEmail } = require('./services/email');

const secretKey = process.env.RECAPTCHA_SECRET_KEY;
const authRoutes = require('./routes/auth');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
  maxAge: 1000 * 60 * 60 * 2,
  secure: process.env.NODE_ENV === 'production', // HTTPS
  httpOnly: true,
  sameSite: 'lax'
}
}));
passport.use(User.createStrategy());
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
app.use(passport.initialize());
app.use(passport.session());
// Middleware
app.use(compression());
app.use(cookieParser());


app.use(flash());
app.use(i18n.init);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameSrc: ["'self'", "https:"]
      }
    }
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes par IP
  message: 'Trop de requêtes, réessayez plus tard.',
  skip: (req) => {
    return req.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/);
  }
});


// Appliquer la limitation SEULEMENT aux routes sensibles
app.use('/login', limiter);
app.use('/register', limiter);
app.use('/forgot-password', limiter);
app.use('/verify-2fa', limiter);
app.use('/reset-password', limiter);

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated && req.isAuthenticated();
  res.locals.currentPath = req.path;
  next();
});

app.use('/', authRoutes);




app.use('/property', require('./routes/property'));


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
});
// Middleware global pour rendre isAuthenticated et user accessibles dans toutes les vues EJS
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated?.() || false;
  res.locals.user = req.user || null;
  next();
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

    const landingPages = await getLandingPagesFromDB(req.user.id);
    console.log('✅ Landing pages récupérées :', landingPages.length);

    const matchingPage = landingPages.find(page => page._id.toString() === pageId);
    if (!matchingPage) {
      console.error('❌ Page non trouvée pour l’ID :', pageId);
      return res.status(404).json({ error: 'Page non trouvée' });
    }

    if (!matchingPage.url) {
      console.error('❌ Aucun champ "url" pour la page :', matchingPage._id);
      return res.status(500).json({ error: 'Champ "url" manquant pour cette page' });
    }

    const pagePath = matchingPage.url.startsWith('/landing-pages/')
      ? matchingPage.url
      : `/landing-pages/${matchingPage.url}`;

    console.log('📊 Statistiques pour le chemin :', pagePath);

    const stats = await getPageStats(pagePath, startDate, endDate);

    if (!stats || typeof stats !== 'object') {
      console.error('❌ Statistiques non valides pour :', pagePath, stats);
      return res.status(500).json({ error: 'Statistiques non valides' });
    }

    console.log('✅ Stats récupérées :', stats);
    res.json(stats);
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
currentPath: req.originalUrl 
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



// Middleware : accessible uniquement SI connecté
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect(`/${req.params.locale || 'fr'}/login`);
}

// Middleware : accessible uniquement SI NON connecté
function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }
  res.redirect(`/${req.params.locale || 'fr'}/dashboard`); // ou autre page pour les membres
}




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
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
    await user.save();

    const resetUrl = `http://${req.headers.host}/${locale}/reset-password/${token}`;
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Réinitialisation du mot de passe',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #52566f;">Réinitialisation de votre mot de passe</h2>
          <p>Bonjour,</p>
          <p>Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte UAP Immo.</p>
          
          <p style="font-size: 16px; color: #52566f;">Que devez-vous faire ?</p>
          <p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le lien ci-dessous :</p>
          <p><a href="${resetUrl}" style="color: #52566f; text-decoration: underline;">Réinitialiser mon mot de passe</a></p>
    
          <p>Ce lien est valide pendant 1 heure. Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
    
          <p style="font-size: 16px; color: #52566f;">Besoin d'aide ?</p>
          <p>Si vous avez des questions ou avez besoin d'aide, n'hésitez pas à nous contacter à <a href="mailto:support@uap.company" style="color: #52566f; text-decoration: underline;">support@uap.company</a>.</p>
    
          <p>Cordialement,</p>
          <p>L'équipe UAP Immo</p>
          
          <hr>
          <p style="font-size: 12px; color: #888;">Cet email a été envoyé automatiquement, merci de ne pas y répondre. Pour toute assistance, contactez-nous à <a href="mailto:support@uap.company" style="color: #52566f; text-decoration: underline;">support@uap.company</a>.</p>
        </div>
      `
    };
    await sendEmail(mailOptions);

    req.flash('success', 'Un email avec des instructions pour réinitialiser votre mot de passe a été envoyé.');
    return res.redirect(`/${locale}/forgot-password?emailSent=true`);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    req.flash('error', 'Une erreur est survenue lors de la réinitialisation du mot de passe.');
    return res.redirect(`/${locale}/forgot-password`);
  }
});

app.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Le token de réinitialisation est invalide ou a expiré.');
      return res.redirect('/forgot-password');
    }

    res.render('reset-password', { token: req.params.token });
  } catch (error) {
    console.error('Erreur lors de la vérification du token :', error);
    req.flash('error', 'Une erreur est survenue lors de la vérification du token.');
    res.redirect('/forgot-password');
  }
});

app.post('/reset-password/:token', async (req, res) => {
  const { password, confirmPassword } = req.body;

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
      return res.redirect('/forgot-password');
    }

    user.setPassword(password, async (err) => {
      if (err) {
        req.flash('error', 'Erreur lors de la réinitialisation du mot de passe.');
        return res.redirect('back');
      }

      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      req.flash('success', 'Votre mot de passe a été mis à jour avec succès.');
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe :', error);
    req.flash('error', 'Une erreur est survenue lors de la mise à jour du mot de passe.');
    res.redirect('/forgot-password');
  }
});

app.get('/api/stats/:id', async (req, res) => {
  const pageId = req.params.id;
  const pagePath = `/landing-pages/${pageId}.html`;

  try {
    const views = await getPageViews(pagePath);
    res.json({ page: pagePath, views });
  } catch (error) {
    res.status(500).json({ error: 'Erreur API Analytics' });
  }
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
// Middleware d'authentification

app.post('/logout', (req, res) => {
  req.logout?.(); // si tu utilises passport
  req.session.destroy(() => {
    res.redirect('/');
  });
});





app.get('/faq', (req, res) => {
  res.render('faq', { title: 'faq' });
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



app.use('/pdf', pdfRoutes);

const axios = require('axios'); // tout en haut de ton fichier








app.post('/add-property', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
  try {
    const property = new Property({
      rooms: req.body.rooms,
      bedrooms: req.body.bedrooms,
      surface: req.body.surface,
      price: parseFloat(req.body.price), // ✅ Convertir en nombre avant d'enregistrer
      city: req.body.city,
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
      createdBy: req.user._id,
      dpe: req.body.dpe || 'En cours',
      photos: [req.files.photo1[0].filename, req.files.photo2[0].filename]
    });

    await property.save();

    const landingPageUrl = await generateLandingPage(property);
    property.url = landingPageUrl;
    await property.save();

    const successMessage = `
      <div class="alert alert-success" role="alert">
        Propriété ajoutée avec succès ! URL de la landing page : <a href="${property.url}" target="_blank">${property.url}</a>
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

    if (!property || !property.createdBy.equals(req.user._id)) {
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

    if (!property || !property.createdBy.equals(req.user._id)) {
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
    console.log("🔍 Requête reçue pour /user/properties, utilisateur :", req.user);
    
    const properties = await Property.find({ createdBy: req.user._id });
    
    console.log("✅ Propriétés récupérées :", properties);

    res.json(properties);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des propriétés :", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la récupération des propriétés." });
  }
});

app.get('/user/landing-pages', isAuthenticated, async (req, res) => {
    try {
        // Récupère les propriétés créées par l'utilisateur connecté
        const landingPages = await Property.find({ createdBy: req.user._id });

        res.json(landingPages);
    } catch (error) {
        console.error("Erreur lors de la récupération des landing pages :", error);
        res.status(500).json({ error: "Une erreur est survenue lors de la récupération des landing pages." });
    }
});
app.post('/process-paypal-payment', isAuthenticated, async (req, res) => {
    try {
        const { orderID, propertyId, amount } = req.body;

        // Tu peux faire une requête à l’API PayPal pour vérifier la validité du paiement ici (facultatif avec capture())

        const newOrder = new Order({
            userId: req.user._id,
            propertyId,
            amount: parseInt(amount, 10),
            status: 'paid',
            expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        });

        await newOrder.save();

        const locale = req.cookies.locale || 'fr';
        const redirectUrl = `/${locale}/user`;

        res.json({ success: true, redirectUrl });

    } catch (err) {
        console.error("❌ Erreur process-paypal-payment :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/process-payment', isAuthenticated, async (req, res) => {
    try {
        const { stripeToken, amount, propertyId } = req.body;
        const userId = req.user._id;

        console.log("🔍 Paiement en cours...");
        console.log("Stripe Token:", stripeToken);
        console.log("Amount:", amount);
        console.log("Property ID:", propertyId);
        console.log("User ID:", userId);

        if (!stripeToken || !amount || !propertyId) {
            console.error("❌ Données manquantes pour le paiement.");
            return res.status(400).json({ error: 'Données manquantes' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: parseInt(amount, 10) * 100,
            currency: 'eur',
            payment_method: stripeToken,
            confirm: true,
            return_url: `https://uap.immo/payment-success?propertyId=${propertyId}`,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: "always"
            }
        });

        console.log("✅ Paiement réussi:", paymentIntent);

        const order = new Order({
    userId,
    propertyId,
    amount: parseInt(amount, 10),
    status: 'paid',
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
});

console.log("🔍 Nouvelle commande enregistrée :", order);

await order.save();


        // Déterminer la redirection en fonction de la langue
        const locale = req.cookies.locale || 'fr';
        const redirectUrl = `/${locale}/user#`;

        res.status(200).json({
            message: 'Paiement réussi',
            orderId: order._id,
            redirectUrl // ✅ Correction de la redirection
        });
    } catch (error) {
        console.error("❌ Erreur lors du paiement :", error);
        res.status(500).json({ error: error.message || 'Erreur de paiement' });
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


async function generateLandingPage(property) {
     const GTM_ID = 'GTM-TF7HSC3N'; 
    const GA_MEASUREMENT_ID = 'G-0LN60RQ12K'; 

    const template = `
          <!DOCTYPE html>
<html lang="fr">
<head>
  <!-- Google Tag Manager -->
  <script>
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${GTM_ID}');
  </script>
  <!-- Fin Google Tag Manager -->
<!-- Leaflet CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<!-- Leaflet JS -->
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Propriété à ${property.city}, ${property.country}</title>

  <link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet" />

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
      .container {
        flex-direction: column;
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
</html>`;

    
    const filePath = path.join(__dirname, 'public', 'landing-pages', `${property._id}.html`);
    fs.writeFileSync(filePath, template);

    return `/landing-pages/${property._id}.html`;
}



async function getLandingPagesFromDB(userId) {
  return await Property.find({ createdBy: userId });
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
// Gestion globale des erreurs (dernière ligne avant app.listen)
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err); // Log utile en interne
  if (process.env.NODE_ENV === 'production') {
    res.status(500).send('Erreur interne.');
  } else {
    // En développement, on affiche l'erreur complète pour debug
    res.status(500).send(`<pre>${err.stack}</pre>`);
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
