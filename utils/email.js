const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Transporteur IONOS (STARTTLS sur 587 recommandé)
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Envoie la facture avec PDF.
 * @param {string} to        - destinataire (ex: req.user.email)
 * @param {string} reference - référence paiement (captureId ou orderID)
 * @param {string} amount    - montant (ex: "500.00")
 * @param {string} currency  - devise (ex: "EUR")
 * @returns {Promise<nodemailer.SentMessageInfo>}
 */
async function sendInvoiceByEmail(to, reference, amount, currency = 'EUR') {
  // Dossier invoices
  const invoicesDir = path.join(__dirname, '../invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  // Génération PDF
  const fileSafeRef = String(reference || 'REF').replace(/[^a-zA-Z0-9_-]/g, '_');
  const invoicePath = path.join(invoicesDir, `invoice-${fileSafeRef}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(invoicePath);
  doc.pipe(stream);

  doc
    .fontSize(18)
    .text('Reçu de paiement - UAP Immo', { align: 'center' })
    .moveDown()
    .fontSize(12)
    .text(`Référence de paiement : ${reference || '-'}`)
    .text(`Montant : ${amount || '-'} ${currency || '-'}`)
    .text(`Date : ${new Date().toLocaleDateString('fr-FR')}`)
    .moveDown()
    .text('Merci pour votre achat.');

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from,
    to,
    subject: `Facture UAP Immo – ${reference}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#2c3e50;">Votre paiement a bien été reçu</h2>
        <p><b>Référence :</b> ${reference}<br/>
           <b>Montant :</b> ${amount} ${currency}<br/>
           <b>Durée :</b> 90 jours</p>
        <p>📎 Votre facture est en pièce jointe.</p>
        <p style="margin-top:16px;">
          👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a><br/>
          🌐 Site : <a href="https://uap.immo">https://uap.immo</a>
        </p>
        <hr/>
        <p style="font-size:12px;color:#888;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
      </div>
    `,
    attachments: [
      { filename: `facture-${fileSafeRef}.pdf`, path: invoicePath }
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Facture envoyée', { to, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  return info;
}

/**
 * Mail "commande en attente" (BTCPay)
 */
async function sendMailPending(to, fullName, orderId, amount) {
  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject: `Commande ${orderId} – En attente de confirmation`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#2c3e50;">Bonjour ${fullName},</h2>
        <p>Votre commande <b>${orderId}</b> (montant : <b>${amount} €</b>) est en attente de paiement/validation.</p>
        <p>Vous recevrez automatiquement votre facture dès confirmation.</p>
        <p style="margin-top:16px;">
          👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a>
        </p>
      </div>
    `,
  });

  console.log('📩 Mail pending envoyé', { to, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  return info;
}

module.exports = { sendInvoiceByEmail, sendMailPending };
