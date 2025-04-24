const express = require('express');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf-node');

const router = express.Router();

router.get('/:propertyId', async (req, res) => {
  const propertyId = req.params.propertyId;
  const htmlPath = path.join(__dirname, '..', 'public', 'landing-pages', `${propertyId}.html`);

  try {
    if (!fs.existsSync(htmlPath)) {
      return res.status(404).send("Fichier introuvable");
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const file = { content: htmlContent };
    const options = {
      format: 'A4',
      landscape: true, // mode paysage
      printBackground: true, // inclure les images, styles
    };

    const pdfBuffer = await pdf.generatePdf(file, options);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=landing-${propertyId}.pdf`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erreur PDF :", error);
    res.status(500).send("Erreur lors de la génération du PDF");
  }
});

module.exports = router;
