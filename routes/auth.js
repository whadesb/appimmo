// 🔐 Mise à jour de tempUserId vers tmpUserId + ajout désactivation/modification 2FA
const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const isAuthenticated = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const passport = require('passport');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Recaptcha = require('express-recaptcha').RecaptchaV2; // si utilisé
const { sendEmail, sendAccountCreationEmail } = require('../services/email');

function ensureNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect(`/${req.params.locale || 'fr'}/user`);
  }
  next();
}

// Route pour activer 2FA et générer le QR code
router.get('/enable-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        const secret = speakeasy.generateSecret({ name: `UAP Immo (${user.email})` });
        user.twoFactorSecret = secret.base32;
        user.twoFactorEnabled = true;
        await user.save();

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) return res.status(500).send('Erreur QR code');
            res.render('enable-2fa', { qrCode: data_url });
        });
    } catch (error) {
        res.status(500).send('Erreur activation 2FA');
    }
});

// ✅ Affichage page saisie code après login
router.get('/:locale/2fa', (req, res) => {
    const { locale } = req.params;
    const translationsPath = path.join(__dirname, '../locales', locale, '2fa.json');

    let translations;
    try {
        translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    } catch (error) {
        return res.status(500).send('Erreur traduction.');
    }

    res.render('2fa', { i18n: translations, locale });
});

// ✅ Vérification du code après login
router.post('/:locale/2fa', async (req, res, next) => {
    const { token } = req.body;
    const userId = req.session.tmpUserId;
    const { locale } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) return res.redirect(`/${locale}/login`);

        const isVerified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (isVerified) {
            req.login(user, (err) => {
                if (err) return next(err);
                req.session.tmpUserId = null;
                return res.redirect(`/${locale}/user`);
            });
        } else {
            res.render('2fa', { error: 'Code incorrect, veuillez réessayer.', locale });
        }
    } catch (error) {
        res.status(500).send('Erreur vérification 2FA.');
    }
});

// ✅ Désactiver la 2FA
router.post('/disable-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        res.status(200).json({ message: "2FA désactivée" });
    } catch (err) {
        console.error("Erreur désactivation 2FA :", err);
        res.status(500).json({ error: "Erreur serveur lors de la désactivation de la 2FA." });
    }
});
router.get('/:locale/login', ensureNotAuthenticated, async (req, res) => {
    const { locale } = req.params;
    let i18n = {};

    try {
        i18n = JSON.parse(fs.readFileSync(`./locales/${locale}/login.json`, 'utf8'));
    } catch (error) {
        console.error("Erreur chargement traduction login :", error);
        return res.status(500).send("Erreur chargement traduction.");
    }

    res.render('login', {
        locale,
        i18n,
        messages: req.flash()
    });
});


// ✅ Réinitialiser la 2FA (nouveau QR code)
router.get('/reset-2fa', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        const secret = speakeasy.generateSecret({ name: `UAP Immo (${user.email})` });
        user.twoFactorSecret = secret.base32;
        await user.save();

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) return res.status(500).send('Erreur QR code');
            res.render('enable-2fa', { qrCode: data_url });
        });
    } catch (error) {
        res.status(500).send('Erreur réinitialisation 2FA');
    }
});

router.post('/:locale/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    const { locale } = req.params;

    if (err) return next(err);
    if (!user) return res.redirect(`/${locale}/login`);

    if (user.twoFactorEnabled) {
      req.session.tmpUserId = user._id;
      return res.redirect(`/${locale}/2fa`);
    }

    req.login(user, (err) => {
      if (err) return next(err);
      return res.redirect(`/${locale}/user`);
    });
  })(req, res, next);
});

router.get('/:locale/register', (req, res) => {
  const { locale } = req.params;
 const translations = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../locales', locale, 'register.json'), 'utf8'
));
  res.render('register', { i18n: translations, errors: [], locale });
});
router.post('/:locale/register', async (req, res) => {
  const { name, email, password } = req.body;
  const { locale } = req.params;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.render('register', {
     i18n: JSON.parse(fs.readFileSync(
  path.join(__dirname, '../locales', locale, 'register.json'), 'utf8'
)),
      errors: ['Adresse email déjà utilisée'],
      locale
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashedPassword });
  await user.save();

  await sendEmail(email, 'Bienvenue sur UAP Immo', '<p>Bienvenue !</p>');
  res.redirect(`/${locale}/login`);
});
router.get('/:locale/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});
router.get('/:locale/user', isAuthenticated, (req, res) => {
  const { locale } = req.params;
 const translations = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../locales', locale, 'user.json'), 'utf8'
));
  res.render('user', { user: req.user, i18n: translations, locale });
});

module.exports = router;
