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
    name: `UAP Immo (${user.email})`, // "UAP Immo" est le nom de l'application, et on affiche l'email de l'utilisateur
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

// Route pour afficher la page 2FA après la vérification du mot de passe
router.get('/2fa', (req, res) => {
    if (!req.session.tempUserId) {
        return res.redirect('/login');  // Si l'utilisateur n'a pas passé l'étape du mot de passe, redirige vers la connexion
    }
    res.render('2fa');  // Affiche la vue 2FA où l'utilisateur entre le code TOTP
});

// Route pour vérifier le code 2FA après la connexion
router.post('/2fa', async (req, res) => {
    const { token } = req.body;  // Le code TOTP envoyé par l'utilisateur
    const userId = req.session.tempUserId;  // Récupérer l'utilisateur temporaire stocké dans la session

    // Trouver l'utilisateur dans la base de données
    const user = await User.findById(userId);
    if (!user) {
        return res.redirect('/login');  // Rediriger vers la connexion si l'utilisateur n'est pas trouvé
    }

    // Vérifier le code 2FA
    const isVerified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,  // Secret stocké dans la base de données
        encoding: 'base32',
        token: token  // Le code 2FA entré par l'utilisateur
    });

    if (isVerified) {
        // Connecter l'utilisateur et vider la session temporaire
        req.logIn(user, (err) => {
            if (err) return next(err);
            req.session.tempUserId = null;  // Supprimer l'utilisateur temporaire de la session
            return res.redirect('/user');  // Rediriger vers la page utilisateur après vérification réussie
        });
    } else {
        // Si le code est incorrect, renvoyer la page 2FA avec un message d'erreur
        res.render('2fa', { error: 'Code incorrect, veuillez réessayer.' });
    }
});

module.exports = router;
