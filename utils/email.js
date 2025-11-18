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
 * Génère un PDF de facture professionnelle.
 * @param {object} data - Toutes les données nécessaires pour la facture
 */
async function generateInvoicePDF(data) {
  const {
    orderIdUap,
    paypalOrderId,
    paypalCaptureId,
    amount,
    currency = 'EUR',
    client,
    companyInfo,
    serviceDetails,
  } = data;

  // Calculs et formatages
  const amountTTC = Number(amount) || 500;
  const tvaRate = 0; // Taux de TVA (Franchise en base de TVA en France)
  const amountHT = amountTTC;
  const amountTVA = 0;
  // Utilise orderIdUap directement pour le suffixe
  const invoiceNumber = `F-${new Date().getFullYear()}-${orderIdUap.replace('ORD-', '').slice(-6)}`;
  
  const now = new Date();
  const paymentDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const paymentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const validityExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const invoicesDir = path.join(__dirname, '../invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const fileBase =
    String(orderIdUap || paypalCaptureId || paypalOrderId || 'FACTURE')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

  const invoicePath = path.join(invoicesDir, `invoice-${fileBase}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(invoicePath);
  doc.pipe(stream);

  // --- TEMPLATE PROFESSIONNEL PDF ---
  
  // 1. En-tête / Infos Société
  doc.fillColor('#52566f')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text(companyInfo.name, 40, 50)
    .moveDown(0.2);

  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica')
    .text(companyInfo.address[0], 40, 85)
    .text(companyInfo.address[1])
    .moveDown(0.5)
    .text(`Siret : ${companyInfo.siret}`)
    .text(`TVA Intracom. : ${companyInfo.tva || 'N/A'}`);

  // 2. Facture N° / Date
  doc.fontSize(14)
    .fillColor('#C4B990')
    .text('FACTURE / REÇU', 400, 50, { align: 'right' });
    
  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`N° : ${invoiceNumber}`, 400, 85, { align: 'right' })
    .moveDown(0.2)
    .text(`Date : ${paymentDate}`, { align: 'right' });


  // 3. Section Client et Paiement
  doc.moveDown(2);
  doc.rect(40, doc.y, 515, 1).fillColor('#C4B990').fill();
  doc.moveDown(0.5);

  doc.fillColor('#52566f')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Client & Réf.', 40, doc.y)
    .text('Détails du Paiement', 300, doc.y);
    
  doc.moveDown(0.5);

  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica');

  // Colonne Client
  doc.text(`Nom : ${client.firstName} ${client.lastName}`, 40, doc.y)
    .text(`ID Client : ${client.userId}`, 40, doc.y + 12);

  // Colonne Paiement
  doc.text(`Payé le : ${paymentDate} à ${paymentTime} CET`, 300, doc.y - 12)
    .text(`Mode : PayPal`, 300, doc.y);

  // Affiche la commande sans le préfixe "ORD-"
  doc.text(`Réf. commande UAP : ${orderIdUap || '-'}`, 300, doc.y + 12)
    .text(`Réf. PayPal/Txn ID : ${paypalCaptureId || paypalOrderId || '-'}`, 300, doc.y + 24)
    .moveDown(4);

  // 4. Tableau de service
  doc.fillColor('#52566f')
    .rect(40, doc.y, 515, 20).fill()
    .fillColor('white')
    .font('Helvetica-Bold')
    .text('Produit/Service', 50, doc.y + 5)
    .text('Prix HT', 380, doc.y + 5)
    .text('TVA (0%)', 450, doc.y + 5)
    .text('Total TTC', 500, doc.y + 5, { align: 'right', width: 50 });
  
  doc.moveDown(0.1);
  doc.fillColor('#333').font('Helvetica');

  doc.text(`${serviceDetails.product} (${serviceDetails.duration})`, 50, doc.y + 10)
    .text(`${amountHT.toFixed(2)} €`, 380, doc.y + 10)
    .text(`${amountTVA.toFixed(2)} €`, 450, doc.y + 10)
    .font('Helvetica-Bold')
    .text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 10, { align: 'right', width: 50 });

  doc.moveDown(0.5);
  doc.rect(40, doc.y, 515, 0.5).fillColor('#eee').fill();
  doc.moveDown(1);
  
  // 5. Totaux
  doc.fillColor('#333')
    .font('Helvetica')
    .text('Total HT :', 380, doc.y, { align: 'right' })
    .text(`${amountHT.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });

  doc.moveDown(0.5);
  doc.text('TVA (0.00 %) :', 380, doc.y, { align: 'right' })
    .text(`${amountTVA.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });
  
  doc.moveDown(0.8);
  doc.fillColor('#C4B990')
    .rect(375, doc.y, 180, 25).fill()
    .fillColor('#000')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('TOTAL PAYÉ (EUR) :', 380, doc.y + 7)
    .text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 7, { align: 'right', width: 50 });


  // 6. Bas de page légal
  doc.moveDown(2.5);
  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica')
    .text(`Validité du service : ${serviceDetails.duration}, jusqu'au ${validityExpiration}.`, 40, doc.y);
    
  doc.moveDown(0.5);
  doc.font('Helvetica-Oblique').text('TVA non applicable, art. 293 B du CGI.', 40, doc.y);


  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#777')
    .text('Merci pour votre achat. Ce document fait office de reçu de paiement.', 40, 750, { align: 'center' });
    
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { invoicePath, fileBase };
}

/**
 * Envoie la facture par email (avec PDF).
 * @param {string} to               - destinataire (ex: req.user.email)
 * @param {string} fullName         - nom complet du client (pour le mail)
 * @param {string} orderIdUap       - ID de commande interne UAP (ex: ORD-...)
 * @param {string} paypalOrderId    - PayPal Order ID (ex: 3UY...)
 * @param {string} paypalCaptureId  - PayPal Capture/Transaction ID (ex: 4SN...)
 * @param {string|number} amount    - Montant (ex: "500.00")
 * @param {string} currency         - Devise (ex: "EUR")
 * @param {object} clientDetails    - Détails client (userId, firstName, lastName)
 * @param {object} companyInfo      - Détails entreprise (name, siret, tva, address)
 * @param {object} serviceDetails   - Détails service (product, duration)
 */
async function sendInvoiceByEmail(
  to,
  fullName,
  orderIdUap,
  paypalOrderId,
  paypalCaptureId,
  amount,
  currency = 'EUR',
  clientDetails, 
  companyInfo,
  serviceDetails
) {
  // Génère le PDF
  const { invoicePath, fileBase } = await generateInvoicePDF({
    orderIdUap,
    paypalOrderId,
    paypalCaptureId,
    amount,
    currency,
    client: clientDetails,
    companyInfo: companyInfo,
    serviceDetails: serviceDetails,
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
          <li><b>Durée :</b> ${serviceDetails.duration}</li>
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
