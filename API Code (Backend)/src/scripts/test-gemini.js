// scripts/simple-gemini-test.js
require('dotenv').config();
const genAI = require('@google/genai');

/**
 * Test the Gemini API using the default package exports
 */
async function testGemini() {
	console.log('=== Testing Gemini API (Simple Version) ===\n');

	// Check environment variables
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('❌ GEMINI_API_KEY not set in .env file');
		return;
	}
	console.log('✓ GEMINI_API_KEY is set');

	try {
		console.log('\nPackage inspection:');
		console.log('- Type of genAI:', typeof genAI);
		console.log('- Keys available:', Object.keys(genAI));

		// Initialize the client using default export if it's a function
		if (typeof genAI === 'function') {
			console.log('\nInitializing client using default export as constructor...');
			const genAIClient = new genAI({ apiKey });
			console.log('✓ Client initialized!');
			console.log('Client properties:', Object.keys(genAIClient));

			if (genAIClient.models) {
				console.log('✓ Client has models property');
			}

			if (genAIClient.generateContent) {
				console.log('✓ Client has generateContent method');
			}

			// Try to make a request
			console.log('\nTrying to generate content...');
			const result = await genAIClient.generateContent('Give me a financial tip');
			console.log('✓ Content generated!');
			console.log('\nResponse:');
			console.log('-------------------');
			console.log(result.response?.text());
			console.log('-------------------');
		}
		// If not a function, look for alternative approaches
		else {
			console.log('\nSearching for alternative approaches...');

			// Check if there's a GenerativeModel class
			if (genAI.GenerativeModel) {
				console.log('Found GenerativeModel class, trying to use it...');
				const model = new genAI.GenerativeModel({
					model: 'gemini-2.5-flash',
					apiKey
				});

				const result = await model.generateContent('Give me a financial tip');
				console.log('✓ Content generated with GenerativeModel!');
				console.log('\nResponse:');
				console.log('-------------------');
				console.log(result.response?.text());
				console.log('-------------------');
			}
			// Check for other possible classes or methods
			else {
				for (const key of Object.keys(genAI)) {
					if (typeof genAI[key] === 'function') {
						console.log(`Found function ${key}, exploring...`);
						try {
							const instance = new genAI[key]({ apiKey });
							console.log(`- Created instance of ${key}:`, Object.keys(instance));
						} catch (err) {
							console.log(`- Could not instantiate ${key}:`, err.message);
						}
					}
				}
			}
		}

		console.log('\nTest completed!');

	} catch (error) {
		console.error('❌ Error during Gemini test:', error);
		console.error('Stack trace:', error.stack);
	}
}

// Run the test
testGemini().catch(console.error);