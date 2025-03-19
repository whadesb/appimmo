require('dotenv').config();
console.log("Stripe Public Key:", process.env.STRIPE_PUBLIC_KEY);

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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const compression = require('compression');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const crypto = require('crypto');
const { getPageViews } = require('./analytics');
const Page = require('./models/Page');
const nodemailer = require('nodemailer');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const invalidLocales = [
    'favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php',
    'config', '.env', 'server_info.php', 'wp-config.php', 'index.js', 'settings.py'
];

const app = express();

// Middleware
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());
app.use(i18n.init);

app.use((req, res, next) => {
  if (req.query.lang) {
    res.cookie('locale', req.query.lang, { maxAge: 900000, httpOnly: true });
    res.setLocale(req.query.lang);
  } else if (req.cookies.locale) {
    res.setLocale(req.cookies.locale);
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 heures
}));
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

// Middleware de déconnexion automatique après expiration de la session
app.use((req, res, next) => {
  if (req.session && req.session.cookie.expires < new Date()) {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.clearCookie('connect.sid');

        // Détecter la langue du cookie, sinon utiliser 'fr' par défaut
        const locale = req.cookies.locale || req.acceptsLanguages('en', 'fr') || 'fr';

        // Vérifier si la langue est bien 'fr' ou 'en', sinon forcer 'fr'
        const validLocale = ['fr', 'en'].includes(locale) ? locale : 'fr';

        res.redirect(`/${validLocale}/login`);
      });
    });
  } else {
    next();
  }
});
app.get('/config', (req, res) => {
  res.json({ publicKey: process.env.STRIPE_PUBLIC_KEY });
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

// Route spécifique pour la configuration Stripe (évite "Not Found")
app.get('/config', (req, res) => {
    res.json({ publicKey: process.env.STRIPE_PUBLIC_KEY });
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
// Route API pour récupérer les statistiques d'une page spécifique
app.get('/api/stats/:id', async (req, res) => {
    const pageId = req.params.id;
    const pagePath = `/landing-pages/${pageId}.html`;

    try {
        const stats = await getPageStats(pagePath);
        res.json(stats);
    } catch (error) {
        console.error('Erreur API Analytics:', error);
        res.status(500).json({ error: 'Erreur API Analytics' });
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
            url: property.url
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
        i18n: translations
    });
});



// Route dynamique pour la page de connexion avec gestion de la langue
app.get('/', (req, res) => {
    const excludedPaths = ['config', 'favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php'];
    
    // Vérifier si la requête concerne une route spécifique (ex: /config)
    if (excludedPaths.includes(req.path.replace('/', ''))) {
        return res.sendStatus(404);
    }

    const acceptedLanguages = req.acceptsLanguages(); // Langues acceptées par le navigateur
    const defaultLocale = 'fr'; // Langue par défaut

    // Vérifier si l'utilisateur préfère l'anglais
    if (acceptedLanguages.includes('en')) {
        res.redirect('/en');
    } else {
        res.redirect(`/${defaultLocale}`); // Rediriger vers la langue par défaut (français)
    }
});


// Redirection vers la langue par défaut (ex: français) si aucune langue n'est spécifiée
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
        locale: locale,
        i18n: i18n,
        messages: req.flash()
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
    messages: req.flash()
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


app.post('/:locale/login', (req, res, next) => {
    const locale = req.params.locale || 'fr';  // Récupérer la langue dans l'URL ou 'fr' par défaut

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error', 'Erreur d\'authentification.');
            return res.redirect(`/${locale}/login`);  // Rediriger en cas d'erreur
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.redirect(`/${locale}/user`);  // Rediriger vers la page utilisateur avec la langue
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

// Route pour la page utilisateur avec locale et récupération des propriétés
app.get('/:locale/user', isAuthenticated, async (req, res) => {
    const { locale } = req.params;
    const user = req.user;
    if (!user) {
        return res.redirect(`/${locale}/login`);
    }
    
    const userTranslationsPath = `./locales/${locale}/user.json`;
    let userTranslations = {};

    try {
        userTranslations = JSON.parse(fs.readFileSync(userTranslationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    res.render('user', {
        locale,
        user,
        i18n: userTranslations
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
        i18n: i18n, // Passer les traductions fusionnées
        messageEnvoye: messageEnvoye
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
    const { locale } = req.params;
    res.render('register', { locale });
});

app.get('/:lang/register', (req, res) => {
  const locale = req.params.lang;
  const registerTranslationsPath = `./locales/${locale}/register.json`;

  let registerTranslations = {};

  try {
    registerTranslations = JSON.parse(fs.readFileSync(registerTranslationsPath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lors du chargement des traductions : ${error}`);
    return res.status(500).send('Erreur lors du chargement des traductions.');
  }

  // Rendre la page avec les traductions spécifiques à la langue choisie
  res.render('register', {
    title: registerTranslations.title,
    locale: locale,  // Langue active
    i18n: registerTranslations,  // Traductions spécifiques
    messages: req.flash()
  });
});

// Redirection par défaut
app.get('/register', (req, res) => {
  res.redirect('/fr/register');
});


app.post('/register', async (req, res) => {
  const { email, firstName, lastName, role, password, confirmPassword } = req.body;

  if (!validator.isEmail(email)) {
    req.flash('error', 'L\'adresse email n\'est pas valide.');
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Les mots de passe ne correspondent pas.');
    return res.redirect('/register');
  }

  const passwordRequirements = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRequirements.test(password)) {
    req.flash('error', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole spécial.');
    return res.redirect('/register');
  }

  try {
    const newUser = await User.register(new User({ email, firstName, lastName, role }), password);
    await sendAccountCreationEmail(newUser.email);
    res.redirect('/login');
  } catch (error) {
    console.error('Erreur lors de l\'inscription :', error.message);
    req.flash('error', `Une erreur est survenue lors de l'inscription : ${error.message}`);
    res.redirect('/register');
  }
});

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
      bathrooms: req.body.bathrooms || null,
      toilets: req.body.toilets || null,
      elevator: req.body.elevator === 'true',
      fireplace: req.body.fireplace === 'true',
      internet: req.body.internet === 'true',
      doubleGlazing: req.body.doubleGlazing === 'true',
      wateringSystem: req.body.wateringSystem === 'true',
      barbecue: req.body.barbecue === 'true',
      carShelter: req.body.carShelter === 'true',
      parking: req.body.parking === 'true',
      caretakerHouse: req.body.caretakerHouse === 'true',
      electricShutters: req.body.electricShutters === 'true',
      outdoorLighting: req.body.outdoorLighting === 'true',
      createdBy: req.user._id,
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

    res.render('edit-property', { property });
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
      return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
    }

    const { rooms, surface, price, city, country } = req.body;

    property.rooms = rooms;
    property.surface = surface;
    property.price = price;
    property.city = city;
    property.country = country;

    if (req.files.photo1) {
      const photo1Path = `public/uploads/${uuidv4()}-photo1.jpg`;
      await sharp(req.files.photo1[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo1Path);
      property.photos[0] = path.basename(photo1Path);
      fs.unlinkSync(req.files.photo1[0].path);
    }

    if (req.files.photo2) {
      const photo2Path = `public/uploads/${uuidv4()}-photo2.jpg`;
      await sharp(req.files.photo2[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo2Path);
      property.photos[1] = path.basename(photo2Path);
      fs.unlinkSync(req.files.photo2[0].path);
    }

    await property.save();

    const landingPageUrl = await generateLandingPage(property);

    property.url = landingPageUrl;
    await property.save();

    res.redirect('/user');
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la propriété : ', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la mise à jour de la propriété.' });
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Propriété à ${property.city}, ${property.country}</title>

        <!-- Google Tag Manager -->
        <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'}); 
        var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:''; 
        j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl; 
        f.parentNode.insertBefore(j,f); 
        })(window,document,'script','dataLayer','${GTM_ID}');</script>
        <!-- End Google Tag Manager -->

        <link href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" rel="stylesheet">
        
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
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
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
                height: 100%; /* Assure que le container occupe toute la hauteur de l'écran */
            }

            .slider {
                flex: 2;
                overflow: hidden;
                position: relative;
                width: 100%;
                height: 100%;
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

            .slides img:nth-child(1) {
                animation-delay: 0s;
            }

            .slides img:nth-child(2) {
                animation-delay: 5s;
            }

            @keyframes slide {
                0%, 50% {
                    opacity: 1;
                }
                55%, 100% {
                    opacity: 0;
                }
            }

            .property-info {
                flex: 0.8;
                padding: 40px;
                display: flex;
                flex-direction: column;
                justify-content:space-around;
                height: 100%;
            }

            .property-lorem {
                font-family: "Lora", serif;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                color: #3c3c3c;
                border-bottom: 1px solid #C4B990;
                padding-bottom: 5px;
            }

            .property-info h1 {
                font-family: "Lora", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
                line-height: 1.1;
                margin-bottom: .5rem;
                font-weight: 400;
                color: #3c3c3c;
                font-size: 2.5rem;
            }

            .property-info h2 {
                font-size: 1.6rem;
                color: #2c2c2c;
                font-weight: 300;
                margin-bottom: 30px;
            }

            .property-details {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-bottom: 20px;
            }

            .detail {
                display: flex;
                align-items: center;
            }

            .detail i {
                font-size: 1.3rem;
                color: #C4B990;
                margin-right: 8px;
            }

            .detail p {
                font-size: 1rem;
                color: #333;
            }

            .price {
                background-color: #c4b9905f;
                padding: 5px 15px;
                font-size: 1.5rem;
                font-weight: 400;
                color: #212529;
                text-align: center;
                text-transform: uppercase;
                margin-top: 30px;
                width: fit-content;
                align-self: flex-start;
            }

            .property-description {
                margin-top: 20px;
                padding: 15px;
                background-color: #f7f7f7;
                border: 1px solid #ddd;
                font-size: 1rem;
                color: #555;
                text-align: justify;
                line-height: 1.6;
            }

            .property-description .section-title {
                font-size: 1.4rem;
                font-weight: 400;
                color: #3c3c3c;
                margin-bottom: 10px;
            }

            .construction-year {
                margin-top: 20px;
                font-size: 1.2rem;
                color: #3c3c3c;
                font-weight: 300;
            }

            @media screen and (max-width: 768px) {
       
 .container {
                    flex-direction: column;
height: auto;
                }
                .slider {
        height: 250px; /* Ajuster la hauteur */
        margin-top: 20px; /* Ajoute une marge propre au-dessus du slider */
    }

    .slides img {
        height: 250px; /* Même hauteur que le slider */
    }

                .property-details {
                    grid-template-columns: repeat(2, 1fr);
                }

                .property-info {
                    padding: 20px;
                }

                .property-info h1 {
                    font-size: 1.8rem;
                }

                .property-info h2 {
                    font-size: 1.2rem;
                }

                .price {
                    font-size: 1.2rem;
                    width: 100%;
                    padding: 10px;
                    text-align: center;
align-self: center;
                }

                .property-description {
                    font-size: 0.9rem;
                }
            }
@media screen and (max-width: 500px) {
    .property-details {
        grid-template-columns: 1fr; /* Une seule colonne */
        gap: 5px; /* Moins d’espace entre les éléments */
    }
}

            @media screen and (min-width: 769px) {
                body {
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .container {
                    height: 80vh;
                    align-items: center;
                }
            }
        </style>
    </head>
    <body>

        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->

        <div class="container">
            <!-- Slider de la propriété -->
            <div class="slider">
                <div class="slides">
                    <img src="/uploads/${property.photos[0] || 'default.jpg'}" alt="Image 1">
                    <img src="/uploads/${property.photos[1] || 'default.jpg'}" alt="Image 2">
                </div>
            </div>

            <!-- Informations sur la propriété -->
            <div class="property-info">
                <p class="property-lorem">UAP Immo Annonce</p>

                <h1>Propriété à ${property.city}, ${property.country}</h1>
                <h2>Type de bien: ${property.propertyType}</h2>

                <!-- Détails de la propriété avec pictogrammes -->
                <div class="property-details">
                    <div class="detail">
                        <i class="fal fa-home"></i>
                        <p>${property.rooms}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-bed"></i>
                        <p>${property.bedrooms}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-ruler-combined"></i>
                        <p>${property.surface} m²</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-shower"></i>
                        <p>${property.bathrooms || 'Non renseigné'}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-toilet"></i>
                        <p>${property.toilets || 'Non renseigné'}</p>
                    </div>
                    <div class="detail">
                        <i class="fal fa-arrow-up"></i>
                        <p>${property.elevator ? 'Oui' : 'Non'}</p>
                    </div>
                </div>

                <!-- Année de construction -->
                <div class="construction-year">Année de construction: ${property.yearBuilt || 'Non renseignée'}</div>

                <!-- Brève description sous les pictogrammes -->
                <div class="property-description">
                    <div class="section-title">Visite guidée</div>
                    ${property.description || 'Aucune description fournie.'}
                </div>
                <div class="price">Prix: ${Number(property.price).toLocaleString('fr-FR')} €</div>
            </div>
        </div>

    </body>
    </html>`;

    
    const filePath = path.join(__dirname, 'public', 'landing-pages', `${property._id}.html`);
    fs.writeFileSync(filePath, template);

    return `/landing-pages/${property._id}.html`;
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

async function sendEmail(mailOptions) {
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email envoyé avec succès à :', mailOptions.to);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email :', error);
  }
}

async function sendAccountCreationEmail(email) {
  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Bienvenue chez UAP Immo',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #52566f;">Bienvenue chez UAP Immo!</h2>
        <p>Bonjour,</p>
        <p>Nous sommes ravis de vous compter parmi nos nouveaux utilisateurs. Votre compte a été créé avec succès !</p>
        <p>Vous avez reçu cet email parce que vous vous êtes inscrit sur notre plateforme. Vous pouvez dès maintenant vous connecter en utilisant l'adresse email et le mot de passe que vous avez choisis lors de l'inscription.</p>
        <p style="font-size: 16px;">Voici un récapitulatif :</p>
        <ul style="font-size: 16px;">
          <li><strong>Email :</strong> ${email}</li>
          <li><strong>Plateforme :</strong> <a href="https://uap.immo/login" style="color: #52566f;">Se connecter à votre espace UAP Immo</a></li>
        </ul>
        <p>Si vous avez des questions ou besoin d'aide, n'hésitez pas à nous contacter à tout moment.</p>
        <p>Cordialement,</p>
        <p>L'équipe UAP Immo</p>
        <hr>
        <p style="font-size: 12px; color: #888;">Cet email a été envoyé automatiquement, merci de ne pas y répondre. Pour toute assistance, contactez-nous à <a href="mailto:support@uap.company">support@uap.company</a>.</p>
      </div>
    `,
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

const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
        client_email: process.env.GA_CLIENT_EMAIL,
        private_key: process.env.GA_PRIVATE_KEY.replace(/\\n/g, '\n')
    }
});

async function getPageStats(pagePath) {
    const [response] = await analyticsDataClient.runReport({
        property: `properties/${process.env.GA_PROPERTY_ID}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [
            { name: 'pagePath' },
            { name: 'sessionSource' }, // Source de trafic
            { name: 'sessionMedium' }, // Medium de trafic
            { name: 'city' }, // Ville
            { name: 'country' }, // Pays
            { name: 'deviceCategory' } // Type d'appareil
        ],
        metrics: [
            { name: 'screenPageViews' }, // Vues
            { name: 'activeUsers' } // Utilisateurs uniques
        ],
        dimensionFilter: {
            filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'EXACT', value: pagePath }
            }
        }
    });

/ Convertir les résultats en un format plus lisible
    const stats = response.rows.map(row => ({
        pagePath: row.dimensionValues[0].value,
        sessionSource: row.dimensionValues[1]?.value || "N/A",
        sessionMedium: row.dimensionValues[2]?.value || "N/A",
        city: row.dimensionValues[3]?.value || "N/A",
        country: row.dimensionValues[4]?.value || "N/A",
        deviceCategory: row.dimensionValues[5]?.value || "N/A",
        views: row.metricValues[0].value,
        users: row.metricValues[1].value
    }));

    return stats;
}


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
