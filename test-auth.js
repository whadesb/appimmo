const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, 'middleware/uapimmo-dashboard-service-1f15a378df94.json');

async function testAuth() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const client = await auth.getClient();
    console.log('✅ Authentification réussie avec Google Analytics !');
  } catch (error) {
    console.error('❌ Erreur d\'authentification :', error);
  }
}

testAuth();
