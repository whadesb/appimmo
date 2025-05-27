const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr', 
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


async function sendInvoiceByEmail(to, transactionId, amount, currency) {
  const doc = new PDFDocument();
  const invoicePath = path.join(__dirname, `../invoices/invoice-${transactionId}.pdf`);

  if (!fs.existsSync(path.join(__dirname, '../invoices'))) {
    fs.mkdirSync(path.join(__dirname, '../invoices'));
  }

  doc.pipe(fs.createWriteStream(invoicePath));
  doc
    .fontSize(20)
    .text('Reçu de paiement - UAP Immo', { align: 'center' })
    .moveDown()
    .fontSize(12)
    .text(`ID de transaction : ${transactionId}`)
    .text(`Montant payé : ${amount} ${currency}`)
    .text(`Date : ${new Date().toLocaleDateString('fr-FR')}`)
    .moveDown()
    .text('Merci pour votre achat.', { align: 'left' });
  doc.end();

  await new Promise((resolve) => doc.on('finish', resolve));

  const mailOptions = {
  from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
  to,
  subject: 'Confirmation de votre commande - En attente de validation',
  html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2c3e50;">Bonjour,</h2>
    <p>Nous vous remercions pour votre commande d’un pack de diffusion sur UAP Immo.</p>
    <p><strong>Montant :</strong> 500 € TTC<br>
    <strong>Durée :</strong> 3 mois</p>

    <p>Votre commande est actuellement en cours de validation. Une fois le paiement confirmé, vous recevrez automatiquement votre facture par e-mail.</p>

    <hr>

    <p>💡 <strong>Rappel :</strong> Vous pouvez à tout moment accéder à votre tableau de bord pour suivre l’état de vos annonces et commandes.</p>

    <p style="margin-top: 20px;">
      👉 Accéder à votre espace : <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Site officiel : <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Merci pour votre confiance,<br />
    <strong>L’équipe UAP Immo</strong></p>

    <hr style="margin-top: 40px;" />

    <h2 style="color: #2c3e50;">Hello,</h2>
    <p>Thank you for your order of a promotion pack on UAP Immo.</p>
    <p><strong>Amount:</strong> €500 (tax included)<br>
    <strong>Duration:</strong> 3 months</p>

    <p>Your order is currently pending validation. Once the payment is confirmed, your invoice will be sent to you automatically by email.</p>

    <hr>

    <p>💡 <strong>Reminder:</strong> You can always access your dashboard to manage your listings and orders.</p>

    <p style="margin-top: 20px;">
      👉 Go to your dashboard: <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Website: <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Thank you for choosing UAP Immo,<br />
    <strong>The UAP Immo Team</strong></p>
  </div>
  `
};

  await transporter.sendMail(mailOptions);
  console.log(`📧 Facture envoyée à ${to}`);
}

async function sendMailPending(to, propertyId, amount) {
  const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


  const mailOptions = {
  from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
  to,
  subject: 'Confirmation de votre commande - En attente de validation',
  html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2c3e50;">Bonjour,</h2>
    <p>Nous vous remercions pour votre commande d’un pack de diffusion sur UAP Immo.</p>
    <p><strong>Montant :</strong> 500 € TTC<br>
    <strong>Durée :</strong> 3 mois</p>

    <p>Votre commande est actuellement en cours de validation. Une fois le paiement confirmé, vous recevrez automatiquement votre facture par e-mail.</p>

    <hr>

    <p>💡 <strong>Rappel :</strong> Vous pouvez à tout moment accéder à votre tableau de bord pour suivre l’état de vos annonces et commandes.</p>

    <p style="margin-top: 20px;">
      👉 Accéder à votre espace : <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Site officiel : <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Merci pour votre confiance,<br />
    <strong>L’équipe UAP Immo</strong></p>

    <hr style="margin-top: 40px;" />

    <h2 style="color: #2c3e50;">Hello,</h2>
    <p>Thank you for your order of a promotion pack on UAP Immo.</p>
    <p><strong>Amount:</strong> €500 (tax included)<br>
    <strong>Duration:</strong> 3 months</p>

    <p>Your order is currently pending validation. Once the payment is confirmed, your invoice will be sent to you automatically by email.</p>

    <hr>

    <p>💡 <strong>Reminder:</strong> You can always access your dashboard to manage your listings and orders.</p>

    <p style="margin-top: 20px;">
      👉 Go to your dashboard: <a href="https://uap.immo/fr/login" target="_blank">https://uap.immo/fr/login</a><br>
      🌐 Website: <a href="https://uap.immo" target="_blank">https://uap.immo</a>
    </p>

    <p style="margin-top: 30px;">Thank you for choosing UAP Immo,<br />
    <strong>The UAP Immo Team</strong></p>
  </div>
  `
};

  await transporter.sendMail(mailOptions);
  console.log(`📩 Mail de confirmation en attente envoyé à ${to}`);
}


module.exports = {
  sendInvoiceByEmail,
  sendMailPending
};
