const fs = require('fs');
const path = require('path');

function addToSitemap(url) {
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

  if (!fs.existsSync(sitemapPath)) return;

  let content = fs.readFileSync(sitemapPath, 'utf8');

  const newEntry = `
  <url>
    <loc>${url}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  `;

  if (!content.includes(url)) {
    content = content.replace('</urlset>', `${newEntry}\n</urlset>`);
    fs.writeFileSync(sitemapPath, content, 'utf8');
    console.log('✅ URL ajoutée au sitemap :', url);
  } else {
    console.log('ℹ️ URL déjà présente dans le sitemap.');
  }
}
