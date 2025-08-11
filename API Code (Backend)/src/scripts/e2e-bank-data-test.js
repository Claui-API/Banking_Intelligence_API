// src/scripts/e2e-bank-data-test.js
const insertTestBankData = require('./insert-test-bank-data');
const verifyBankData = require('./verify-bank-data');
const testBankInsights = require('./test-bank-insights');
const logger = require('../utils/logger');

async function runE2ETest() {
	try {
		logger.info('Starting end-to-end bank data test...');

		// Step 1: Insert test data
		logger.info('\n==== STEP 1: INSERT TEST DATA ====');
		const insertResult = await insertTestBankData();
		const { clientId, bankUserId } = insertResult;

		// Step 2: Verify data in database
		logger.info('\n==== STEP 2: VERIFY DATA IN DATABASE ====');
		await verifyBankData(clientId, bankUserId);

		// Step 3: Test insights generation
		logger.info('\n==== STEP 3: TEST INSIGHTS GENERATION ====');
		await testBankInsights(clientId, bankUserId);

		logger.info('\n==== END-TO-END TEST COMPLETED SUCCESSFULLY ====');
		return {
			clientId,
			bankUserId,
			success: true
		};
	} catch (error) {
		logger.error('End-to-end test failed:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	runE2ETest()
		.then(result => {
			logger.info('End-to-end test completed successfully', result);
			process.exit(0);
		})
		.catch(error => {
			logger.error('End-to-end test failed:', error);
			process.exit(1);
		});
}

module.exports = runE2ETest;