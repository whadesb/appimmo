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

app.post('/login', passport.authenticate('local', {
  successRedirect: '/user',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/user', isAuthenticated, (req, res) => {
  res.render('user', { user: req.user });
});

app.get('/faq', (req, res) => {
  res.render('faq', { title: 'faq' });
});

app.get('/contact', (req, res) => {
    console.log("Accès à la route /contact");
    res.render('contact', { title: 'Contact' });
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

  // Validation du mot de passe
  const passwordRequirements = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passwordRequirements.test(password)) {
    req.flash('error', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole spécial.');
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Les mots de passe ne correspondent pas.');
    return res.redirect('/register');
  }

  try {
    const newUser = await User.register(new User({ email, firstName, lastName, role }), password);

    // Envoyer l'email de confirmation
    sendAccountCreationEmail(newUser.email);

    res.redirect('/login');
  } catch (error) {
    console.error('Erreur lors de l\'inscription :', error);
    req.flash('error', 'Une erreur est survenue lors de l\'inscription.');
    res.redirect('/register');
  }
});

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

// Route pour afficher une page de destination générée
app.get('/landing-pages/:id', (req, res) => {
  const pageId = req.params.id;
  res.sendFile(path.join(__dirname, 'public', 'landing-pages', `${pageId}.html`));
});

// Route pour l'ajout d'une propriété
app.post('/add-property', isAuthenticated, upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
  const { rooms, surface, price, city, country } = req.body;

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
      surface,
      price,
      city,
      country,
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

    // Vérification que la propriété appartient à l'utilisateur authentifié
    if (!property || !property.createdBy.equals(req.user._id)) {
      return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
    }

    // Rendu de la vue avec les données de la propriété
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
    // Récupération de la propriété par ID
    const property = await Property.findById(req.params.id);

    // Vérification de l'autorisation
    if (!property || !property.createdBy.equals(req.user._id)) {
      return res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
    }

    const { rooms, surface, price, city, country } = req.body;

    // Mise à jour des informations de la propriété
    property.rooms = rooms;
    property.surface = surface;
    property.price = price;
    property.city = city;
    property.country = country;

    // Mise à jour des photos si elles sont fournies
    if (req.files.photo1) {
      const photo1Path = `public/uploads/${uuidv4()}-photo1.jpg`;
      await sharp(req.files.photo1[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo1Path);
      property.photos[0] = path.basename(photo1Path);
      fs.unlinkSync(req.files.photo1[0].path); // Supprimez le fichier original après traitement
    }

    if (req.files.photo2) {
      const photo2Path = `public/uploads/${uuidv4()}-photo2.jpg`;
      await sharp(req.files.photo2[0].path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(photo2Path);
      property.photos[1] = path.basename(photo2Path);
      fs.unlinkSync(req.files.photo2[0].path); // Supprimez le fichier original après traitement
    }

    await property.save();

    // Étape 2 : Appeler la fonction pour régénérer la landing page avec les nouvelles données
    const landingPageUrl = await generateLandingPage(property);

    // Étape 3 : Mettez à jour l'URL de la landing page dans la base de données
    property.url = landingPageUrl;
    await property.save();

    // Rediriger l'utilisateur vers sa liste de propriétés
    res.redirect('/user');
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la propriété : ', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la mise à jour de la propriété.' });
  }
});

// Route pour récupérer les propriétés de l'utilisateur
app.get('/user/properties', isAuthenticated, async (req, res) => {
  try {
    const properties = await Property.find({ createdBy: req.user._id });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching user properties', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des propriétés.' });
  }
});

// Route pour le processus de paiement
app.post('/process-payment', isAuthenticated, async (req, res) => {
  const { stripeToken, amount, propertyId } = req.body;
  const userId = req.user._id;

  if (isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const charge = await stripe.charges.create({
      amount: parseInt(amount, 10), // Convertir le montant en entier
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

// Génération de la page de destination
async function generateLandingPage(property) {
  const template = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Propriété à ${property.city}</title>
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.6);
          font-family: Arial, sans-serif;
        }
        .property-container {
          background-color: white;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          max-width: 800px;
          width: 100%;
          padding: 20px;
          text-align: center;
          color: black;
        }
        .property-title {
          font-size: 32px;
          margin-bottom: 20px;
          color: black;
        }
        .property-details {
          font-size: 18px;
          margin-bottom: 20px;
          color: black;
        }
        .property-photos {
          display: flex;
          justify-content: space-around;
          gap: 10px;
        }
        .property-photos img {
          width: 48%;
          border-radius: 8px;
        }
        @media (max-width: 768px) {
          .property-container {
            padding: 10px;
          }
          .property-title {
            font-size: 24px;
          }
          .property-details {
            font-size: 16px;
          }
          .property-photos {
            flex-direction: column;
            align-items: center;
          }
          .property-photos img {
            width: 100%;
            margin-bottom: 10px;
          }
        }
      </style>
    </head>
    <body>
      <div class="property-container">
        <h1 class="property-title">Propriété à ${property.city}</h1>
        <div class="property-details">
          <p><strong>Nombre de pièces:</strong> ${property.rooms}</p>
          <p><strong>Surface:</strong> ${property.surface} m²</p>
          <p><strong>Prix:</strong> ${property.price} €</p>
          <p><strong>Localisation:</strong> ${property.city}, ${property.country}</p>
        </div>
        <div class="property-photos">
          <img src="/uploads/${property.photos[0]}" alt="Photo 1">
          <img src="/uploads/${property.photos[1]}" alt="Photo 2">
        </div>
      </div>
    </body>
    </html>`;

  const filePath = path.join(__dirname, 'public', 'landing-pages', `${property._id}.html`);
  fs.writeFileSync(filePath, template);

  return `/landing-pages/${property._id}.html`;
}
const nodemailer = require('nodemailer');

// Configuration de nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 587,
  secure: false, // true pour le port 465, false pour les autres ports
  auth: {
    user: process.env.EMAIL_USER, // Utilisation de la variable d'environnement pour l'adresse email
    pass: process.env.EMAIL_PASS  // Utilisation de la variable d'environnement pour le mot de passe
  }
});

app.post('/send-contact', async (req, res) => {
    const { firstName, lastName, email, message, type } = req.body;

    const mailOptions = {
        from: '"UAP Immo" <info@uap.immo>',
        to: process.env.CONTACT_EMAIL,  // Remplacez par l'email de destination
        subject: 'Nouveau message de contact',
        html: `
            <p><b>Nom :</b> ${firstName} ${lastName}</p>
            <p><b>Email :</b> ${email}</p>
            <p><b>Type :</b> ${type}</p>
            <p><b>Message :</b><br>${message}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.redirect('/?messageEnvoye=true');  // Rediriger vers une page de confirmation
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email :', error);
        res.status(500).send('Erreur lors de l\'envoi de l\'email.');
    }
});


const port = process.env.PORT || 8080; // Exemple avec le port 3000
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
