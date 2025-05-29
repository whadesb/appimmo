const path = require('path');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const keyFilename = '/home/ec2-user/secure/uapimmo-dashboard-service-85550a959b80.json';
const propertyId = 'properties/448283789';

const analyticsDataClient = new BetaAnalyticsDataClient({ keyFilename });

async function getPageStats(pagePath, startDate = '30daysAgo', endDate = 'today') {
  try {
    if (!pagePath || typeof pagePath !== 'string') {
      throw new Error('Paramètre pagePath invalide');
    }

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
        { name: 'userEngagementDuration' } // scrolls si dispo
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
    const dims = row?.dimensionValues || [];
    const metrics = row?.metricValues || [];

    return {
      views: parseInt(metrics[0]?.value || '0'),
      users: parseInt(metrics[1]?.value || '0'),
      scrolls: Math.round(parseFloat(metrics[2]?.value || '0')),
      channel: dims[8]?.value || 'Non défini',
      device: dims[4]?.value || 'Inconnu',
      os: dims[5]?.value || 'Inconnu',
      browser: dims[6]?.value || 'Inconnu',
      language: dims[7]?.value || 'Inconnu',
      geo: {
        country: dims[1]?.value || 'Inconnu',
        region: dims[2]?.value || 'Inconnu',
        city: dims[3]?.value || 'Inconnu'
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
