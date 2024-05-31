const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const stripe = require('stripe')('clé_secrète_stripe');

const app = express();

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://tbz:dGLGH9qgQolOrF8C@uap-immo.ss4shqp.mongodb.net/?retryWrites=true&w=majority&appName=uap-immo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((error) => {
  console.error('Error connecting to MongoDB Atlas', error);
});

// Définir le moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

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

// Routes...
// Ajoutez vos routes ici

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
