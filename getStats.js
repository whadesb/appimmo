const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const keyFilename = '/home/ec2-user/secure/uapimmo-dashboard-service-85550a959b80.json';
const propertyId = 'properties/448283789'; // GA4 format

const analyticsDataClient = new BetaAnalyticsDataClient({ keyFilename });

async function getPageStats(pagePath, startDate = '30daysAgo', endDate = 'today') {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'deviceCategory' },
        { name: 'country' },
        { name: 'sessionDefaultChannelGroup' }
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'scrolls' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            value: pagePath,
            matchType: 'EXACT'
          }
        }
      }
    });

    const row = response.rows?.[0];

    if (!row) {
      return {
        views: 0,
        users: 0,
        scrolls: 0,
        channel: 'Aucune donnée',
        device: 'Inconnu',
        geo: {
          country: 'Inconnu'
        }
      };
    }

    return {
      views: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
      scrolls: parseInt(row.metricValues[2]?.value || '0'),
      channel: row.dimensionValues[3]?.value || 'Non défini',
      device: row.dimensionValues[1]?.value || 'Inconnu',
      geo: {
        country: row.dimensionValues[2]?.value || 'Inconnu'
      }
    };
  } catch (error) {
    console.error('❌ Erreur dans getPageStats :', error.message || error);
    return {
      views: 0,
      users: 0,
      scrolls: 0,
      channel: 'Erreur',
      device: 'Erreur',
      geo: { country: 'Erreur' }
    };
  }
}

module.exports = { getPageStats };
