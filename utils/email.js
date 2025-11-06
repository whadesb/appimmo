const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Transporteur IONOS (STARTTLS sur 587)
 */
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
 * Génère un PDF de facture simple et le retourne (chemin).
 */
async function generateInvoicePDF({
  orderIdUap,
  paypalOrderId,
  paypalCaptureId,
  amount,
  currency = 'EUR',
}) {
  const invoicesDir = path.join(__dirname, '../invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  // Nom de fichier basé sur l'ID UAP si dispo, sinon capture/order
  const fileBase =
    String(orderIdUap || paypalCaptureId || paypalOrderId || 'FACTURE')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

  const invoicePath = path.join(invoicesDir, `invoice-${fileBase}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(invoicePath);
  doc.pipe(stream);

  // En-tête
  doc
    .fontSize(18)
    .text('Reçu de paiement - UAP Immo', { align: 'center' })
    .moveDown(1);

  // Corps
  doc
    .fontSize(12)
    .text(`Réf. commande UAP : ${orderIdUap || '-'}`)
    .text(`PayPal – Order ID : ${paypalOrderId || '-'}`)
    .text(`PayPal – Transaction (Capture ID) : ${paypalCaptureId || '-'}`)
    .text(`Montant : ${amount || '-'} ${currency || 'EUR'}`)
    .text(`Date : ${new Date().toLocaleDateString('fr-FR')}`)
    .moveDown()
    .text('Merci pour votre achat.');

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { invoicePath, fileBase };
}

/**
 * Envoie la facture par email (avec PDF).
 * @param {string} to               - destinataire (ex: req.user.email)
 * @param {string} fullName         - nom complet du client (pour le mail)
 * @param {string} orderIdUap       - ID de commande interne UAP (ex: ORD-...)
 * @param {string} paypalOrderId    - PayPal Order ID (ex: 3UY...)
 * @param {string} paypalCaptureId  - PayPal Capture/Transaction ID (ex: 4SN...)
 * @param {string|number} amount    - Montant (ex: "500.00")
 * @param {string} currency         - Devise (ex: "EUR")
 */
async function sendInvoiceByEmail(
  to,
  fullName,
  orderIdUap,
  paypalOrderId,
  paypalCaptureId,
  amount,
  currency = 'EUR'
) {
  // Génère le PDF
  const { invoicePath, fileBase } = await generateInvoicePDF({
    orderIdUap,
    paypalOrderId,
    paypalCaptureId,
    amount,
    currency,
  });

  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from,
    to,
    subject: `Commande ${orderIdUap || paypalCaptureId || paypalOrderId} – Paiement confirmé`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#2c3e50;">Bonjour ${fullName || ''},</h2>
        <p>Nous confirmons la réception de votre paiement. Voici vos références :</p>
        <ul>
          <li><b>Réf. commande UAP :</b> ${orderIdUap || '-'}</li>
          <li><b>PayPal – Order ID :</b> ${paypalOrderId || '-'}</li>
          <li><b>PayPal – Transaction (Capture ID) :</b> ${paypalCaptureId || '-'}</li>
          <li><b>Montant :</b> ${amount} ${currency}</li>
          <li><b>Durée :</b> 90 jours</li>
        </ul>

        <p>📎 Votre facture est en pièce jointe.</p>

        <p style="margin-top: 16px;">
          👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a><br/>
          🌐 Site : <a href="https://uap.immo">https://uap.immo</a>
        </p>

        <hr/>
        <p style="font-size:12px;color:#888;">
          Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
        </p>
      </div>
    `,
    attachments: [
      { filename: `facture-${fileBase}.pdf`, path: invoicePath }
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Facture envoyée', {
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  });
  return info;
}

/**
 * Mail "commande en attente" (ex: BTCPay encore non confirmée).
 */
async function sendMailPending(to, fullName, orderId, amount) {
  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject: `Commande ${orderId} – En attente de confirmation`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#2c3e50;">Bonjour ${fullName || ''},</h2>
        <p>Votre commande <b>${orderId}</b> (montant : <b>${amount} €</b>) est en attente de paiement/validation.</p>
        <p>Vous recevrez automatiquement votre facture dès confirmation.</p>
        <p style="margin-top:16px;">
          👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a>
        </p>
      </div>
    `,
  });

  console.log('📩 Mail pending envoyé', {
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  });
  return info;
}

module.exports = {
  sendInvoiceByEmail,
  sendMailPending,
  generateInvoicePDF,
};
