const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const GA4_PROPERTY_ID = '448283789';

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: path.join(__dirname, 'service-account.json')
});

async function getPageStats(pagePath) {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
   dateRanges: [{ startDate: '365daysAgo', endDate: 'yesterday' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' }
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'totalUsers' }
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'EXACT', value: pagePath }
      }
    }
  });

  if (!response.rows || response.rows.length === 0) {
    return null;
  }

  const row = response.rows[0];
  return {
    pagePath: row.dimensionValues[0].value,
    source: row.dimensionValues[1].value,
    medium: row.dimensionValues[2].value,
    views: row.metricValues[0].value,
    users: row.metricValues[1].value
  };
}

module.exports = { getPageStats };
