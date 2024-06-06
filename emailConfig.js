const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.ionos.fr', // Serveur SMTP d'IONOS
    port: 587, // Port SMTP
    secure: false, // false car nous n'utilisons pas le port SSL
    auth: {
        user: 'communication@zebrito.fr', // Votre adresse e-mail
        pass: '528721Tt**' // Votre mot de passe
    }
});

module.exports = transporter;
