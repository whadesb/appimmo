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
 * Génère un PDF de facture professionnelle. (Inchangé)
 */
async function generateInvoicePDF(data) {
// ... (code inchangé pour generateInvoicePDF)
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
 * Envoie la facture par email (avec PDF). (Inchangé)
 */
async function sendInvoiceByEmail(
  to, fullName, orderIdUap, paypalOrderId, paypalCaptureId, amount, currency = 'EUR',
  clientDetails, companyInfo, serviceDetails, paymentMethod = 'PayPal' 
) {
// ... (code inchangé pour sendInvoiceByEmail)
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
  
  // --- NOUVEAU : NOTIFICATION ADMIN COMMANDE ---
  // On n'envoie la notification que si l'email client a réussi
  try {
      await notifyAdminNewOrder(clientDetails, displayOrderId, amount, currency, paymentMethod, serviceDetails);
  } catch(error) {
      console.error('Erreur lors de l\'envoi de la notification admin (Commande):', error);
  }
  
  return info;
}

/**
 * Envoie un email d'activation de compte. (Inchangé)
 */
async function sendAccountCreationEmail(email, token, firstName, lastName) {
// ... (code inchangé pour sendAccountCreationEmail)
  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
  const activationUrl = `${process.env.APP_URL}/fr/activate?token=${token}`;

  const mailOptions = {
    from,
    to: email,
    subject: "Bienvenue chez UAP Immo - Activation de votre compte",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #52566f;">Bonjour ${firstName},</h2>
        <p>Bienvenue sur UAP Immo ! Votre inscription a été enregistrée.</p>
        <p>Veuillez cliquer sur le lien ci-dessous pour activer votre compte et commencer à utiliser nos services :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${activationUrl}" style="background-color: #C4B990; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Activer mon compte</a>
        </p>
        <p>Si vous ne parvenez pas à cliquer sur le bouton, copiez et collez ce lien dans votre navigateur :<br/>
        <small>${activationUrl}</small></p>
        <p>Merci de nous rejoindre !<br/>L'équipe UAP Immo</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Email d\'activation envoyé', info.messageId);
  
  // --- NOUVEAU : NOTIFICATION ADMIN NOUVEL UTILISATEUR ---
  try {
      await notifyAdminNewUser({ firstName, lastName, email, token });
  } catch(error) {
      console.error('Erreur lors de l\'envoi de la notification admin (Nouvel User):', error);
  }
  
  return info;
}


/**
 * Envoie un email de réinitialisation de mot de passe. (Inchangé)
 */
async function sendPasswordResetEmail(email, token) {
// ... (code inchangé pour sendPasswordResetEmail)
  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
  const resetUrl = `${process.env.APP_URL}/fr/reset-password?token=${token}`;

  const mailOptions = {
    from,
    to: email,
    subject: "Réinitialisation de votre mot de passe UAP Immo",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #52566f;">Bonjour,</h2>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Veuillez cliquer sur le lien ci-dessous :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #C4B990; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Réinitialiser mon mot de passe</a>
        </p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
        <p>L'équipe UAP Immo</p>
      </div>
    `,
  };
  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Email de réinitialisation envoyé', info.messageId);
  return info;
}

/**
 * Envoie une notification au client après la création de l'annonce.
 */
async function sendPropertyCreationEmail(user, propertyId) {
  const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
  const propertyUrl = `${process.env.APP_URL}/fr/property/${propertyId}`;

  const mailOptions = {
    from,
    to: user.email,
    subject: "Votre annonce a été publiée sur UAP Immo",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #52566f;">Bonjour ${user.firstName},</h2>
        <p>Félicitations ! Votre nouvelle annonce a été publiée avec succès sur UAP Immo.</p>
        <p>Vous pouvez la consulter ici :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${propertyUrl}" style="background-color: #52566f; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Voir mon annonce (ID: ${propertyId})</a>
        </p>
        <p>Si vous avez besoin de la modifier ou de la retirer, vous pouvez le faire depuis votre espace "Mon Compte".</p>
        <p>Merci de faire confiance à UAP Immo !</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Email de création d\'annonce envoyé', info.messageId);

  // --- NOUVEAU : NOTIFICATION ADMIN NOUVELLE ANNONCE ---
  try {
      await notifyAdminNewProperty(user, propertyId);
  } catch(error) {
      console.error('Erreur lors de l\'envoi de la notification admin (Nouvelle Annonce):', error);
  }
  
  return info;
}

// ... (sendMailPending inchangé)

/**
 * Envoie un email à l'admin suite à une mise à jour sensible sur le compte d'un user.
 */
async function notifyAdminUserUpdate(user, updatedField, oldValue, newValue) {
    const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
    const subject = `[ALERTE] MAJ Compte User - ${user.firstName} ${user.lastName} (${user.email})`;
    
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; padding: 15px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto;">
        <h3 style="color:#e67e22;">🔔 Mise à Jour Sensible du Compte Client</h3>
        <p>L'utilisateur <strong>${user.firstName} ${user.lastName}</strong> a mis à jour une information sensible sur son profil.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background-color: #f2f2f2;"><td style="padding: 8px; border: 1px solid #ddd;">Champ mis à jour</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${updatedField}</strong></td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Ancienne valeur</td><td style="padding: 8px; border: 1px solid #ddd;">${oldValue}</td></tr>
          <tr style="background-color: #f2f2f2;"><td style="padding: 8px; border: 1px solid #ddd;">Nouvelle valeur</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${newValue}</strong></td></tr>
        </table>
        
        <p style="margin-top: 20px;"><strong>Détails du Compte :</strong></p>
        <ul>
          <li><strong>Nom / Prénom :</strong> ${user.firstName} ${user.lastName}</li>
          <li><strong>Email :</strong> ${user.email}</li>
          <li><strong>ID MongoDB :</strong> ${user._id}</li>
        </ul>
        <p>Action à titre informatif.</p>
      </div>
    `;

    const mailOptions = { from, to: ADMIN_EMAIL, subject, html: bodyHtml };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notification admin (MAJ User) envoyée: ${info.messageId}`);
    return info;
}


// ------------------------------------------
// --- FONCTIONS DE NOTIFICATION ADMIN ---
// ------------------------------------------

/**
 * Notifie l'admin d'une nouvelle inscription.
 */
async function notifyAdminNewUser(userData) {
    const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
    const subject = `[NOUVEAU] Inscription Client : ${userData.firstName} ${userData.lastName}`;
    
    const bodyHtml = `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; padding: 15px; border: 1px solid #27ae60; border-radius: 8px; max-width: 600px; margin: auto;">
            <h3 style="color:#27ae60;">🎉 Nouvelle Inscription Client</h3>
            <p>Un nouvel utilisateur s'est inscrit sur la plateforme. Son compte est en attente d'activation.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; width: 30%;">Nom Complet</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${userData.firstName} ${userData.lastName}</strong></td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${userData.email}</td></tr>
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">Statut</td><td style="padding: 8px; border: 1px solid #ddd;">Non Actif (Email envoyé)</td></tr>
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">2FA Actif</td><td style="padding: 8px; border: 1px solid #ddd;">Non</td></tr>
            </table>
        </div>
    `;

    const mailOptions = { from, to: ADMIN_EMAIL, subject, html: bodyHtml };
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notification admin (Nouvel User) envoyée: ${info.messageId}`);
    return info;
}

/**
 * Notifie l'admin d'une nouvelle création d'annonce.
 */
async function notifyAdminNewProperty(user, propertyId) {
    const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
    const subject = `[NOUVELLE PAGE] Annonce Publiée par ${user.lastName.toUpperCase()}`;
    const propertyUrl = `${process.env.APP_URL}/fr/property/${propertyId}`;

    const bodyHtml = `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; padding: 15px; border: 1px solid #3498db; border-radius: 8px; max-width: 600px; margin: auto;">
            <h3 style="color:#3498db;">🏡 Nouvelle Page d'Annonce Créée</h3>
            <p>Une nouvelle annonce a été créée et est désormais publiée.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; width: 30%;">ID Annonce</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${propertyId}</strong></td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;">Par Client</td><td style="padding: 8px; border: 1px solid #ddd;">${user.firstName} ${user.lastName}</td></tr>
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">Email Client</td><td style="padding: 8px; border: 1px solid #ddd;">${user.email}</td></tr>
            </table>

            <p style="text-align: center; margin-top: 20px;">
                <a href="${propertyUrl}" style="background-color: #52566f; color: #fff; padding: 8px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">Voir l'Annonce en Ligne</a>
            </p>
        </div>
    `;

    const mailOptions = { from, to: ADMIN_EMAIL, subject, html: bodyHtml };
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notification admin (Nouvelle Annonce) envoyée: ${info.messageId}`);
    return info;
}

/**
 * Notifie l'admin d'une nouvelle commande/paiement.
 */
async function notifyAdminNewOrder(clientDetails, orderIdUap, amount, currency, paymentMethod, serviceDetails) {
    const from = process.env.EMAIL_FROM || `"UAP Immo" <${process.env.EMAIL_USER}>`;
    const subject = `[COMMANDE] Nouveau Paiement Reçu : ${orderIdUap}`;

    const clientName = `${clientDetails.firstName} ${clientDetails.lastName}`;

    let addressHtml = 'Non renseignée';
    if (clientDetails.address && clientDetails.address.street) {
        addressHtml = `${clientDetails.address.street}<br/>${clientDetails.address.zipCode} ${clientDetails.address.city}<br/>${clientDetails.address.country}`;
    }

    const bodyHtml = `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; padding: 15px; border: 1px solid #2ecc71; border-radius: 8px; max-width: 600px; margin: auto;">
            <h3 style="color:#2ecc71;">💰 Nouvelle Commande Payée !</h3>
            <p>Un nouveau paiement a été reçu pour un service d'annonce.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; width: 30%;"><strong>Référence UAP</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${orderIdUap}</strong></td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;">Montant Total</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${amount} ${currency}</strong></td></tr>
                <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">Mode Paiement</td><td style="padding: 8px; border: 1px solid #ddd;">${paymentMethod}</td></tr>
            </table>

            <p><strong>Détails Client :</strong></p>
            <ul>
                <li><strong>Nom/Prénom :</strong> ${clientName}</li>
                <li><strong>Email :</strong> ${clientDetails.email || 'N/A'}</li>
                <li><strong>ID User :</strong> ${clientDetails.userId}</li>
                <li><strong>Adresse de Facturation :</strong> ${addressHtml}</li>
            </ul>
            
            <p><strong>Détails Service :</strong></p>
            <ul>
                <li><strong>Produit :</strong> ${serviceDetails.product}</li>
                <li><strong>Durée :</strong> ${serviceDetails.duration}</li>
                <li><strong>ID Annonce :</strong> ${serviceDetails.propertyId}</li>
            </ul>
        </div>
    `;

    const mailOptions = { from, to: ADMIN_EMAIL, subject, html: bodyHtml };
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notification admin (Nouvelle Commande) envoyée: ${info.messageId}`);
    return info;
}


module.exports = { 
  sendInvoiceByEmail, 
  sendMailPending, 
  generateInvoicePDF, 
  sendAccountCreationEmail, 
  sendPasswordResetEmail, 
  sendPropertyCreationEmail,
  notifyAdminUserUpdate // Exporté pour la 2FA ou autres mises à jour futures
};
