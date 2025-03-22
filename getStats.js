const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Remplace par ton propre GA4 PROPERTY ID
const propertyId = 'YOUR_GA4_PROPERTY_ID';

const analyticsDataClient = new BetaAnalyticsDataClient();

async function getPageStats(pagePaths = []) {
  try {
    const startDate = '365daysAgo'; // Sur les 12 derniers mois
    const endDate = 'today';

    const [response] = await analyticsDataClient.runReport({
  property: `properties/${GA_PROPERTY_ID}`,
  dateRanges: [
    {
      startDate: startDate,
      endDate: endDate,
    },
  ],
  dimensions: [{ name: 'pagePath' }, { name: 'source' }],
  metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  dimensionFilter: {
    filter: {
      fieldName: 'pagePath',
      inListFilter: {
        values: [pagePath], // 👈 Assure-toi que c'est bien un array
      },
    },
  },
});


    const results = response[0].rows.map(row => ({
      pagePath: row.dimensionValues[0].value,
      source: row.dimensionValues[1].value,
      medium: row.dimensionValues[2].value,
      screenPageViews: row.metricValues[0].value,
      users: row.metricValues[1].value,
    }));

    return results;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error.message);
    return [];
  }
}

module.exports = { getPageStats };
