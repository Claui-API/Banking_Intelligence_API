// src/scripts/verify-bank-data.js
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function verifyBankData(clientId, bankUserId) {
	try {
		logger.info(`Verifying data for bank user ${bankUserId} of client ${clientId}...`);

		// Check BankUser record
		const [bankUserResults] = await sequelize.query(`
      SELECT * FROM "BankUsers" 
      WHERE "clientId" = '${clientId}' AND "bankUserId" = '${bankUserId}'
    `);

		if (bankUserResults.length === 0) {
			logger.error(`Bank user ${bankUserId} not found!`);
		} else {
			logger.info(`Bank user verified: ${bankUserId} (${bankUserResults[0].name})`);
		}

		// Check Account records
		const [accountResults] = await sequelize.query(`
      SELECT * FROM "Accounts" 
      WHERE "clientId" = '${clientId}' AND "bankUserId" = '${bankUserId}'
    `);

		if (accountResults.length === 0) {
			logger.error(`No accounts found for bank user ${bankUserId}!`);
		} else {
			logger.info(`Found ${accountResults.length} accounts for bank user ${bankUserId}`);
			accountResults.forEach(account => {
				logger.info(`- ${account.name} (${account.type}): ${account.balance} ${account.currency}`);
			});
		}

		// Check Transaction records
		const [transactionResults] = await sequelize.query(`
      SELECT * FROM "Transactions" 
      WHERE "clientId" = '${clientId}' AND "bankUserId" = '${bankUserId}'
      ORDER BY "date" DESC
    `);

		if (transactionResults.length === 0) {
			logger.error(`No transactions found for bank user ${bankUserId}!`);
		} else {
			logger.info(`Found ${transactionResults.length} transactions for bank user ${bankUserId}`);
			transactionResults.slice(0, 3).forEach(tx => {
				logger.info(`- ${new Date(tx.date).toLocaleDateString()}: ${tx.description} (${tx.amount} ${tx.category || 'uncategorized'})`);
			});

			if (transactionResults.length > 3) {
				logger.info(`... and ${transactionResults.length - 3} more transactions`);
			}
		}

		return {
			bankUser: bankUserResults[0] || null,
			accounts: accountResults,
			transactions: transactionResults
		};
	} catch (error) {
		logger.error('Error verifying bank data:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	// Get client ID and bank user ID from command line arguments
	const clientId = process.argv[2];
	const bankUserId = process.argv[3];

	if (!clientId || !bankUserId) {
		logger.error('Usage: node verify-bank-data.js <clientId> <bankUserId>');
		process.exit(1);
	}

	verifyBankData(clientId, bankUserId)
		.then(result => {
			logger.info('Data verification completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('Data verification failed:', error);
			process.exit(1);
		});
}

module.exports = verifyBankData;