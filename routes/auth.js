const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');  // Assure-toi que le modèle User est bien importé
const isAuthenticated = require('../middleware/auth'); // Middleware d'authentification

// Route pour activer 2FA
router.get('/enable-2fa', isAuthenticated, async (req, res) => {
    const user = req.user;

    // Génère un secret unique pour l'utilisateur
    const secret = speakeasy.generateSecret({
        name: `YourAppName (${user.email})`, // Nom de ton application + email utilisateur
    });

    // Sauvegarde le secret dans la base de données
    user.twoFactorSecret = secret.base32;
    await user.save();

    // Génère un QR code que l'utilisateur scanne avec Google Authenticator
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            console.error('Erreur lors de la génération du QR code', err);
            return res.status(500).send('Erreur lors de la génération du QR code');
        }

        // Rendre une page avec le QR code à scanner
        res.render('enable-2fa', { qrCode: data_url });
    });
});

module.exports = router;
