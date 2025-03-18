const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

// 🔹 Remplace par ton ID Google Analytics
const GA4_PROPERTY_ID = '448283789';

// 🔹 Initialise le client API
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: path.join(__dirname, 'service-account.json') // Clé API
});

// 🔹 Fonction pour récupérer les stats d'une page spécifique
async function getPageViews(pagePath) {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], // Derniers 7 jours
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'EXACT', value: pagePath }
      }
    }
  });

  return response.rows.length > 0 ? response.rows[0].metricValues[0].value : 0;
}

// 🔹 Test avec une landing page spécifique
(async () => {
  const pagePath = '/landing-pages/67d2085553a03b9b2ce4a939.html';
  const views = await getPageViews(pagePath);
  console.log(`Page: ${pagePath}, Visites: ${views}`);
})();
