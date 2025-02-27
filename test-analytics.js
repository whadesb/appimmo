const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, 'middleware/uapimmo-dashboard-service-78462e7fc4cd.json');
const propertyId = '448283789'; // Remplace par ton Property ID de GA4

async function getAnalyticsData() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const analytics = google.analyticsdata({ version: 'v1beta', auth });

    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
      },
    });

    console.log(' Données récupérées avec succès :', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(' Erreur lors de la récupération des données Analytics :', error);
  }
}

getAnalyticsData();
