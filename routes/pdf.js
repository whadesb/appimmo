const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');

router.get('/:propertyId', async (req, res) => {
  const propertyId = req.params.propertyId;
  const url = `${process.env.BASE_URL}/landing-pages/${propertyId}.html`;

  try {
    const browser = await puppeteer.launch({
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
console.log("🔍 URL chargée :", url);
const response = await page.goto(url, { waitUntil: 'networkidle0' });

if (!response || !response.ok()) {
  console.error('❌ Erreur HTTP lors du chargement de la page :', response && response.status());
  return res.status(500).send('Impossible de charger la page HTML');
}


    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=landing-${propertyId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erreur PDF :', err);
    res.status(500).send('Erreur lors de la génération du PDF');
  }
});

module.exports = router;
