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
const fs = require('fs');
const cookieParser = require('cookie-parser');
const i18n = require('./i18n');

const app = express();

// Utiliser cookie-parser avant d'utiliser d'autres middlewares
app.use(cookieParser());

// Middleware pour analyser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(flash());

// Middleware pour définir la langue en fonction des cookies ou des paramètres de requête
app.use((req, res, next) => {
  if (req.query.lang) {
    res.cookie('locale', req.query.lang, { maxAge: 900000, httpOnly: true });
    res.setLocale(req.query.lang);
  } else if (req.cookies.locale) {
    res.setLocale(req.cookies.locale);
  }
  next();
});

// Configurer les sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

// Initialiser Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Utiliser le modèle User pour l'authentification locale avec Passport
passport.use(new LocalStrategy({
  usernameField: 'email'
}, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware pour initialiser i18n
app.use(i18n.init);

// Définir le moteur de template ejs
app.set('view engine', 'ejs');

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.render('index', { i18n: res });
});

// Route pour afficher le formulaire de connexion
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

// Route pour gérer la soumission du formulaire de connexion
app.post('/login', passport.authenticate('local', {
  successRedirect: '/user',
  failureRedirect: '/login',
  failureFlash: true
}));

// Middleware pour vérifier si l'utilisateur est authentifié
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Route pour la page de profil de l'utilisateur
app.get('/user', isAuthenticated, (req, res) => {
  res.render('user', { user: req.user });
});

// Route pour la page faq
app.get('/faq', (req, res) => {
  res.render('faq', { title: 'faq' });
});

// Route pour la page de paiement
app.get('/payment', (req, res) => {
  res.render('payment', { title: 'Payment' });
});

// Route pour afficher le formulaire d'inscription
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

// Route pour traiter la soumission du formulaire d'inscription
app.post('/register', async (req, res) => {
  const { email, firstName, lastName, role, password, confirmPassword } = req.body;

  // Vérification des mots de passe et création d'un nouvel utilisateur
  try {
    const newUser = await User.register(new User({ email, firstName, lastName, role }), password);
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering user', error);
    res.send('Une erreur est survenue lors de l\'inscription.');
  }
});

// Route pour servir les pages de destination
app.get('/landing-pages/:id', (req, res) => {
  const pageId = req.params.id;
  // Renvoyer le fichier HTML correspondant depuis le répertoire public/landing-pages
  res.sendFile(path.join(__dirname, 'public', 'landing-pages', pageId));
});

app.post('/add-property', isAuthenticated, async (req, res) => {
  const { rooms, surface, price, city, country } = req.body;

  try {
    const property = new Property({
      rooms,
      surface,
      price,
      city,
      country,
      user: req.user._id // Associer l'utilisateur à la propriété
    });

    await property.save(); // Enregistrez la propriété sans l'URL

    // Générez l'URL de la page de destination
    const landingPageUrl = await generateLandingPage(property);

    // Mettez à jour la propriété avec l'URL de la page de destination
    property.url = landingPageUrl;
    
    // Sauvegardez la propriété avec l'URL de la page de destination
    await property.save();

    res.status(200).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
  } catch (error) {
    console.error('Error adding property', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout du bien immobilier.' });
  }
});

async function generateLandingPage(property) {
  const template = `
  <!DOCTYPE html>
  <html>
  <head>
      <link rel="stylesheet" href="/css/bootstrap.min.css">
      <style>
               body {
                font-family: Arial, sans-serif;
                background-color: #f8f9fa;
                color: #333;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center; /* Centrer horizontalement */
                align-items: center; /* Centrer verticalement */
                height: 100vh; /* 100% de la hauteur de l'écran */
            }
            .container {
                max-width: 800px;
                padding: 20px;
                text-align: center; /* Centrer le contenu */
                background-color: #fff; /* Couleur de fond du contenu */
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
      </style>
  </head>
  <body>
      <div class="container">
          <h1>Propriété à ${property.city}</h1>
          <p>Nombre de pièces: ${property.rooms}</p>
          <p>Surface: ${property.surface} m²</p>
          <p>Prix: ${property.price} €</p>
          <p>Localisation: ${property.city}, ${property.country}</p>
      </div>
  </body>
  </html>`;

  const filePath = path.join(__dirname, 'public', 'landing-pages', `${property._id}.html`);
  fs.writeFileSync(filePath, template);

  return `/landing-pages/${property._id}.html`;
}

// Route pour afficher les propriétés d'un utilisateur spécifique
app.get('/user/properties', isAuthenticated, async (req, res) => {
  try {
    // Trouver les propriétés créées par l'utilisateur connecté
    const properties = await Property.find({ user: req.user._id });
    res.render('user-properties', { properties, user: req.user });
  } catch (error) {
    console.error('Error fetching user properties', error);
    res.status(500).send('Une erreur est survenue lors de la récupération des propriétés.');
  }
});

// Route pour afficher une propriété spécifique
app.get('/property/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    // Vérifiez que l'utilisateur connecté est bien le propriétaire de la propriété
    if (property.user.equals(req.user._id)) {
      res.render('property', { property });
    } else {
      res.status(403).send('Vous n\'êtes pas autorisé à voir cette propriété.');
    }
  } catch (error) {
    console.error('Error fetching property', error);
    res.status(500).send('Une erreur est survenue lors de la récupération de la propriété.');
  }
});

// Route pour supprimer une propriété
app.delete('/property/:id', isAuthenticated, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    // Vérifiez que l'utilisateur connecté est bien le propriétaire de la propriété
    if (property.user.equals(req.user._id)) {
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



// Démarrer le serveur
const port = process.env.PORT || 8080; // Utilisez le port 8080 ou un autre port disponible
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
