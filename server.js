const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware pour analyser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const propertyRoutes = require('./routes/property');
const addPropertyRoutes = require('./routes/add-property'); // Importez les routes pour add-property.js
app.use(propertyRoutes);
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

// Route pour gérer la soumission du formulaire de connexion
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

    // Authentification réussie, rediriger vers la page de profil de l'utilisateur
    res.redirect('/user'); // Remplacez "/user" par la route de votre choix
  } catch (error) {
    console.error('Error logging in user', error);
    res.send('Une erreur est survenue lors de la connexion.');
  }
});

app.get('/user', (req, res) => {
  res.render('user');
});

// Route pour servir les pages de destination
app.get('/landing-pages/:id', (req, res) => {
  const pageId = req.params.id;
  // Renvoyer le fichier HTML correspondant depuis le répertoire public/landing-pages
   res.sendFile(path.join(__dirname, 'public', 'landing-pages', pageId));
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
