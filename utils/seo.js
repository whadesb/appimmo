const fs = require('fs');
const path = require('path');
const https = require('https');

// 📄 Crée le fichier sitemap.xml s'il n'existe pas
function ensureSitemapExists() {
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

  if (!fs.existsSync(sitemapPath)) {
    const defaultSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset 
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    fs.writeFileSync(sitemapPath, defaultSitemap, 'utf8');
    console.log('📄 Fichier sitemap.xml créé.');
  }
}

// 🔁 Ajoute une nouvelle URL dans le sitemap si elle n'existe pas
function addToSitemap(url) {
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

  ensureSitemapExists(); // ✅ Appel pour s'assurer que le fichier existe

  let content = fs.readFileSync(sitemapPath, 'utf8');
  const newEntry = `
  <url>
    <loc>${url}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  if (!content.includes(url)) {
    content = content.replace('</urlset>', `${newEntry}\n</urlset>`);
    fs.writeFileSync(sitemapPath, content, 'utf8');
    console.log('✅ URL ajoutée au sitemap :', url);
  } else {
    console.log('ℹ️ URL déjà présente dans le sitemap.');
  }
}

// 🔔 Ping Google & Bing pour leur dire que le sitemap a été mis à jour
function pingSearchEngines(sitemapUrl) {
  const googlePing = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  const bingPing = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

  [googlePing, bingPing].forEach(pingUrl => {
    https.get(pingUrl, res => {
      console.log(`🔔 Ping envoyé à ${pingUrl} — Code HTTP : ${res.statusCode}`);
    }).on('error', err => {
      console.error(`❌ Erreur ping ${pingUrl} :`, err.message);
    });
  });
}

// ✅ Exports
module.exports = {
  addToSitemap,
  ensureSitemapExists,
  pingSearchEngines
};
