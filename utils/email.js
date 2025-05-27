const nodemailer = require('nodemailer');

async function sendInvoiceByEmail(to, transactionId, amount, currency) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"UAP Immo" <${process.env.MAIL_USER}>`,
    to,
    subject: "Votre reçu de paiement UAP Immo",
    html: `
      <h2>Merci pour votre achat !</h2>
      <p>Voici les détails de votre transaction :</p>
      <ul>
        <li><strong>ID de transaction :</strong> ${transactionId}</li>
        <li><strong>Montant :</strong> ${amount} ${currency}</li>
      </ul>
      <p>Pour toute question, contactez-nous à contact@uap.immo.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Facture envoyée à ${to}`);
}

module.exports = { sendInvoiceByEmail };
