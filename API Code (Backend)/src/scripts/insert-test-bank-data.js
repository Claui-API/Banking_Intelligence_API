// src/scripts/insert-test-bank-data.js - Updated to include transactions
const { sequelize } = require('../config/database');
const bankUserService = require('../services/bank-user.service');
const logger = require('../utils/logger');

async function insertTestBankData() {
	try {
		logger.info('Starting test data insertion...');

		// First, look up an existing client ID from the database
		const [clientResults] = await sequelize.query(`
      SELECT "clientId" FROM "Clients" LIMIT 1
    `);

		if (clientResults.length === 0) {
			throw new Error('No clients found in the database. Please create a client first.');
		}

		// Use the first client ID found
		const clientId = clientResults[0].clientId;
		logger.info(`Using existing client ID: ${clientId}`);

		// 1. Create a test bank user
		const bankUserData = {
			bankUserId: 'test-customer-001',
			name: 'Test Customer',
			email: 'test@example.com',
			status: 'active',
			metadata: {
				testData: true,
				createdBy: 'test-script'
			}
		};

		const bankUser = await bankUserService.createOrUpdateBankUser(
			clientId,
			bankUserData
		);

		logger.info(`Created/updated bank user: ${bankUser.bankUserId}`);

		// 2. Create test accounts
		const accountsData = [
			{
				accountId: 'test-checking-001',
				name: 'Test Checking Account',
				type: 'Checking',
				balance: 2500.75,
				availableBalance: 2450.25,
				currency: 'USD'
			},
			{
				accountId: 'test-savings-001',
				name: 'Test Savings Account',
				type: 'Savings',
				balance: 15000.50,
				availableBalance: 15000.50,
				currency: 'USD'
			},
			{
				accountId: 'test-credit-001',
				name: 'Test Credit Card',
				type: 'Credit Card',
				balance: -1200.75,
				availableBalance: 3799.25,
				creditLimit: 5000,
				currency: 'USD'
			}
		];

		const accounts = await bankUserService.storeAccounts(
			clientId,
			bankUser.bankUserId,
			accountsData
		);

		logger.info(`Created/updated ${accounts.length} accounts`);

		// 3. Create test transactions
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const lastWeek = new Date(today);
		lastWeek.setDate(lastWeek.getDate() - 7);

		const transactionsData = [
			{
				transactionId: 'test-txn-001',
				accountId: 'test-checking-001',
				date: today.toISOString(),
				description: 'Grocery Store',
				amount: -76.43,
				category: 'Food & Dining',
				type: 'expense',
				merchantName: 'Whole Foods'
			},
			{
				transactionId: 'test-txn-002',
				accountId: 'test-checking-001',
				date: yesterday.toISOString(),
				description: 'Monthly Salary',
				amount: 3000.00,
				category: 'Income',
				type: 'income',
				merchantName: 'Employer Inc.'
			},
			{
				transactionId: 'test-txn-003',
				accountId: 'test-credit-001',
				date: yesterday.toISOString(),
				description: 'Restaurant Dinner',
				amount: -125.30,
				category: 'Food & Dining',
				type: 'expense',
				merchantName: 'Fine Dining Restaurant'
			},
			{
				transactionId: 'test-txn-004',
				accountId: 'test-savings-001',
				date: lastWeek.toISOString(),
				description: 'Transfer from Checking',
				amount: 500.00,
				category: 'Transfer',
				type: 'income'
			},
			{
				transactionId: 'test-txn-005',
				accountId: 'test-checking-001',
				date: lastWeek.toISOString(),
				description: 'Transfer to Savings',
				amount: -500.00,
				category: 'Transfer',
				type: 'expense'
			}
		];

		const transactions = await bankUserService.storeTransactions(
			clientId,
			bankUser.bankUserId,
			transactionsData
		);

		logger.info(`Created/updated ${transactions.length} transactions`);

		logger.info('Test data insertion completed successfully');
		return {
			clientId,
			bankUserId: bankUser.bankUserId,
			accountsCount: accounts.length,
			transactionsCount: transactions.length
		};
	} catch (error) {
		logger.error('Error inserting test data:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	insertTestBankData()
		.then(result => {
			logger.info('Test data insertion completed', result);
			process.exit(0);
		})
		.catch(error => {
			logger.error('Test data insertion failed:', error);
			process.exit(1);
		});
}

module.exports = insertTestBankData;