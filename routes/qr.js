const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();

// Génère le QR code d'une URL donnée
router.get('/qr/:id', async (req, res) => {
  const propertyId = req.params.id;
  const fullUrl = `https://uap.immo/landing-pages/${propertyId}.html`;

  try {
    const qrImage = await QRCode.toDataURL(fullUrl);
    res.type('html').send(`<img src="${qrImage}" alt="QR Code pour ${fullUrl}" style="width:200px;" />`);
  } catch (err) {
    res.status(500).send('Erreur lors de la génération du QR code');
  }
});

module.exports = router;
