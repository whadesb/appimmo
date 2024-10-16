const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');  // Modèle utilisateur
const isAuthenticated = require('../middleware/auth');  // Import du middleware d'authentification

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

// Route pour vérifier le code TOTP après activation
router.post('/:locale/2fa', async (req, res) => {
    if (!req.session.tempUserId) {
        return res.redirect(`/${req.params.locale}/login`);
    }

    const { token } = req.body;
    const userId = req.session.tempUserId;
    const { locale } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        return res.redirect(`/${locale}/login`);
    }

    // Vérifier le code 2FA
    const isVerified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,  // Le secret stocké dans la base de données
    encoding: 'base32',
    token: token  // Le code TOTP envoyé par l'utilisateur
});

if (isVerified) {
    req.logIn(user, (err) => {
        if (err) return next(err);
        req.session.tempUserId = null;
        return res.redirect(`/${locale}/user`);
    });
} else {
    // Si le code est incorrect, afficher un message d'erreur
    res.render('2fa', { error: 'Code incorrect, veuillez réessayer.', locale: locale });
}
});

// Route pour afficher la page 2FA après la vérification du mot de passe
router.get('/:locale/2fa', (req, res) => {
    const { locale } = req.params;
    if (!req.session.tempUserId) {
        return res.redirect(`/${locale}/login`);
    }
    res.render('2fa', { locale: locale });
});

// Route pour vérifier le code 2FA après la connexion
router.post('/:locale/2fa', async (req, res, next) => {
    const { token } = req.body;
    const userId = req.session.tempUserId;
    const { locale } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect(`/${locale}/login`);
        }

        const isVerified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (isVerified) {
            req.logIn(user, (err) => {
                if (err) return next(err);
                req.session.tempUserId = null;
                return res.redirect(`/${locale}/user`);
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
