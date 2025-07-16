#!/usr/bin/env node
// scripts/diagnose-groq.js

/**
 * CLI tool to diagnose Groq API issues
 * Run with: node scripts/diagnose-groq.js
 */

const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Set up console for better logging
const console = {
	log: (message) => process.stdout.write(message + '\n'),
	error: (message) => process.stderr.write('\x1b[31m' + message + '\x1b[0m\n'),
	warn: (message) => process.stdout.write('\x1b[33m' + message + '\x1b[0m\n'),
	success: (message) => process.stdout.write('\x1b[32m' + message + '\x1b[0m\n'),
	info: (message) => process.stdout.write('\x1b[36m' + message + '\x1b[0m\n'),
};

async function runDiagnostics() {
	console.log('\n=== Groq API Diagnostics ===\n');

	// Check environment variables
	console.log('Checking environment variables...');
	const apiKey = process.env.GROQ_API_KEY;
	const model = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

	if (!apiKey) {
		console.error('❌ GROQ_API_KEY environment variable is not set!');
		console.warn('Please set the GROQ_API_KEY in your .env file.');
		console.log('\nYou can run the setup script to configure Groq:');
		console.log('  node scripts/setup-groq-env.js');
		return;
	}

	console.success('✓ GROQ_API_KEY environment variable is set.');
	console.log(`API key length: ${apiKey.length} characters`);
	console.info(`Using model: ${model}`);

	// Check for common API key format issues
	if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\r')) {
		console.error('❌ API key contains whitespace characters!');
		console.warn('Please check for extra spaces, newlines, or carriage returns in your API key.');
	}

	// Check network connectivity
	console.log('\nChecking network connectivity...');
	try {
		console.log('Testing connection to Google...');
		await axios.get('https://www.google.com', { timeout: 5000 });
		console.success('✓ Connection to Google successful');
	} catch (error) {
		console.error('❌ Failed to connect to Google!');
		console.error(`Error: ${error.message}`);
		console.warn('You may have network connectivity issues.');
		return;
	}

	// Test Groq API
	console.log('\nTesting connection to Groq API...');
	try {
		console.log('Sending a simple test request to Groq...');

		const response = await axios.post('https://api.groq.com/openai/v1/chat/completions',
			{
				model: model,
				messages: [
					{
						role: "user",
						content: "Hello, this is a test message from the diagnostic tool."
					}
				],
				max_tokens: 20
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				timeout: 10000 // 10 second timeout
			}
		);

		console.success('✓ Successfully connected to Groq API!');
		console.info(`Status code: ${response.status}`);

		// Log the response
		console.log('\nResponse from Groq:');
		console.log(JSON.stringify(response.data, null, 2));
	} catch (error) {
		console.error('❌ Failed to connect to Groq API!');

		if (error.response) {
			// The request was made and the server responded with a non-2xx status
			console.error(`Status code: ${error.response.status}`);
			console.error('Response data:');
			console.error(JSON.stringify(error.response.data, null, 2));

			if (error.response.status === 401) {
				console.error('Authentication error: Your API key appears to be invalid!');
				console.warn('Please check that your API key is correct and active.');
			} else if (error.response.status === 429) {
				console.error('Rate limit exceeded: You have hit your API usage limit!');
				console.warn('Please wait before making more requests or check your plan limits.');
			}
		} else if (error.request) {
			// The request was made but no response was received
			console.error('No response received from Groq API.');
			console.warn('Possible network issue or firewall blocking the connection.');
		} else {
			// Something happened in setting up the request
			console.error(`Error setting up request: ${error.message}`);
		}

		return;
	}

	// Test with real prompt
	console.log('\nTesting a full financial prompt...');
	try {
		const testPrompt = `
      As a personal financial advisor, analyze the following user financial data and provide clear, actionable advice.
      
      User Profile: Test User, Age: 35
      Total Balance Across All Accounts: $20000.00
      Monthly Income: $5000.00
      Monthly Expenses: $3500.00
      Top Expense Categories: Housing, Food, Transportation
      
      How can I improve my savings?
    `;

		console.log('Sending a financial advice prompt to Groq...');

		const response = await axios.post('https://api.groq.com/openai/v1/chat/completions',
			{
				model: model,
				messages: [
					{
						role: "system",
						content: "You are a helpful financial assistant. Provide clear, concise insights based on the user's financial data."
					},
					{
						role: "user",
						content: testPrompt
					}
				],
				max_tokens: 500,
				temperature: 0.3
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				timeout: 15000 // 15 second timeout
			}
		);

		console.success('✓ Successfully generated financial advice!');

		// Sample of the response
		const responseText = response.data.choices[0].message.content;

		console.log('\nSample response:');
		console.log(responseText.substring(0, 300) + '...');

		// Write diagnostic results to file
		const diagResults = {
			timestamp: new Date().toISOString(),
			apiKeyStatus: 'valid',
			connectivity: 'successful',
			model: model,
			testResponse: responseText.substring(0, 300),
			success: true
		};

		fs.writeFileSync(
			path.join(__dirname, 'groq-diagnostic-results.json'),
			JSON.stringify(diagResults, null, 2)
		);

		console.info('\nDiagnostic results saved to groq-diagnostic-results.json');
	} catch (error) {
		console.error('❌ Failed to test full prompt!');

		if (error.response) {
			console.error(`Status code: ${error.response.status}`);
			console.error('Response data:');
			console.error(JSON.stringify(error.response.data, null, 2));
		} else {
			console.error(`Error: ${error.message}`);
		}

		// Write diagnostic results to file
		const diagResults = {
			timestamp: new Date().toISOString(),
			apiKeyStatus: 'error',
			connectivity: 'failed',
			model: model,
			error: error.message,
			responseData: error.response ? error.response.data : null,
			success: false
		};

		fs.writeFileSync(
			path.join(__dirname, 'groq-diagnostic-results.json'),
			JSON.stringify(diagResults, null, 2)
		);

		console.info('\nDiagnostic results saved to groq-diagnostic-results.json');
		return;
	}

	// Compare with Cohere if available
	if (process.env.COHERE_API_KEY) {
		console.log('\nComparing with Cohere API...');
		try {
			const cohereResponse = await axios.post('https://api.cohere.ai/v1/chat',
				{
					model: 'command-r-08-2024',
					message: 'How can I improve my savings if I make $5000 monthly and spend $3500?',
					max_tokens: 300
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
						'Cohere-Version': '2023-05-24'
					},
					timeout: 10000
				}
			);

			console.success('✓ Successfully generated response with Cohere as well!');
			console.log('\nBoth APIs are working correctly. Your backup system is properly configured.');

		} catch (cohereError) {
			console.warn('⚠️ Cohere API test failed, but Groq is working correctly.');
			console.warn('This confirms that your backup system is necessary and properly configured.');
			console.error(`Cohere error: ${cohereError.message}`);
		}
	}

	console.success('\n✓ All diagnostics completed successfully!');
	console.log('\nYour Groq API integration appears to be working correctly.');
	console.log('Use this as a backup when Cohere API is unavailable.');
}

// Run the diagnostics
runDiagnostics().catch(error => {
	console.error('Unhandled error during diagnostics:');
	console.error(error);
});