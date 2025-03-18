const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// Authentification avec Service Account
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'), // Assure-toi que ce fichier est bien présent
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

// Instancier analyticsData avec authentification
const analyticsData = google.analyticsdata({
    version: 'v1',
    auth
});

// ID de la propriété GA4
const GA_PROPERTY_ID = 'XXXXXXXXX'; // Remplace par ton vrai ID de propriété GA4

// Fonction pour récupérer les statistiques d'une URL spécifique
async function getPageViews(urlPath) {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const response = await analyticsData.properties.runReport({
            property: `properties/${GA_PROPERTY_ID}`,
            requestBody: {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'pagePath' }],
                metrics: [{ name: 'screenPageViews' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'pagePath',
                        stringFilter: {
                            matchType: 'EXACT',
                            value: urlPath,
                        },
                    },
                },
            },
        });

        if (response.data.rows) {
            return response.data.rows[0]?.metricValues[0]?.value || '0';
        } else {
            return '0';
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des données GA4:', error);
        return 'Erreur';
    }
}

module.exports = { getPageViews };
