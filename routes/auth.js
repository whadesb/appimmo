const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');  // Modèle utilisateur
const isAuthenticated = require('../middleware/auth');  // Import du middleware d'authentification
const fs = require('fs'); // Importation du module fs
const path = require('path'); // Importation du module path


// Route pour activer 2FA et générer le QR code
router.get('/enable-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;

        // Génère un secret unique pour l'utilisateur
        const secret = speakeasy.generateSecret({
            name: `UAP Immo (${user.email})`, // Nom de l'application + email utilisateur
        });

        // Sauvegarde le secret dans la base de données utilisateur
        user.twoFactorSecret = secret.base32;
        await user.save();

        // Génère un QR code pour que l'utilisateur le scanne avec Google Authenticator
        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                console.error('Erreur lors de la génération du QR code', err);
                return res.status(500).send('Erreur lors de la génération du QR code');
            }

            // Rendre une page avec le QR code à scanner
            res.render('enable-2fa', { qrCode: data_url });
        });
    } catch (error) {
        console.error('Erreur lors de l\'activation du 2FA', error);
        res.status(500).send('Erreur lors de l\'activation du 2FA');
    }
});



// Route pour afficher la page 2FA après la vérification du mot de passe
// Route pour afficher la page 2FA après la vérification du mot de passe
router.get('/:locale/2fa', (req, res) => {
    const { locale } = req.params;
    
    // Charger les traductions depuis le fichier correspondant
    const translationsPath = path.join(__dirname, '../locales', locale, '2fa.json');

    let translations;
    try {
        translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
        console.error(`Erreur lors du chargement des traductions : ${error}`);
        return res.status(500).send('Erreur lors du chargement des traductions.');
    }

    // Rendre la vue 2FA avec les traductions chargées
    res.render('2fa', {
        i18n: translations, // Passer les traductions à la vue
        locale: locale      // Passer la langue active
    });
});

// Route pour vérifier le code TOTP après activation
router.post('/:locale/2fa', async (req, res, next) => {
  const { token } = req.body;  // Le code TOTP envoyé par l'utilisateur
  const userId = req.session.tempUserId;  // Récupérer l'utilisateur temporaire stocké dans la session
  const { locale } = req.params;  // Récupérer la locale depuis l'URL

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`/${locale}/login`);  // Rediriger si l'utilisateur n'est pas trouvé
    }

    const isVerified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token  // Le code 2FA entré par l'utilisateur
    });

    if (isVerified) {
      // Utiliser req.login au lieu de req.logIn (en minuscule) pour Passport.js
      req.login(user, (err) => {
        if (err) return next(err);
        req.session.tempUserId = null;
        return res.redirect(`/${locale}/user`);  // Rediriger vers la page utilisateur
      });
    } else {
      res.render('2fa', { error: 'Code incorrect, veuillez réessayer.', locale: locale });
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du code 2FA:', error);
    res.status(500).send('Erreur lors de la vérification du code 2FA.');
  }
});


module.exports = router;
