const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

// Chemin vers ton fichier credentials.json
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Création du client
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: CREDENTIALS_PATH
});

async function getPageStats(pagePath, startDate, endDate) {
  try {
    const propertyId = process.env.GA_PROPERTY_ID; // Ex: '448283789'

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

const propertyId = 'GA4_PROPERTY_ID'; // remplace par ton ID GA4 (ex: 'properties/123456789')
const keyFilePath = './config/service-account.json'; // chemin vers ta clé JSON

// Récupération du token OAuth2 depuis le Service Account
async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: keyFilePath,
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// Fonction principale pour récupérer les stats d'une page
async function getPageStats(pagePath) {
  try {
    const accessToken = await getAccessToken();

    const requestBody = {
      dimensions: [{ name: 'pagePath' }, { name: 'sessionSourceMedium' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            value: pagePath,
            matchType: 'EXACT',
          },
        },
      },
    };

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const rows = response.data.rows;
    if (!rows || rows.length === 0) {
      return {
        views: 0,
        users: 0,
        source: 'Aucune donnée',
      };
    }

    const row = rows[0];
    return {
      views: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value),
      source: row.dimensionValues[1].value || 'Inconnu',
    };
  } catch (error) {
    console.error('❌ Erreur dans getPageStats :', error.message);
    return {
      views: 0,
      users: 0,
      source: 'Erreur',
    };
  }
}

module.exports = { getPageStats };

      dimensions: [{ name: 'pagePath' }, { name: 'source' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          inListFilter: {
            values: [pagePath] // <-- la correction essentielle ici ✅
          }
        }
      }
    });

    const rows = response.rows || [];

    let totalViews = 0;
    let totalUsers = 0;
    let topSource = 'N/A';

    rows.forEach(row => {
      const views = parseInt(row.metricValues[0].value || 0, 10);
      const users = parseInt(row.metricValues[1].value || 0, 10);
      const source = row.dimensionValues[1]?.value || 'N/A';

      totalViews += views;
      totalUsers += users;

      if (views > 0 && topSource === 'N/A') {
        topSource = source;
      }
    });

    return {
      views: totalViews,
      users: totalUsers,
      source: topSource
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

module.exports = getPageStats;
