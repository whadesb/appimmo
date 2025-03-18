const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

async function getAnalyticsClient() {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        return google.analyticsdata({
            version: 'v1',
            auth: authClient, // 👈 Ajout de cette ligne pour éviter l'erreur
        });
    } catch (error) {
        console.error("Erreur d'authentification Google Analytics :", error);
        return null;
    }
}

async function getPageViews(urlPath) {
    const analyticsData = await getAnalyticsClient();
    if (!analyticsData) return 'Erreur';

    try {
        const response = await analyticsData.properties.runReport({
            property: `properties/${process.env.GA_PROPERTY_ID}`, // Assure-toi que GA_PROPERTY_ID est défini
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

        return response.data.rows?.[0]?.metricValues?.[0]?.value || '0';
    } catch (error) {
        console.error('Erreur Google Analytics :', error);
        return 'Erreur';
    }
}

module.exports = { getPageViews };
