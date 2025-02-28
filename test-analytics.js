const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, 'middleware/uapimmo-dashboard-service-3c912296f538.json');

async function getAnalyticsData() {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  const response = await analytics.properties.runReport({
    property: 'properties/448283789', 
    requestBody: {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
    },
  });

  console.log(response.data);
}

getAnalyticsData().catch(console.error);
