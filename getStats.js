const path = require('path');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// ✅ Chemin vers la clé JSON sur ton serveur
const keyFilename = '/home/ec2-user/secure/uapimmo-dashboard-service-85550a959b80.json';

// ✅ ID de propriété GA4 (au bon format : "properties/XXXXX")
const propertyId = 'properties/448283789';

// ✅ Initialisation correcte du client
const analyticsDataClient = new BetaAnalyticsDataClient({ keyFilename });

async function getPageStats(pagePath) {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: propertyId,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
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

    const row = response.rows?.[0];
    return {
      views: parseInt(row?.metricValues?.[0]?.value || '0'),
      users: parseInt(row?.metricValues?.[1]?.value || '0'),
      source: row?.dimensionValues?.[1]?.value || 'Inconnu'
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

module.exports = { getPageStats };
