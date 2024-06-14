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

const app = express();

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
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
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

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
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
      res.redirect('/');
    });
  });
});

app.get('/', (req, res) => {
  res.render('index', { i18n: res });
});
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});
app.post('/login', passport.authenticate('local', {
  successRedirect: '/user',
  failureRedirect: '/login',
  failureFlash: true
}));
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}
app.get('/user', isAuthenticated, (req, res) => {
  res.render('user', { user: req.user });
});
app.get('/faq', (req, res) => {
  res.render('faq', { title: 'faq' });
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
  try {
    const newUser = await User.register(new User({ email, firstName, lastName, role }), password);
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering user', error);
    res.send('Une erreur est survenue lors de l\'inscription.');
  }
});
app.get('/landing-pages/:id', (req, res) => {
  const pageId = req.params.id;
  res.sendFile(path.join(__dirname, 'public', 'landing-pages', `${pageId}.html`));
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

app.post('/add-property', isAuthenticated, upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 }
]), async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;

    console.log("Received body data:", req.body);  // Pour vérifier les données du formulaire
    console.log("Received files:", req.files);    // Pour vérifier les fichiers reçus

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
            fs.unlinkSync(req.files.photo1[0].path); // Supprimez le fichier original après traitement
        }

        if (req.files.photo2) {
            const photo2Path = `public/uploads/${uuidv4()}-photo2.jpg`;
            await sharp(req.files.photo2[0].path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(photo2Path);
            photo2 = path.basename(photo2Path);
            fs.unlinkSync(req.files.photo2[0].path); // Supprimez le fichier original après traitement
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
          body {
              font-family: Arial, sans-serif;
              background-color: #f8f9fa;
              color: #333;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: rgba(0, 0, 0, 0.5);
          }
          .container {
              max-width: 800px;
              padding: 20px;
              text-align: center;
              background-color: rgba(255, 255, 255, 0.9);
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .property-info h1 {
              font-size: 32px;
              margin-bottom: 20px;
          }
          .property-info p {
              font-size: 18px;
              margin-bottom: 10px;
          }
          .property-info img {
              max-width: 100%;
              height: auto;
              margin-bottom: 10px;
          }
          @media (max-width: 768px) {
              .container {
                  padding: 10px;
              }
              .property-info h1 {
                  font-size: 28px;
              }
              .property-info p {
                  font-size: 16px;
              }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="property-info">
              <h1>Propriété à ${property.city}</h1>
              <p><strong>Nombre de pièces:</strong> ${property.rooms}</p>
              <p><strong>Surface:</strong> ${property.surface} m²</p>
              <p><strong>Prix:</strong> ${property.price} €</p>
              <p><strong>Localisation:</strong> ${property.city}, ${property.country}</p>
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

app.get('/user/properties', isAuthenticated, async (req, res) => {
  try {
    const properties = await Property.find({ createdBy: req.user._id });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching user properties', error);
    res.status(500).send('Une erreur est survenue lors de la récupération des propriétés.');
  }
});
app.get('/property/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (property.createdBy.equals(req.user._id)) {
      res.render('property', { property });
    } else {
      res.status(403).send('Vous n\'êtes pas autorisé à voir cette propriété.');
    }
  } catch (error) {
    console.error('Error fetching property', error);
    res.status(500).send('Une erreur est survenue lors de la récupération de la propriété.');
  }
});
app.delete('/property/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (property.createdBy.equals(req.user._id)) {
      await property.remove();
      res.status(200).send('Propriété supprimée avec succès.');
    } else {
      res.status(403).send('Vous n\'êtes pas autorisé à supprimer cette propriété.');
    }
  } catch (error) {
    console.error('Error deleting property', error);
    res.status(500).send('Une erreur est survenue lors de la suppression de la propriété.');
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

const stripePublicKey = process.env.STRIPE_PUBLIC_KEY;

app.get('/config', (req, res) => {
  res.json({ publicKey: stripePublicKey });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
