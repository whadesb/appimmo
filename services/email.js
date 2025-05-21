const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(mailOptions) {
  try {
    await transporter.sendMail(mailOptions);
    console.log('📨 Email envoyé avec succès à :', mailOptions.to);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email :', error);
  }
}

async function sendAccountCreationEmail(email) {
  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Bienvenue chez UAP Immo',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #52566f;">Bienvenue chez UAP Immo!</h2>
        <p>Bonjour,</p>
        <p>Nous sommes ravis de vous compter parmi nos nouveaux utilisateurs.</p>
        <ul>
          <li><strong>Email :</strong> ${email}</li>
          <li><strong>Lien :</strong> <a href="https://uap.immo/login">Se connecter</a></li>
        </ul>
        <p>Merci pour votre inscription.</p>
      </div>
    `
  };

  await sendEmail(mailOptions);
}

module.exports = {
  sendEmail,
  sendAccountCreationEmail
};
