const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function sendInvoiceByEmail(to, transactionId, amount, currency) {
  const doc = new PDFDocument();
  const invoicePath = path.join(__dirname, `../invoices/invoice-${transactionId}.pdf`);

  // Créer un dossier "invoices" s’il n'existe pas
  if (!fs.existsSync(path.join(__dirname, '../invoices'))) {
    fs.mkdirSync(path.join(__dirname, '../invoices'));
  }

  // Écriture dans le fichier
  doc.pipe(fs.createWriteStream(invoicePath));

  // Contenu du PDF
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

  // Attendre que le fichier soit bien généré
  await new Promise((resolve) => doc.on('finish', resolve));

  // Envoi par e-mail
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Ou 'smtp.ionos.fr', etc.
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

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

module.exports = { sendInvoiceByEmail };
