const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cookieParser = require('cookie-parser');
const i18n = require('./i18n');

const app = express();

// Middleware pour analyser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Utiliser cookie-parser avant d'utiliser d'autres middlewares
app.use(cookieParser());

// Middleware pour initialiser i18n
app.use(i18n.init);

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

// Définir le moteur de template ejs
app.set('view engine', 'ejs');

// Exemple de route
app.get('/', (req, res) => {
  res.render('index', { i18n: res });
});

const addPropertyRoutes = require('./routes/add-property'); // Importez les routes pour add-property.js
app.use(addPropertyRoutes);

require('dotenv').config();
const Property = require('./models/Property');

// Configurer les sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

// Définir le moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
  res.render('index'); // Rendre la vue "index.ejs"
});

// Route pour la page de connexion
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
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

  // Vérification des mots de passe
  if (password !== confirmPassword) {
    return res.send('Les mots de passe ne correspondent pas.');
  }

  try {
    // si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send('Un utilisateur avec cet email existe déjà.');
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer un nouvel utilisateur
    const user = new User({
      email,
      firstName,
      lastName,
      role,
      password: hashedPassword
    });

    // Sauvegarder l'utilisateur dans la base de données
    await user.save();

    // Rediriger vers la page de connexion après l'inscription
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering user', error);
    res.send('Une erreur est survenue lors de l\'inscription.');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Vérifier les informations d'identification de l'utilisateur
    const user = await User.findOne({ email });

    if (!user) {
      return res.send('Utilisateur non trouvé.');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.send('Mot de passe incorrect.');
    }

    // Authentification réussie, enregistrer l'utilisateur dans la session
    req.session.user = user;

    // Rediriger vers la page de profil de l'utilisateur
    res.redirect('/user');
  } catch (error) {
    console.error('Error logging in user', error);
    res.send('Une erreur est survenue lors de la connexion.');
  }
});

app.get('/user', (req, res) => {
    // Vérifiez si l'utilisateur est connecté
    if (req.session.user) {
        // Récupérez les informations de l'utilisateur à partir de la session
        const user = req.session.user;
        // Passez les informations de l'utilisateur à la vue lors du rendu de la page
        res.render('user', { user: user });
    } else {
        // Redirigez l'utilisateur vers la page de connexion s'il n'est pas connecté
        res.redirect('/login');
    }
});

// Route pour servir les pages de destination
app.get('/landing-pages/:id', (req, res) => {
  const pageId = req.params.id;
  // Renvoyer le fichier HTML correspondant depuis le répertoire public/landing-pages
   res.sendFile(path.join(__dirname, 'public', 'landing-pages', pageId));
});

app.post('/add-property', async (req, res) => {
  const { rooms, surface, price, city, country } = req.body;

  try {
    // Créer et sauvegarder le bien immobilier
    const property = new Property({ rooms, surface, price, city, country });
    await property.save();

    // Générer la page de destination
    const landingPageUrl = await generateLandingPage(property);

    // Ajouter l'URL de la page de destination à la propriété et sauvegarder
    property.url = landingPageUrl;
    await property.save();

    // Envoyer une réponse JSON avec l'URL de la page générée
    res.status(200).json({ message: 'Le bien immobilier a été ajouté avec succès.', url: landingPageUrl });
  } catch (error) {
    console.error('Error adding property', error);
    // En cas d'erreur, renvoyer une réponse JSON avec le statut 500
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
          /* Ajoutez des styles CSS personnalisés ici */
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

// Démarrer le serveur
const port = process.env.PORT || 8080; // Utilisez le port 8080 ou un autre port disponible
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
