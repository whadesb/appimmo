const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail',
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
    from: `"UAP Immo" <${process.env.MAIL_USER}>`,
    to,
    subject: "Votre reçu de paiement UAP Immo",
    text: `Merci pour votre paiement. Veuillez trouver votre reçu en pièce jointe.`,
    attachments: [
      {
        filename: `facture-${transactionId}.pdf`,
        path: invoicePath,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Facture envoyée à ${to}`);
}

async function sendMailPending(to, propertyId, amount) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // ou ton service SMTP
    auth: {
      user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS,

    },
  });

  const mailOptions = {
    from: `"UAP Immo" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Confirmation de votre commande (en attente)',
    text: `Bonjour,

Nous avons bien reçu votre demande de commande pour le bien ${propertyId}.
Montant : ${amount} EUR.

Une fois le paiement confirmé par PayPal, vous recevrez votre facture.

Merci pour votre confiance.

L’équipe UAP Immo`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📩 Mail de confirmation en attente envoyé à ${to}`);
}


module.exports = {
  sendInvoiceByEmail,
  sendMailPending
};

