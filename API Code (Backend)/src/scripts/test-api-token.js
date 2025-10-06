// test-api-token.js
const axios = require('axios');

// Replace with your actual API token
const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OTljZTc4YS04ZDdhLTQ1MGYtYWUwOS0xMGI1ZDIyOTI3MDkiLCJjbGllbnRJZCI6ImIwMzU1NTIxLTQwOWEtNGNhNi04ODdmLWQ2OGZiNGU1OTlmYSIsInJvbGUiOiJ1c2VyIiwidHdvRmFjdG9yRW5hYmxlZCI6ZmFsc2UsInR5cGUiOiJhcGkiLCJpYXQiOjE3NTg2NTM4MTUsImV4cCI6MTc2MTI0NTgxNX0.aUTpKpoya14flq22icDEudIYq58igaHIimWT9AQ5GoY';
const API_URL = 'https://bankingintelligenceapi.com';

// Simple function to test the API token
async function testApiToken() {
	try {
		// Make a request to an endpoint that requires authentication
		const response = await axios.get(`${API_URL}/api/clients/user-client`, {
			headers: {
				'Authorization': `Bearer ${API_TOKEN}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('API request successful!');
		console.log('Status:', response.status);
		console.log('Data:', JSON.stringify(response.data, null, 2));
		return true;
	} catch (error) {
		console.error('API request failed:');

		if (error.response) {
			// The request was made and the server responded with an error status
			console.error('Status:', error.response.status);
			console.error('Response:', JSON.stringify(error.response.data, null, 2));
		} else if (error.request) {
			// The request was made but no response was received
			console.error('No response received from server');
		} else {
			// Something happened in setting up the request
			console.error('Error:', error.message);
		}
		return false;
	}
}

// Run the test
testApiToken();