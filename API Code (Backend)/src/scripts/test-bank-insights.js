// src/scripts/test-bank-insights.js
const insightsController = require('../controllers/insights.controller');
const bankUserService = require('../services/bank-user.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

async function testBankInsights(clientId, bankUserId) {
	try {
		logger.info(`Testing insights for bank user ${bankUserId} of client ${clientId}...`);

		// First, verify that we can get the financial data
		const financialData = await bankUserService.getBankUserFinancialData(clientId, bankUserId);

		logger.info(`Retrieved financial data for bank user ${bankUserId}:`);
		logger.info(`- Accounts: ${financialData.accounts.length}`);
		logger.info(`- Transactions: ${financialData.transactions.length}`);

		// Test insights generation with a sample query
		const testQueries = [
			"How am I spending my money?",
			"What are my largest expenses?",
			"How can I save more money?",
			"Am I spending too much on dining out?"
		];

		// Create a directory for storing responses if it doesn't exist
		const outputDir = path.join(__dirname, '../logs/insights-responses');
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Run each test query
		for (const query of testQueries) {
			logger.info(`\nGenerating insights for query: "${query}"`);

			// Prepare insight data
			const requestId = `test-insights-${Date.now()}`;
			const insightData = {
				query,
				requestId,
				...financialData
			};

			// Generate insights
			const startTime = Date.now();
			const insights = await insightsController.generateInsightsInternal(insightData);
			const duration = Date.now() - startTime;

			// Log the summary
			logger.info(`Insights generated in ${duration}ms:`);
			logger.info(`Query: "${query}"`);
			logger.info(`Response preview: "${insights.insight.substring(0, 200)}..."`);

			// Log the full response to console
			console.log('\n=== FULL RESPONSE ===');
			console.log(JSON.stringify(insights, null, 2));
			console.log('=== END FULL RESPONSE ===\n');

			// Save the full response to a file
			const timestamp = new Date().toISOString().replace(/:/g, '-');
			const filename = `${outputDir}/response-${requestId}-${timestamp}.json`;

			fs.writeFileSync(
				filename,
				JSON.stringify({
					query,
					requestId,
					duration,
					timestamp: new Date().toISOString(),
					response: insights,
					// Include relevant info about which model was used
					source: insights.source || 'unknown',
					provider: insights.llmProvider || 'unknown'
				}, null, 2)
			);

			logger.info(`Full response saved to ${filename}`);
		}

		logger.info('\nInsights testing completed successfully');
		return true;
	} catch (error) {
		logger.error('Error testing bank insights:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	// Get client ID and bank user ID from command line arguments
	const clientId = process.argv[2];
	const bankUserId = process.argv[3];

	if (!clientId || !bankUserId) {
		logger.error('Usage: node test-bank-insights-full.js <clientId> <bankUserId>');
		process.exit(1);
	}

	testBankInsights(clientId, bankUserId)
		.then(result => {
			logger.info('Insights testing completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('Insights testing failed:', error);
			process.exit(1);
		});
}

module.exports = testBankInsights;