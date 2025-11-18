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
async function generateInvoicePDF(data) { // Signature modifiée pour accepter un objet 'data' complet
  const {
    orderIdUap,
    paypalOrderId,
    paypalCaptureId,
    amount,
    currency = 'EUR',
    client,       // { userId, firstName, lastName }
    companyInfo,  // { name, address, siret, tva }
    serviceDetails, // { duration, product }
  } = data;

  // Calculs simples
  const amountTTC = Number(amount) || 500;
  const tvaRate = 0; // Assumer 0% pour l'exemple (Franchise en base de TVA)
  const amountHT = amountTTC;
  const amountTVA = 0;
  const invoiceNumber = `F-${new Date().getFullYear()}-${orderIdUap.slice(-6)}`;
  const paymentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const validityExpiration = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  const paymentTime = paymentDate.split(' ')[1] || '-';


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

  // --- LOGIQUE D'AFFICHAGE AMÉLIORÉE (simulant un template pro) ---

  // Logo / Titre
  doc.fillColor('#52566f')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text(companyInfo.name, 40, 50)
    .moveDown(0.2);

  // Informations de l'entreprise (À GAUCHE)
  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica')
    .text(companyInfo.address[0], 40, 85)
    .text(companyInfo.address[1])
    .moveDown(0.5)
    .text(`Siret : ${companyInfo.siret}`)
    .text(`TVA Intracom. : ${companyInfo.tva || 'N/A'}`);

  // Reçu / Facture N° (À DROITE)
  doc.fontSize(14)
    .fillColor('#C4B990')
    .text('FACTURE / REÇU DE PAIEMENT', 400, 50, { align: 'right' });
    
  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`N° : ${invoiceNumber}`, 400, 85, { align: 'right' })
    .moveDown(0.2)
    .text(`Date : ${paymentDate.split(' ')[0]}`, { align: 'right' });


  // --- SECTION CLIENT ET PAIEMENT ---
  doc.moveDown(2);
  doc.rect(40, doc.y, 515, 1).fillColor('#C4B990').fill();
  doc.moveDown(0.5);

  doc.fillColor('#52566f')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Client & Réf.', 40, doc.y)
    .text('Détails du Paiement', 300, doc.y)
    .moveDown(0.5);

  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica');

  // Colonne Client
  doc.text(`Nom : ${client.firstName} ${client.lastName}`, 40, doc.y)
    .text(`ID Client : ${client.userId}`, 40, doc.y + 12);

  // Colonne Paiement
  doc.text(`Payé le : ${paymentDate} CET`, 300, doc.y - 12)
    .text(`Mode : PayPal / [Crypto]`, 300, doc.y);

  doc.text(`Réf. commande UAP : ORD-${orderIdUap || '-'}`, 300, doc.y + 12)
    .text(`Réf. PayPal/Txn ID : ${paypalCaptureId || paypalOrderId || '-'}`, 300, doc.y + 24)
    .moveDown(4);

  // --- TABLEAU DE SERVICE ---
  
  // En-tête du tableau
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

  // Ligne de service
  doc.text(`${serviceDetails.product} (${serviceDetails.duration})`, 50, doc.y + 10)
    .text(`${amountHT.toFixed(2)} €`, 380, doc.y + 10)
    .text(`${amountTVA.toFixed(2)} €`, 450, doc.y + 10)
    .font('Helvetica-Bold')
    .text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 10, { align: 'right', width: 50 });

  // Séparateur de fin de ligne
  doc.moveDown(0.5);
  doc.rect(40, doc.y, 515, 0.5).fillColor('#eee').fill();
  doc.moveDown(1);
  
  // --- TOTAUX ---
  doc.fillColor('#333')
    .font('Helvetica')
    .text('Total HT :', 380, doc.y, { align: 'right' })
    .text(`${amountHT.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });

  doc.moveDown(0.5);
  doc.text('TVA (0.00 %) :', 380, doc.y, { align: 'right' })
    .text(`${amountTVA.toFixed(2)} €`, 500, doc.y, { align: 'right', width: 50 });
  
  // Total TTC
  doc.moveDown(0.8);
  doc.fillColor('#C4B990')
    .rect(375, doc.y, 180, 25).fill()
    .fillColor('#000')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('TOTAL PAYÉ (EUR) :', 380, doc.y + 7)
    .text(`${amountTTC.toFixed(2)} €`, 500, doc.y + 7, { align: 'right', width: 50 });


  // --- VALIDITÉ & BAS DE PAGE ---
  doc.moveDown(2.5);
  doc.fillColor('#333')
    .fontSize(10)
    .font('Helvetica')
    .text(`Validité de l'offre : 90 jours, jusqu'au ${validityExpiration}.`, 40, doc.y);
    
  doc.moveDown(0.5);
  doc.font('Helvetica-Oblique').text('TVA non applicable, art. 293 B du CGI.', 40, doc.y);


  // Footer
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#777')
    .text('Merci pour votre achat. Document généré automatiquement.', 40, 750, { align: 'center' });
    
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { invoicePath, fileBase };
}


module.exports = {
  sendInvoiceByEmail,
  sendMailPending,
  generateInvoicePDF, 
};

