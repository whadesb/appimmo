const path = require('path');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const keyFilename = '/home/ec2-user/secure/uapimmo-dashboard-service-85550a959b80.json';
const propertyId = 'properties/448283789';

const analyticsDataClient = new BetaAnalyticsDataClient({ keyFilename });

async function getPageStats(pagePath, startDate = '30daysAgo', endDate = 'today') {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'country' },
        { name: 'region' },
        { name: 'city' },
        { name: 'deviceCategory' },
        { name: 'operatingSystem' },
        { name: 'browser' },
        { name: 'language' },
        { name: 'sessionDefaultChannelGroup' }
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'scrolls' }
      ]
      // ❌ Pas de dimensionFilter ici (car bug dans GA4)
    });

    const row = response.rows?.find(r => r.dimensionValues[0].value === pagePath);

    if (!row) {
      return {
        views: 0,
        users: 0,
        scrolls: 0,
        channel: 'Aucune donnée',
        device: 'Inconnu',
        os: 'Inconnu',
        browser: 'Inconnu',
        language: 'Inconnu',
        geo: {
          country: 'Inconnu',
          region: 'Inconnu',
          city: 'Inconnu'
        }
      };
    }

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
      channel: 'Erreur',
      device: 'Erreur',
      os: 'Erreur',
      browser: 'Erreur',
      language: 'Erreur',
      geo: { country: 'Erreur', region: 'Erreur', city: 'Erreur' }
    };
  }
}

module.exports = { getPageStats };
