require('dotenv').config();
// Gérer les erreurs non capturées
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
const nodemailer = require('nodemailer');

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


app.get('/:locale', (req, res) => {
  const locale = req.params.locale || 'fr';

  // Liste des fichiers qui ne doivent pas être interprétés comme des traductions
  const excludedFiles = ['favicon.ico', 'wp-admin.php', 'update-core.php', 'bs1.php'];

  if (excludedFiles.includes(locale)) {
    return res.sendStatus(404); // Ne pas tenter de charger des traductions pour ces fichiers
  }

  const translationsPath = `./locales/${locale}/index.json`;
  let translations = {};

  try {
    translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lors du chargement des traductions : ${error}`);
    return res.status(500).send('Erreur lors du chargement des traductions.');
  }

  res.render('index', {
    locale: locale,
    i18n: translations
  });
});




// Route dynamique pour la page de connexion avec gestion de la langue
app.get('/:lang/login', (req, res) => {
    const locale = req.params.lang; // Récupérer la langue depuis l'URL
    const loginTranslationsPath = `./locales/${locale}/login.json`; // Chemin vers les traductions de cette page

    let loginTranslations = {};

    try {
        loginTranslations = JSON.parse(fs.readFileSync(loginTranslationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    // Rendre la page avec les traductions de la langue choisie
    res.render('login', {
        title: loginTranslations.title,
        locale: locale,  // Passer la langue active pour les balises HTML
        i18n: loginTranslations // Passer les traductions spécifiques à la page
    });
});

// Redirection vers la langue par défaut (ex: français) si aucune langue n'est spécifiée
app.get('/login', (req, res) => {
    res.redirect('/fr/login');  // Rediriger vers la version française par défaut
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
    const { locale } = req.params;  // Récupérer la langue depuis l'URL
    const user = req.user;  // Utilisateur authentifié

    // Rediriger si l'utilisateur n'est pas connecté
    if (!user) {
        return res.redirect(`/${locale}/login`);
    }

    // Charger les traductions spécifiques à la page utilisateur
    const userTranslationsPath = `./locales/${locale}/user.json`;
    let userTranslations = {};
    try {
        userTranslations = JSON.parse(fs.readFileSync(userTranslationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    // Récupérer les propriétés de l'utilisateur connecté
    try {
        const properties = await Property.find({ createdBy: user._id });

        // Afficher la page utilisateur avec les propriétés et traductions
        res.render('user', {
            locale: locale,  // Passer la langue active
            user: user,  // Utilisateur connecté
            i18n: userTranslations,  // Traductions spécifiques
            properties: properties  // Propriétés de l'utilisateur
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des propriétés :', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des propriétés.' });
    }
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

app.get('/:locale/payment', isAuthenticated, async (req, res) => {
    const { locale } = req.params;
    const { propertyId } = req.query;

    console.log(` Récupération de la propriété avec ID: ${propertyId}`);

    try {
        const property = await Property.findById(propertyId);
        if (!property) {
            console.error(' Propriété non trouvée pour ID:', propertyId);
            return res.status(404).send('Property not found');
        }

        console.log('Propriété trouvée:', property);

        // Charger les traductions spécifiques à la langue
        const translations = require(`./locales/${locale}/payment.json`);

        res.render('payment', {
            locale: locale,
            i18n: translations,
            user: req.user || null,  // Ajoute cette ligne pour passer `user` à la vue
            propertyId: property._id,
            rooms: property.rooms,
            surface: property.surface,
            price: property.price,
            city: property.city,
            country: property.country,
            url: property.url
        });
    } catch (error) {
        console.error(' Erreur lors de la récupération de la propriété:', error);
        res.status(500).send('Erreur lors de la récupération de la propriété.');
    }
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
    const properties = await Property.find({ createdBy: req.user._id });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching user properties', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des propriétés.' });
  }
});

app.post('/process-payment', isAuthenticated, async (req, res) => {
  const { stripeToken, amount, propertyId } = req.body;
  const userId = req.user._id;

  if (isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const charge = await stripe.charges.create({
      amount: parseInt(amount, 10),
      currency: 'eur',
      source: stripeToken,
      description: `Payment for property ${propertyId}`,
    });

    const order = new Order({
      userId,
      amount: parseInt(amount, 10),
      status: 'paid'
    });
    await order.save();
    res.status(200).json({ message: 'Payment successful' });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
});

app.get('/config', (req, res) => {
  res.json({ publicKey: process.env.STRIPE_PUBLIC_KEY });
});

async function generateLandingPage(property) {
    const GTM_ID = 'GTM-TF7HSC3N'; 

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
