require('dotenv').config();
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
  cookie: { maxAge: 1000 * 60 * 5 } // Cookie de 5 minutes
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
        res.redirect('/login');
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
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.render('index', { i18n: res, user: req.user || null });
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { title: 'Réinitialisation du mot de passe' });
});

// Route pour la politique de confidentialité
app.get('/politique-confidentialite', (req, res) => {
  res.render('politique-confidentialite', { title: 'Politique de confidentialité' });
});

// Route pour gérer les cookies
app.get('/gerer-cookies', (req, res) => {
  res.render('gerer-cookies', { title: 'Gérer les cookies' });
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Aucun compte trouvé avec cette adresse email.');
      return res.redirect('/forgot-password');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
    await user.save();

    const resetUrl = `http://${req.headers.host}/reset-password/${token}`;
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
    return res.redirect('/forgot-password?emailSent=true');
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    req.flash('error', 'Une erreur est survenue lors de la réinitialisation du mot de passe.');
    return res.redirect('/forgot-password');
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

app.post('/login', passport.authenticate('local', {
  successRedirect: '/user',
  failureRedirect: '/login',
  failureFlash: true
}));

app.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

// server.js

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


app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

app.get('/user', isAuthenticated, async (req, res) => {
  try {
    // Récupérer les propriétés créées par l'utilisateur connecté
    const properties = await Property.find({ createdBy: req.user._id });
    
    // Assurez-vous de passer la variable 'properties' à la vue
    res.render('user', { user: req.user, properties });
  } catch (error) {
    console.error('Erreur lors de la récupération des propriétés :', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des propriétés.' });
  }
});


app.get('/faq', (req, res) => {
  res.render('faq', { title: 'faq' });
});

app.get('/contact', (req, res) => {
    const messageEnvoye = req.query.messageEnvoye === 'true';
    res.render('contact', { title: 'Contact', messageEnvoye });
});

app.get('/payment', isAuthenticated, async (req, res) => {
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
    console.error('Error fetching property', error);
    res.status(500).send('Error fetching property');
  }
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
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
  const { rooms, bathrooms, surface, price, city, country, hasGarage } = req.body;

  try {
    let photo1 = null;
    let photo2 = null;

    if (req.files.photo1) {
      const photo1Path = `public/uploads/${uuidv4()}-photo1.jpg`;
      await sharp(req.files.photo1[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo1Path);
      photo1 = path.basename(photo1Path);
      fs.unlinkSync(req.files.photo1[0].path);
    }

    if (req.files.photo2) {
      const photo2Path = `public/uploads/${uuidv4()}-photo2.jpg`;
      await sharp(req.files.photo2[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo2Path);
      photo2 = path.basename(photo2Path);
      fs.unlinkSync(req.files.photo2[0].path);
    }

    const property = new Property({
    rooms,
    bathrooms, // Ajouter la récupération du nombre de salles de bain
    surface,
    price,
    city,
    country,
    hasGarage: hasGarage === 'on', // Ajouter la gestion du champ garage
    createdBy: req.user._id,
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
    // Recherche de la propriété par son ID
    const property = await Property.findById(req.params.id);

    // Vérification de l'autorisation de modification
    if (!property || !property.createdBy.equals(req.user._id)) {
      return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
    }

    // Mise à jour des champs envoyés dans le corps de la requête
    const { rooms, surface, price, city, country } = req.body;
    property.rooms = rooms;
    property.surface = surface;
    property.price = price;
    property.city = city;
    property.country = country;

    // Gérer la mise à jour des photos (photo1 et photo2)
    if (req.files.photo1) {
      const photo1Path = `public/uploads/${uuidv4()}-photo1.jpg`;
      await sharp(req.files.photo1[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo1Path);
      property.photos[0] = path.basename(photo1Path);
      fs.unlinkSync(req.files.photo1[0].path); // Supprimer le fichier temporaire
    }

    if (req.files.photo2) {
      const photo2Path = `public/uploads/${uuidv4()}-photo2.jpg`;
      await sharp(req.files.photo2[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo2Path);
      property.photos[1] = path.basename(photo2Path);
      fs.unlinkSync(req.files.photo2[0].path); // Supprimer le fichier temporaire
    }

    // Générer la nouvelle URL de landing page
    const landingPageUrl = await generateLandingPage(property);
    property.url = landingPageUrl;

    // Sauvegarder les modifications dans la base de données
    await property.save();

    // Redirection vers la page d'édition pour vérifier les modifications
    res.redirect(`/property/edit/${property._id}`);
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
  const template = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>${property.title || "UAP Immo | Annonce"}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Arial', sans-serif;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #f4f4f4;
                overflow: hidden; /* Pour éviter le scrolling */
            }

            .landing-container {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                height: 100vh;
                padding: 20px;
                background-color: white;
            }

            .property-info {
                flex: 1;
                padding: 20px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 50px;
            }

            .property-title {
                font-size: 3em;
                font-weight: bold;
                color: #333;
            }

            .property-description {
                font-size: 1.2em;
                color: #666;
            }

            .property-details {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                margin-top: 20px;
            }

            .detail {
                flex: 0 0 30%;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 10px;
            }

            .detail i.icon {
                font-size: 30px;
                color: #C4B990;
                border-radius: 50%;
                border: 1px solid #000000;
                padding: 20px;
                margin-bottom: 10px;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 60px;
                height: 60px;
            }

            .detail p {
                font-size: 1em;
                color: #333;
                text-align: center;
            }

            .cta-button {
                display: inline-block;
                padding: 15px 30px;
                background-color: #C4B990;
                color: rgb(0, 0, 0);
                font-size: 1.2em;
                text-decoration: none;
                border-radius: 50px;
                transition: background-color 0.3s ease;
                align-self: flex-start;
            }

            .cta-button:hover {
                background-color: #000000;
                border-radius: 50px;
                border: 1px solid grey;
                color: white;
            }

            .property-images {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }

            .property-images img.main-image {
                width: 100%;
                max-width: 500px;
                height: auto;
                margin-bottom: 20px;
                border-radius: 15px;
                box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.2);
            }

            @media screen and (max-width: 768px) {
                body {
                    height: 100vh;
                }
                .landing-container {
                    flex-direction: column;
                    text-align: center;
                    height: 100vh;
                }

                .property-info {
                    justify-content: space-around;
                    height: 100%;
                }

                .property-images {
                    flex-grow: 1;
                    justify-content: space-between;
                    flex-direction: row;
                    align-items: center;
                    height: auto;
                }

                .property-images img.main-image {
                    width: 48%;
                    height: auto;
                    max-width: 100%;
                    margin: 0;
                }

                .cta-button {
                    display: none;
                }

                .fixed-cta {
                    position: fixed;
                    top: 50vh;
                    left: calc(100% - 5em);
                    background-color: #d7c26b;
                    padding: 1.5em;
                    border-radius: 4em;
                    border-radius: 90px 0px 0px 90px;
                    border: 1px solid grey;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 14px;
                    text-transform: uppercase;
                    color: #142a44;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .fixed-cta i {
                    font-size: 2em;
                    color: #142a44;
                }

                .fixed-cta i:before {
                    content: '\\f0e0';
                }

                .fixed-cta span {
                    display: none;
                }
            }

            @media screen and (min-width: 769px) {
                .fixed-cta {
                    display: none;
                }

                .property-details {
                    flex-wrap: nowrap;
                    justify-content: space-between;
                }

                .detail {
                    flex: 0 0 18%;
                }
            }
        </style>
    </head>
    <body>
        <div class="landing-container">
            <div class="property-info">
                <h1 class="property-title">${property.title || "Propriété à vendre"}</h1>
                <p class="property-description">${property.description || "Description non disponible."}</p>

                <div class="property-details">
                    <div class="detail">
                        <i class="fas fa-bed icon"></i>
                        <p>${property.rooms || "N/A"} Chambres</p>
                    </div>
                    <div class="detail">
                        <i class="fas fa-bath icon"></i>
                        <p>${property.bathrooms || "N/A"} Salles de bain</p>
                    </div>
                    <div class="detail">
                        <i class="fas fa-ruler-combined icon"></i>
                        <p>${property.surface || "N/A"}m²</p>
                    </div>
                    <div class="detail">
                        <i class="fas fa-map-marker-alt icon"></i>
                        <p>${property.city || "Ville non spécifiée"}</p>
                    </div>
                    <div class="detail">
                        <i class="fas fa-car icon"></i>
                        <p>${property.hasGarage ? 'Garage' : 'Pas de garage'}</p>
                    </div>  
                </div>

                <a href="#contact" class="cta-button">Visitez ce bien</a>
            </div>
            
            <div class="property-images">
                <img src="/uploads/${property.photos && property.photos[0] ? property.photos[0] : 'default.jpg'}" alt="${property.title}" class="main-image">
                <img src="/uploads/${property.photos && property.photos[1] ? property.photos[1] : 'default.jpg'}" alt="${property.title}" class="main-image">
            </div>
        </div>

        <a href="#contact" class="fixed-cta">
            <i class="fas fa-envelope"></i> 
            <span>Contactez-nous</span>
        </a>
    </body>
    </html>
  `;

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
