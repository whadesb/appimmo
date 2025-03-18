const { google } = require('googleapis');
const path = require('path');
const analyticsData = google.analyticsdata('v1');
require('dotenv').config();

// Authentification avec Service Account
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'), // Fichier JSON du compte de service
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

// ID de ta propriété Google Analytics (GA4)
const GA_PROPERTY_ID = 'XXXXXXXX'; // Remplace par ton propre ID de propriété GA4

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
