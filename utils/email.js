const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Utilise la variable ADMIN_RECEIVER_EMAIL pour la réception des alertes
const ADMIN_RECEIVER_EMAIL = process.env.ADMIN_RECEIVER_EMAIL || 'info@uap.company'; 

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
 * Fonction interne pour envoyer une alerte à l'admin
 */
async function sendAdminAlert(subject, htmlContent) {
  console.log(`🔔 Tentative envoi Admin vers : ${ADMIN_RECEIVER_EMAIL}`);
    try {
        const mailOptions = {
            from: `"UAP Bot" <${process.env.EMAIL_USER}>`, 
            to: ADMIN_RECEIVER_EMAIL, 
            subject: `[ALERTE] ${subject}`,
            html: `<div style="font-family: Arial; padding: 20px; background: #f4f4f4; border: 1px solid #ddd;">
                    <h3 style="color: #52566f;">🔔 Notification Admin UAP</h3>
                    ${htmlContent}
                    <p style="font-size: 12px; color: #888; margin-top: 20px;">Email automatique interne.</p>
                   </div>`
        };
        await transporter.sendMail(mailOptions);
        console.log('🔔 Alerte Admin envoyée à:', ADMIN_RECEIVER_EMAIL);
    } catch (error) {
        console.error('❌ Erreur envoi alerte admin:', error);
    }
}

/**
 * Envoie un email générique
 */
async function sendEmail(mailOptions) {
    const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
    mailOptions.from = from;
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email envoyé avec succès à :', mailOptions.to);
        return info;
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'email :', error);
        throw error;
    }
}

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

  // Formatage ID
  const displayOrderId = String(orderIdUap).startsWith('ORD-') ? orderIdUap : `ORD-${orderIdUap}`;
  
  // Calculs
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
  const startY = doc.y;
  doc.rect(40, startY, 515, 1).fillColor('#C4B990').fill();
  doc.moveDown(0.5);

  doc.fillColor('#52566f').fontSize(12).font('Helvetica-Bold');
  doc.text('Client & Facturation', 40, doc.y);
  doc.text('Détails du Paiement', 300, doc.y - 12);
  doc.moveDown(0.5);
  doc.fillColor('#333').fontSize(10).font('Helvetica');

  // --- COLONNE GAUCHE : CLIENT + ADRESSE ---
  let currentY = doc.y;
  
  // Nom
  doc.text(`Nom : ${client.firstName} ${client.lastName}`, 40, currentY);
  currentY += 14;

  // ✅ AJOUT : Adresse Client
  if (client.address) {
      // Rue
      if (client.address.street) {
          doc.text(client.address.street, 40, currentY);
          currentY += 12;
      }
      // CP + Ville
      if (client.address.zipCode || client.address.city) {
          doc.text(`${client.address.zipCode || ''} ${client.address.city || ''}`, 40, currentY);
          currentY += 12;
      }
      // Pays
      if (client.address.country) {
          doc.text(client.address.country, 40, currentY);
          currentY += 12;
      }
  }
  
  // ID Client (avec un petit espace avant)
  currentY += 4;
  doc.text(`ID Client : ${client.userId}`, 40, currentY);


  // --- COLONNE DROITE : PAIEMENT ---
  let rightColumnY = startY + 25;
  const displayPaymentMethod = paymentMethod === 'Bitcoin' ? 'Bitcoin (BTCPay)' : 'PayPal';
  
  doc.text(`Payé le : ${paymentDate} à ${paymentTime}`, 300, rightColumnY); rightColumnY += 12;
  doc.text(`Mode : ${displayPaymentMethod}`, 300, rightColumnY); rightColumnY += 12;
  doc.text(`Réf. interne : ${displayOrderId}`, 300, rightColumnY); rightColumnY += 12;
  
  if (paymentMethod === 'Bitcoin') {
     doc.text(`Ref. Paiement : ${paypalOrderId.replace('BTCPAY-', '')}`, 300, rightColumnY);
  } else {
     const finalRef = (paypalCaptureId && paypalCaptureId !== '-') ? paypalCaptureId : paypalOrderId;
     doc.text(`Ref. Paiement : ${finalRef}`, 300, rightColumnY);
  }
  
  // On place le curseur sous la colonne la plus longue
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
 * Envoie la facture par email (Client) + Notification Admin
 */
async function sendInvoiceByEmail(
  to, fullName, orderIdUap, paypalOrderId, paypalCaptureId, amount, currency = 'EUR',
  clientDetails, companyInfo, serviceDetails, paymentMethod = 'PayPal' 
) {
  const displayOrderId = String(orderIdUap).startsWith('ORD-') ? orderIdUap : `ORD-${orderIdUap}`;
  const finalRef = (paymentMethod === 'Bitcoin') ? paypalOrderId.replace('BTCPAY-', '') : ((paypalCaptureId && paypalCaptureId !== '-') ? paypalCaptureId : paypalOrderId);

  // Génération PDF (L'adresse sera incluse grâce à la modif ci-dessus)
  const { invoicePath, fileBase } = await generateInvoicePDF({
    orderIdUap, paypalOrderId, paypalCaptureId, amount, currency,
    client: clientDetails, companyInfo, serviceDetails, paymentMethod 
  });

  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;

  // Construction du HTML email
  let paymentRowsHtml = `
    <li><b>Réf. interne :</b> ${displayOrderId}</li>
    <li><b>Ref. Paiement :</b> ${finalRef}</li>
    <li><b>Moyen de paiement :</b> ${paymentMethod}</li>
  `;

  // ✅ AJOUT : Affichage de l'adresse dans l'email aussi
  let addressHtml = '';
  if (clientDetails.address && clientDetails.address.street) {
      addressHtml = `
        <li style="margin-top:10px; list-style:none;"><strong>Adresse de facturation :</strong><br>
        ${clientDetails.address.street}<br>
        ${clientDetails.address.zipCode} ${clientDetails.address.city}<br>
        ${clientDetails.address.country}</li>
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
          ${addressHtml}
        </ul>
        <p>📎 <b>Votre facture est jointe à cet email au format PDF.</b></p>
        <p style="margin-top: 16px;">👉 Mon compte : <a href="https://uap.immo/fr/login">https://uap.immo/fr/login</a></p>
        <hr/><p style="font-size:12px;color:#888;">Cet email a été envoyé automatiquement.</p>
      </div>
    `,
    attachments: [{ filename: `facture-${fileBase}.pdf`, path: invoicePath }],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Facture envoyée au client', to);

  // 3. Notification Admin
  const adminHtml = `
    <p>Une nouvelle commande a été payée avec succès.</p>
    <ul>
        <li><strong>Client :</strong> ${fullName} (${to})</li>
        <li><strong>Réf Commande :</strong> ${displayOrderId}</li>
        <li><strong>Montant :</strong> ${amount} ${currency}</li>
        <li><strong>Moyen de paiement :</strong> ${paymentMethod}</li>
        <li><strong>Transaction ID :</strong> ${finalRef}</li>
    </ul>
    <p>La facture est également jointe à cet e-mail.</p>
  `;
  
  await sendAdminAlert(`Nouvelle Commande PAYÉE (${amount}€)`, adminHtml);
  return info;
}

// ... (les autres fonctions comme sendAccountCreationEmail restent inchangées) ...
async function sendAccountCreationEmail(email, firstName, lastName, locale = 'fr') {
  const loginUrl = locale === 'fr' ? 'https://uap.immo/fr/login' : 'https://uap.immo/en/login';
  const mailOptions = {
    from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Bienvenue chez UAP Immo / Welcome to UAP Immo',
    html: `
      <div style="font-family:Arial;">
        <h2>Bienvenue ${firstName} !</h2>
        <p>Votre compte est créé.</p>
        <p><a href="${loginUrl}">Connexion</a></p>
      </div>`
  };
  await transporter.sendMail(mailOptions);
  const adminHtml = `
    <p>Un nouvel utilisateur vient de s'inscrire.</p>
    <ul>
        <li><strong>Nom :</strong> ${lastName}</li>
        <li><strong>Prénom :</strong> ${firstName}</li>
        <li><strong>Email :</strong> ${email}</li>
    </ul>
  `;
  await sendAdminAlert(`Nouvelle Inscription : ${email}`, adminHtml);
}

async function sendPasswordResetEmail(user, locale, resetUrl, code) {
  // ... (code inchangé)
  const subject = 'Réinitialisation du mot de passe / Password Reset';
  const html = `<p>Code: ${code}</p><p><a href="${resetUrl}">Réinitialiser</a></p>`;
  const mailOptions = { from: `"UAP Immo" <${process.env.EMAIL_USER}>`, to: user.email, subject, html };
  await transporter.sendMail(mailOptions);
}

async function sendPropertyCreationEmail(user, property) {
    // ... (code inchangé)
    const mailOptions = {
        from: `"UAP Immo" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Votre annonce a été publiée',
        html: `<div>Annonce créée pour ${property.city}.</div>`
    };
    await transporter.sendMail(mailOptions);
    const adminHtml = `<p>Nouvelle page générée pour ${user.email}. Ville: ${property.city}</p>`;
    await sendAdminAlert(`Nouvelle Page Créée : ${property.city}`, adminHtml);
}

async function send2FAUpdateNotification(user, status) {
    const adminHtml = `<p>User ${user.email} - 2FA: ${status}</p>`;
    await sendAdminAlert(`MAJ Sécurité 2FA : ${user.email}`, adminHtml);
}

async function sendMailPending(to, fullName, orderId, amount) {
    const info = await transporter.sendMail({
        from: process.env.EMAIL_USER, to, subject: `Commande ${orderId} en attente`, html: `Commande en attente de paiement.`
    });
    await sendAdminAlert(`Commande en attente (${amount}€)`, `<p>User ${fullName} (${to}) commande ${orderId}.</p>`);
    return info;
}

module.exports = { 
    sendInvoiceByEmail, 
    sendMailPending, 
    generateInvoicePDF,
    sendAccountCreationEmail,
    sendPasswordResetEmail, 
    sendPropertyCreationEmail,
    send2FAUpdateNotification, 
    sendAdminAlert,
    sendEmail
};
