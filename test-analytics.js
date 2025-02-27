const { google } = require('googleapis');
const analyticsData = google.analyticsdata('v1beta');
const path = require('path');

async function testAnalyticsAccess() {
  // Chemin vers ton fichier JSON de compte de service
  const keyFilePath = path.join(__dirname, 'chemin/vers/ton-fichier-service-account.json');

  // Initialisation de l'authentification avec le compte de service
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  try {
    // Vérifie la connexion avec Google Analytics Data API
    const analyticsClient = await analyticsData.properties.runReport({
      auth,
      property: 'properties/XXXXXXXXX', // Remplace par ton Property ID Analytics
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        limit: 5,
      },
    });

    console.log('✅ Connexion réussie ! Voici quelques données :');
    console.log(analyticsClient.data.rows);
  } catch (error) {
    console.error('❌ Erreur d’accès à Google Analytics :', error);
  }
}

// Exécute le test
testAnalyticsAccess();
