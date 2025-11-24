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
    paymentMethod = 'PayPal',
  } = data;

  // --- FORMATAGE DE LA RÉFÉRENCE UAP (Ajout de ORD- si manquant) ---
  const displayOrderId = String(orderIdUap).startsWith('ORD-') 
      ? orderIdUap 
      : `ORD-${orderIdUap}`;

  const amountTTC = Number(amount) || 500;
  const tvaRate = 0;
  const amountHT = amountTTC;
  const amountTVA = 0;
  
  // Numéro de facture basé sur la partie numérique de la commande
  // Ex: F-2025-123456 (on garde les 6 derniers chiffres)
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
  doc.rect(40, doc.y, 515, 1).fillColor('#C4B990').fill();
  doc.moveDown(0.5);

  doc.fillColor('#52566f').fontSize(12).font('Helvetica-Bold')
    .text('Client & Réf.', 40, doc.y)
    .text('Détails du Paiement', 300, doc.y);
    
  doc.moveDown(0.5);
  doc.fillColor('#333').fontSize(10).font('Helvetica');

  // Colonne Client
  doc.text(`Nom : ${client.firstName} ${client.lastName}`, 40, doc.y)
    .text(`ID Client : ${client.userId}`, 40, doc.y + 12);

  // Colonne Paiement (Adaptative)
  const displayPaymentMethod = paymentMethod === 'Bitcoin' ? 'Bitcoin (BTCPay)' : 'PayPal';
  
  doc.text(`Payé le : ${paymentDate} à ${paymentTime}`, 300, doc.y - 12)
    .text(`Mode : ${displayPaymentMethod}`, 300, doc.y);

  // Affichage de la référence interne AVEC "ORD-"
  doc.text(`Réf. interne : ${displayOrderId}`, 300, doc.y + 12);
  
  if (paymentMethod === 'Bitcoin') {
     doc.text(`Ref. Paiement : ${paypalOrderId.replace('BTCPAY-', '')}`, 300, doc.y + 24);
  } else {
     const finalRef = (paypalCaptureId && paypalCaptureId !== '-') ? paypalCaptureId : paypalOrderId;
     doc.text(`Ref. Paiement : ${finalRef}`, 300, doc.y + 24);
  }
  
  doc.moveDown(4);

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
  // Formatage de l'ID avec ORD-
  const displayOrderId = String(orderIdUap).startsWith('ORD-') 
      ? orderIdUap 
      : `ORD-${orderIdUap}`;

  // Génère le PDF avec la bonne méthode
  const { invoicePath, fileBase } = await generateInvoicePDF({
    orderIdUap, paypalOrderId, paypalCaptureId, amount, currency,
    client: clientDetails, companyInfo, serviceDetails, paymentMethod 
  });

  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  // Construction dynamique du HTML pour l'email
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
/**
 * Envoie une notification à l'admin lors d'une nouvelle inscription
 */
async function sendAdminNewUser(user) {
  const adminEmail = 'info@uap.immo'; // L'adresse de réception admin

  const mailOptions = {
    from: `"UAP Immo Bot" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🔔 Nouvel utilisateur : ${user.email}`,
    html: `
      <h3>Nouvelle inscription sur la plateforme</h3>
      <ul>
        <li><strong>Nom :</strong> ${user.lastName}</li>
        <li><strong>Prénom :</strong> ${user.firstName}</li>
        <li><strong>Email :</strong> ${user.email}</li>
        <li><strong>ID :</strong> ${user._id}</li>
        <li><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</li>
      </ul>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`🔔 Admin notifié pour l'inscription de ${user.email}`);
  } catch (e) {
    console.error('Erreur notification admin (User):', e);
  }
}

/**
 * Envoie une notification à l'admin lors de la création d'une page
 */
async function sendAdminNewProperty(user, property) {
  const adminEmail = 'info@uap.immo'; // ⚠️ Ton adresse de réception

  // Helper pour afficher "NC" si vide
  const val = (v) => (v !== undefined && v !== null && v !== '' && v !== 'null') ? v : 'NC';
  
  // Helper pour afficher Oui/Non au lieu de true/false
  const bool = (b) => b ? 'Oui' : 'Non';

  // Compter les photos
  const photoCount = (property.photos && Array.isArray(property.photos)) ? property.photos.length : 0;

  const mailOptions = {
    from: `"UAP Immo Bot" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🏠 Nouvelle Page créée : ${val(property.propertyType)} à ${val(property.city)}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #2c3e50;">Nouvelle Landing Page générée</h2>
        <p><strong>Utilisateur :</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
        <p><strong>Lien généré :</strong> <a href="https://uap.immo${property.url}">https://uap.immo${property.url}</a></p>

        <hr style="border: 1px solid #eee; margin: 20px 0;">

        <h3 style="color: #52566f; background: #eee; padding: 5px;">📍 Localisation & Général</h3>
        <ul>
          <li><strong>Type de bien :</strong> ${val(property.propertyType)}</li>
          <li><strong>Ville :</strong> ${val(property.city)}</li>
          <li><strong>Code Postal :</strong> ${val(property.postalCode)}</li>
          <li><strong>Pays :</strong> ${val(property.country)}</li>
          <li><strong>Prix :</strong> ${val(property.price)} €</li>
          <li><strong>Surface :</strong> ${val(property.surface)} m²</li>
          <li><strong>Année construction :</strong> ${val(property.yearBuilt)}</li>
          <li><strong>DPE :</strong> ${val(property.dpe)}</li>
        </ul>

        <h3 style="color: #52566f; background: #eee; padding: 5px;">🏠 Intérieur</h3>
        <ul>
          <li><strong>Pièces :</strong> ${val(property.rooms)}</li>
          <li><strong>Chambres :</strong> ${val(property.bedrooms)}</li>
          <li><strong>Double vitrage :</strong> ${bool(property.doubleGlazing)}</li>
          <li><strong>Volets électriques :</strong> ${bool(property.electricShutters)}</li>
        </ul>

        <h3 style="color: #52566f; background: #eee; padding: 5px;">🌳 Extérieur</h3>
        <ul>
          <li><strong>Piscine :</strong> ${bool(property.pool)}</li>
          <li><strong>Parking :</strong> ${bool(property.parking)}</li>
          <li><strong>Abri voiture :</strong> ${bool(property.carShelter)}</li>
          <li><strong>Maison gardien :</strong> ${bool(property.caretakerHouse)}</li>
          <li><strong>Arrosage auto :</strong> ${bool(property.wateringSystem)}</li>
          <li><strong>Barbecue :</strong> ${bool(property.barbecue)}</li>
          <li><strong>Éclairage ext. :</strong> ${bool(property.outdoorLighting)}</li>
        </ul>

        <h3 style="color: #52566f; background: #eee; padding: 5px;">📞 Contact affiché</h3>
        <ul>
          <li><strong>Nom :</strong> ${val(property.contactLastName)}</li>
          <li><strong>Prénom :</strong> ${val(property.contactFirstName)}</li>
          <li><strong>Téléphone :</strong> ${val(property.contactPhone)}</li>
          <li><strong>Langue de l'annonce :</strong> ${val(property.language)}</li>
        </ul>

        <h3 style="color: #52566f; background: #eee; padding: 5px;">📸 Médias</h3>
        <ul>
          <li><strong>Nombre de photos :</strong> ${photoCount}</li>
          <li><strong>Lien Vidéo :</strong> ${val(property.videoUrl)}</li>
        </ul>

        <h3 style="color: #52566f; background: #eee; padding: 5px;">📝 Description</h3>
        <p style="background: #f9f9f9; padding: 10px; border-left: 4px solid #ccc;">
          ${val(property.description)}
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`🔔 Admin notifié pour la propriété ${property._id}`);
  } catch (e) {
    console.error('Erreur notification admin (Property):', e);
  }
}

/**
 * Envoie une notification à l'admin lors d'une commande
 */
async function sendAdminNewOrder(user, order, method) {
  const adminEmail = 'info@uap.immo';
  
  const mailOptions = {
    from: `"UAP Immo notif Plateforme<${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `💰 Nouvelle commande (${method}) : ${order.amount} €`,
    html: `
      <h3>Nouvelle commande reçue</h3>
      <p><strong>Client :</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
      <hr>
      <ul>
        <li><strong>Montant :</strong> ${order.amount} €</li>
        <li><strong>Order ID (UAP) :</strong> ${order.orderId}</li>
        <li><strong>Statut :</strong> ${order.status}</li>
        <li><strong>Méthode :</strong> ${method}</li>
        <li><strong>ID Propriété :</strong> ${order.propertyId}</li>
      </ul>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`🔔 Admin notifié pour la commande ${order.orderId}`);
  } catch (e) {
    console.error('Erreur notification admin (Order):', e);
  }
}

module.exports = {
  sendInvoiceByEmail,
  sendMailPending,
  generateInvoicePDF,
  sendAdminNewUser,      
  sendAdminNewProperty,  
  sendAdminNewOrder    
};
