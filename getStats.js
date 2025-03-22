const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');

const propertyId = process.env.GA_PROPERTY_ID || '448283789'; // Remplace par ton vrai ID
const keyFilePath = path.join(__dirname, 'config', 'service-account.json'); // Chemin vers ta clé JSON

// 🔐 Récupère le token OAuth2
async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: keyFilePath,
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// 📊 Récupère les stats pour une page donnée
async function getPageStats(pagePath) {
  try {
    const accessToken = await getAccessToken();

    const requestBody = {
      dimensions: [
        { name: 'pagePath' },
        { name: 'sessionSourceMedium' }
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' }
      ],
      dateRanges: [
        { startDate: '30daysAgo', endDate: 'today' }
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
    console.error('❌ Erreur dans getPageStats :', error.message || error);
    return {
      views: 0,
      users: 0,
      source: 'Erreur',
    };
  }
}

module.exports = { getPageStats };
