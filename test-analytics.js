const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, 'middleware/uapimmo-dashboard-service-78462e7fc4cd.json'); // Vérifie bien ce chemin !

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
