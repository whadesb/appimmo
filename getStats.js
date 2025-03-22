const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

// Chemin vers ton fichier credentials.json
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Création du client
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: CREDENTIALS_PATH
});

async function getPageStats(pagePath, startDate, endDate) {
  try {
    const propertyId = process.env.GA_PROPERTY_ID; // Ex: '448283789'

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }, { name: 'source' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          inListFilter: {
            values: [pagePath] // <-- la correction essentielle ici ✅
          }
        }
      }
    });

    const rows = response.rows || [];

    let totalViews = 0;
    let totalUsers = 0;
    let topSource = 'N/A';

    rows.forEach(row => {
      const views = parseInt(row.metricValues[0].value || 0, 10);
      const users = parseInt(row.metricValues[1].value || 0, 10);
      const source = row.dimensionValues[1]?.value || 'N/A';

      totalViews += views;
      totalUsers += users;

      if (views > 0 && topSource === 'N/A') {
        topSource = source;
      }
    });

    return {
      views: totalViews,
      users: totalUsers,
      source: topSource
    };

  } catch (error) {
    console.error('❌ Erreur dans getPageStats :', error.message || error);
    return {
      views: 0,
      users: 0,
      source: 'Erreur'
    };
  }
}

module.exports = getPageStats;
