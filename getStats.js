const path = require('path');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// ✅ Chemin vers la clé JSON sur ton serveur
const keyFilename = '/home/ec2-user/secure/uapimmo-dashboard-service-85550a959b80.json';

// ✅ ID de propriété GA4 (au bon format : "properties/XXXXX")
const propertyId = 'properties/448283789';

// ✅ Initialisation correcte du client
const analyticsDataClient = new BetaAnalyticsDataClient({ keyFilename });

async function getPageStats(pagePath, startDate = '30daysAgo', endDate = 'today') {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
  { name: 'pagePath' },
  { name: 'sessionSourceMedium' }
],
metrics: [
  { name: 'screenPageViews' },
  { name: 'activeUsers' }
],

      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            value: pagePath,
            matchType: 'EXACT',
          },
        },
      },
    });

    // 🔁 Résumé global : première ligne
    const row = response.rows?.[0];

    if (!row) return {
      views: 0,
      users: 0,
      scrolls: 0,
      source: 'Aucune donnée',
    };

    return {
  views: parseInt(row.metricValues[0]?.value || '0'),
  users: parseInt(row.metricValues[1]?.value || '0'),
  scrolls: parseInt(row.metricValues[2]?.value || '0'),
  channel: row.dimensionValues[8]?.value || 'Non défini', 
  device: row.dimensionValues[4]?.value || 'Inconnu',
  os: row.dimensionValues[5]?.value || 'Inconnu',
  browser: row.dimensionValues[6]?.value || 'Inconnu',
  language: row.dimensionValues[7]?.value || 'Inconnu',
  geo: {
    country: row.dimensionValues[1]?.value || 'Inconnu',
    region: row.dimensionValues[2]?.value || 'Inconnu',
    city: row.dimensionValues[3]?.value || 'Inconnu'
  }
};


  } catch (error) {
    console.error('❌ Erreur dans getPageStats :', error.message || error);
    return {
      views: 0,
      users: 0,
      scrolls: 0,
      source: 'Erreur',
      device: 'Erreur',
      os: 'Erreur',
      browser: 'Erreur',
      language: 'Erreur',
      geo: { country: 'Erreur', region: 'Erreur', city: 'Erreur' }
    };
  }
}

module.exports = { getPageStats };
