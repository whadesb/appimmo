const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const Property = require('../models/Property');

// Génère le QR code d'une URL donnée
router.get('/qr/:id', async (req, res) => {
  const propertyId = req.params.id;

  try {
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).send('Propriété non trouvée');
    }

    const fullUrl = `https://uap.immo${property.url}`;
    const qrImage = await QRCode.toDataURL(fullUrl);
    res
      .type('html')
      .send(`<img src="${qrImage}" alt="QR Code pour ${fullUrl}" style="width:200px;" />`);
  } catch (err) {
    res.status(500).send('Erreur lors de la génération du QR code');
  }
});

module.exports = router;
