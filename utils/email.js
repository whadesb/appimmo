const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
    paymentMethod = 'PayPal',
  } = data;

  // --- FORMATAGE DE LA RÉFÉRENCE UAP ---
  const displayOrderId = String(orderIdUap).startsWith('ORD-') 
      ? orderIdUap 
      : `ORD-${orderIdUap}`;

  const amountTTC = Number(amount) || 500;
  const tvaRate = 0;
  const amountHT = amountTTC;
  const amountTVA = 0;
  
  const invoiceNumber = `F-${new Date().getFullYear()}-${displayOrderId.replace('ORD-', '').slice(-6)}`;
  
  const now = new Date();
  const paymentDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const paymentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const validityExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const invoicesDir = path.join(__dirname, '../invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const fileBase = String(displayOrderId || 'FACTURE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const invoicePath = path.join(invoicesDir, `invoice-${fileBase}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(invoicePath);
  doc.pipe(stream);

  // --- EN-TÊTE ---
  doc.fillColor('#52566f').fontSize(24).font('Helvetica-Bold').text(companyInfo.name, 40, 50).moveDown(0.2);
  doc.fillColor('#333').fontSize(10).font('Helvetica')
    .text(companyInfo.address[0], 40, 85)
    .text(companyInfo.address[1])
    .moveDown(0.5)
    .text(`Siret : ${companyInfo.siret}`)
    .text(`TVA Intracom. : ${companyInfo.tva || 'N/A'}`);

  doc.fontSize(14).fillColor('#C4B990').text('FACTURE / REÇU', 400, 50, { align: 'right' });
  doc.fillColor('#333').fontSize(10).font('Helvetica-Bold')
    .text(`N° : ${invoiceNumber}`, 400, 85, { align: 'right' }).moveDown(0.2)
    .text(`Date : ${paymentDate}`, { align: 'right' });

  // --- SECTION CLIENT & PAIEMENT ---
  doc.moveDown(2);
  // Ligne de séparation
  const startY = doc.y;
  doc.rect(40, startY, 515, 1).fillColor('#C4B990').fill();
  doc.moveDown(0.5);

  doc.fillColor('#52566f').fontSize(12).font('Helvetica-Bold');
  doc.text('Client & Facturation', 40, doc.y);
  doc.text('Détails du Paiement', 300, doc.y - 12); // -12 car on vient d'écrire la ligne précédente
    
  doc.moveDown(0.5);
  doc.fillColor('#333').fontSize(10).font('Helvetica');

  // --- COLONNE GAUCHE : CLIENT ---
  let currentY = doc.y;
  
  // Nom
  doc.text(`Nom : ${client.firstName} ${client.lastName}`, 40, currentY);
  currentY += 14;

  // Adresse (Si disponible)
  if (client.address) {
      if (client.address.street) {
          doc.text(client.address.street, 40, currentY);
          currentY += 12;
      }
      if (client.address.zipCode || client.address.city) {
          doc.text(`${client.address.zipCode || ''} ${client.address.city || ''}`, 40, currentY);
          currentY += 12;
      }
      if (client.address.country) {
          doc.text(client.address.country, 40, currentY);
          currentY += 12;
      }
  }
  
  // ID Client (avec un petit espace avant)
  currentY += 4;
  doc.text(`ID Client : ${client.userId}`, 40, currentY);


  // --- COLONNE DROITE : PAIEMENT ---
  // On reprend la hauteur initiale pour aligner les colonnes
  // Attention : doc.y a bougé, on utilise une variable fixe pour la colonne de droite
  let rightColumnY = startY + 25; // Ajustement par rapport à la ligne de séparation

  const displayPaymentMethod = paymentMethod === 'Bitcoin' ? 'Bitcoin (BTCPay)' : 'PayPal';
  
  doc.text(`Payé le : ${paymentDate} à ${paymentTime}`, 300, rightColumnY);
  rightColumnY += 12;
  doc.text(`Mode : ${displayPaymentMethod}`, 300, rightColumnY);
  rightColumnY += 12;
  doc.text(`Réf. interne : ${displayOrderId}`, 300, rightColumnY);
  rightColumnY += 12;
  
  if (paymentMethod === 'Bitcoin') {
     doc.text(`Ref. Paiement : ${paypalOrderId.replace('BTCPAY-', '')}`, 300, rightColumnY);
  } else {
     const finalRef = (paypalCaptureId && paypalCaptureId !== '-') ? paypalCaptureId : paypalOrderId;
     doc.text(`Ref. Paiement : ${finalRef}`, 300, rightColumnY);
  }
  
  // On déplace le curseur global en dessous de la colonne la plus longue pour la suite
  doc.y = Math.max(currentY, rightColumnY) + 30;

  // --- TABLEAU SERVICE ---
  doc.fillColor('#52566f').rect(40, doc.y, 515, 20).fill()
    .fillColor('white').font('Helvetica-Bold')
    .text('Produit/Service', 50, doc.y + 5)
    .text('Prix HT', 380, doc.y + 5)
    .text('TVA (0%)', 450, doc.y + 5)
    .text('Total TTC', 500, doc.y + 5, { align: 'right', width: 50 });
  
  doc.moveDown(0.1);
  doc.fillColor('#333').font('Helvetica');
  doc.text(`${serviceDetails.product} (${serviceDetails.duration})`, 50, doc.y + 10)
    .text(`${amountHT.toFixed(2)} €`, 380, doc.y + 10)
    .text(`${amountTVA.toFixed(2)} €`, 450, doc.y + 10)
    .font('Helvetica-Bold').text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 10, { align: 'right', width: 50 });

  doc.moveDown(0.5).rect(40, doc.y, 515, 0.5).fillColor('#eee').fill().moveDown(1);
  
  // --- TOTAUX ---
  doc.fillColor('#333').font('Helvetica')
    .text('Total HT :', 380, doc.y, { align: 'right' }).text(`${amountHT.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });
  doc.moveDown(0.5).text('TVA (0.00 %) :', 380, doc.y, { align: 'right' }).text(`${amountTVA.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });
  
  doc.moveDown(0.8).fillColor('#C4B990').rect(375, doc.y, 180, 25).fill()
    .fillColor('#000').font('Helvetica-Bold').fontSize(12)
    .text('TOTAL PAYÉ (EUR) :', 380, doc.y + 7).text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 7, { align: 'right', width: 50 });

  // --- FOOTER ---
  doc.moveDown(2.5).fillColor('#333').fontSize(10).font('Helvetica')
    .text(`Validité : ${serviceDetails.duration}, jusqu'au ${validityExpiration}.`, 40, doc.y);
  doc.moveDown(0.5).font('Helvetica-Oblique').text('TVA non applicable, art. 293 B du CGI.', 40, doc.y);
  doc.font('Helvetica').fontSize(8).fillColor('#777')
    .text('Merci pour votre achat. Ce document fait office de reçu de paiement.', 40, 750, { align: 'center' });
    
  doc.end();

  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
  return { invoicePath, fileBase };
}

/**
 * Envoie la facture par email (avec PDF).
 */
async function sendInvoiceByEmail(
  to, fullName, orderIdUap, paypalOrderId, paypalCaptureId, amount, currency = 'EUR',
  clientDetails, companyInfo, serviceDetails, paymentMethod = 'PayPal' 
) {
  const displayOrderId = String(orderIdUap).startsWith('ORD-') 
      ? orderIdUap 
      : `ORD-${orderIdUap}`;

  const { invoicePath, fileBase } = await generateInvoicePDF({
    orderIdUap, paypalOrderId, paypalCaptureId, amount, currency,
    client: clientDetails, companyInfo, serviceDetails, paymentMethod 
  });

  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  let paymentRowsHtml = '';
  
  if (paymentMethod === 'Bitcoin') {
      paymentRowsHtml = `
        <li><b>Réf. interne :</b> ${displayOrderId}</li>
        <li><b>Ref. Paiement (BTCPay) :</b> ${paypalOrderId.replace('BTCPAY-', '')}</li>
        <li><b>Moyen de paiement :</b> Bitcoin (Crypto)</li>
      `;
  } else {
      const finalRef = (paypalCaptureId && paypalCaptureId !== '-') ? paypalCaptureId : paypalOrderId;
      paymentRowsHtml = `
        <li><b>Réf. interne :</b> ${displayOrderId}</li>
        <li><b>Ref. Paiement (PayPal) :</b> ${finalRef}</li>
        <li><b>Moyen de paiement :</b> PayPal / CB</li>
      `;
  }

  const mailOptions = {
    from, to,
    subject: `Facture Disponible - Commande ${displayOrderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#2c3e50;">Bonjour ${fullName || ''},</h2>
        <p>Nous confirmons la réception de votre paiement de <b>${amount} ${currency}</b>.</p>
        <p>Voici le résumé de votre transaction :</p>
        <ul>
          ${paymentRowsHtml}
          <li><b>Durée :</b> ${serviceDetails.duration}</li>
        </ul>
        <p>📎 <b>Votre facture officielle est jointe à cet email au format PDF.</b></p>
        <p style="margin-top: 16px;">
          👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a><br/>
        </p>
        <hr/>
        <p style="font-size:12px;color:#888;">Cet email a été envoyé automatiquement.</p>
      </div>
    `,
    attachments: [{ filename: `facture-${fileBase}.pdf`, path: invoicePath }],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Facture envoyée', { to, messageId: info.messageId });
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
