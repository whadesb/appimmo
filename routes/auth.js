// Import des dépendances
const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');  // Assurez-vous d'importer correctement le modèle User
const isAuthenticated = require('../middleware/auth'); // Middleware d'authentification

// Route pour activer 2FA et générer le QR code
router.get('/enable-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;

        // Génère un secret unique pour l'utilisateur
        const secret = speakeasy.generateSecret({
            name: `YourAppName (${user.email})`, // Nom de l'application + email utilisateur
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

// Route pour vérifier le code TOTP après activation
router.post('/verify-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        const { token } = req.body;  // Récupère le code TOTP entré par l'utilisateur

        // Vérifie si le code est valide
        const isVerified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (isVerified) {
            // Active le 2FA pour l'utilisateur après vérification
            user.twoFactorEnabled = true;
            await user.save();
            res.redirect('/user');  // Redirige vers le profil utilisateur après activation
        } else {
            res.status(400).send('Code incorrect, veuillez réessayer.');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du 2FA', error);
        res.status(500).send('Erreur lors de la vérification du 2FA');
    }
});

module.exports = router;
