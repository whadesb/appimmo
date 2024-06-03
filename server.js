const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const stripe = require('stripe')('clé_secrète_stripe');

const app = express();

// Middleware pour analyser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurer les sessions
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb+srv://tbz:dGLGH9qgQolOrF8C@uap-immo.ss4shqp.mongodb.net/uap-immo?retryWrites=true&w=majority' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

// Définir le moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Connexion à MongoDB
mongoose.connect('mongodb+srv://tbz:dGLGH9qgQolOrF8C@uap-immo.ss4shqp.mongodb.net/uap-immo?retryWrites=true&w=majority', {
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
  // Vous pouvez récupérer les informations sur l'utilisateur à partir de req.user ou de toute autre source
  const user = {
    firstName: 'John',
    lastName: 'Doe'
  };

  // Rendre la vue "user.ejs" en passant les informations sur l'utilisateur
  res.render('user', { title: 'User Profile', user: user });
});


// Démarrer le serveur
const port = process.env.PORT || 8080; // Utilisez le port 8080 ou un autre port disponible
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
