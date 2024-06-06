const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Configurer le transporteur pour l'envoi d'e-mails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'communication@zebrito.fr',
    pass: '528721Tt**'
  }
});

// Route pour afficher le formulaire d'inscription
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

// Route pour traiter la soumission du formulaire d'inscription
router.post('/register', async (req, res) => {
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

    // Envoi d'un e-mail de confirmation
    await transporter.sendMail({
      from: 'votre_adresse_email@gmail.com',
      to: email,
      subject: 'Confirmation de votre inscription',
      html: `<p>Bonjour ${firstName},</p><p>Votre inscription sur notre site a été confirmée avec succès.</p><p>Cordialement,</p><p>Votre équipe UAP Immo</p>`
    });

    // Rediriger vers la page de connexion après l'inscription
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering user', error);
    res.send('Une erreur est survenue lors de l\'inscription.');
  }
});

module.exports = router;
