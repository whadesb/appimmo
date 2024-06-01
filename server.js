const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const stripe = require('stripe')('clé_secrète_stripe');

const app = express();

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.render('index'); // Rendre la vue "index.ejs"
});

// Route pour la page de connexion
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

// Route pour traiter la soumission du formulaire de connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Trouver l'utilisateur par email
    const user = await User.findOne({ email });

    if (!user) {
      return res.send('Email ou mot de passe incorrect.');
    }

    // Vérifier le mot de passe
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.send('Email ou mot de passe incorrect.');
    }

    // Créer une session utilisateur
    req.session.userId = user._id;
    req.session.userName = user.firstName + ' ' + user.lastName;

    // Rediriger vers la page utilisateur après la connexion
    res.redirect('/user');
  } catch (error) {
    console.error('Error logging in', error);
    res.send('Une erreur est survenue lors de la connexion.');
  }
});

// Route pour la page utilisateur
app.get('/user', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Récupération de l'utilisateur à partir de la base de données en utilisant l'ID de session
    const user = await User.findById(req.session.userId);

    // Vérifier si l'utilisateur existe
    if (!user) {
      return res.send('Utilisateur introuvable.');
    }

    // Passez les informations utilisateur à la vue EJS
    res.render('user', {
      title: 'User Profile',
      userName: user.firstName + ' ' + user.lastName,
      userEmail: user.email,
      userRole: user.role
    });
  } catch (error) {
    console.error('Error fetching user data', error);
    res.send('Une erreur est survenue lors de la récupération des données utilisateur.');
  }
});

// Route pour déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Une erreur est survenue lors de la déconnexion.');
    }

    res.redirect('/');
  });
});

// Route pour la page de paiement
app.get('/payment', (req, res) => {
  res.render('payment', { stripePublicKey: 'pk_test_oKhSR5nslBRnBZpjO6KuzZeX' }); // clé publique Stripe
});

// Route pour traiter les paiements
app.post('/process_payment', async (req, res) => {
  const token = req.body.stripeToken;
  const name = req.body.name;
  const email = req.body.email;

  try {
    const charge = await stripe.charges.create({
      amount: 5000, // Montant en cents () 50.00€)
      currency: 'eur',
      description: 'Exemple de paiement',
      source: token,
      receipt_email: email,
    });
    res.redirect('/confirmation');
  } catch (error) {
    res.status(500).send(error);
  }
});

// Page de confirmation
app.get('/confirmation', (req, res) => {
  res.render('confirmation');
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

// Définir le moteur de template EJS
app.set('view engine', 'ejs');

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://tbz:dGLGH9qgQolOrF8C@uap-immo.ss4shqp.mongodb.net/?retryWrites=true&w=majority&appName=uap-immo&tls=true')
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB Atlas', error);
  });

// Middleware pour analyser les données POST
app.use(express.urlencoded({ extended: true }));

// Configurer les sessions
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb+srv://tbz:dGLGH9qgQolOrF8C@uap-immo.ss4shqp.mongodb.net/?retryWrites=true&w=majority&appName=uap-immo' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

    try {
  // Créer une session utilisateur
  req.session.userId = user._id;
  req.session.userName = user.firstName + ' ' + user.lastName;

  // Rediriger vers la page utilisateur après la connexion
  res.redirect('/user');
} catch (error) {
  console.error('Error logging in', error);
  res.send('Une erreur est survenue lors de la connexion.');
}

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

// Démarrer le serveur
const port = process.env.PORT || 8080; // Utilisez le port 8080 ou un autre port disponible
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
