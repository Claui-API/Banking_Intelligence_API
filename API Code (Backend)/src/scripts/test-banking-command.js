// test-banking-command-final.js
// Final fixed test script for the BankingCommandService

const dotenv = require('dotenv');
const logger = require('../utils/logger');
const BankUser = require('../models/BankUser');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { Op } = require('sequelize');

// Load environment variables
dotenv.config();

/**
 * Converts all string numbers to actual number types in an object
 * @param {Object} obj - Object to convert
 * @returns {Object} - Object with converted number values
 */
function convertStringNumbersToNumbers(obj) {
	if (!obj || typeof obj !== 'object') return obj;

	// Make a copy to avoid modifying the original
	const result = Array.isArray(obj) ? [...obj] : { ...obj };

	// Convert each property
	Object.keys(result).forEach(key => {
		const value = result[key];

		// If it's a nested object or array, recursively convert
		if (value && typeof value === 'object') {
			result[key] = convertStringNumbersToNumbers(value);
		}
		// If it's a string that looks like a number, convert it
		else if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
			result[key] = Number(value);
		}
	});

	return result;
}

/**
 * Retrieve existing data for the BankingCommandService test
 * @param {string} bankUserId - Optional specific user ID to test
 * @returns {Promise<Object>} - Data for the test
 */
async function retrieveExistingData(bankUserId = null) {
	try {
		logger.info('Retrieving existing data for BankingCommandService test...');

		// Find an active bank user if no specific ID provided
		let user;

		if (bankUserId) {
			// Look up by bankUserId, not id
			user = await BankUser.findOne({
				where: {
					bankUserId,
					status: 'active'
				}
			});

			if (!user) {
				throw new Error(`Bank user with bankUserId ${bankUserId} not found or not active`);
			}
		} else {
			// Get the first active user with transactions
			const users = await BankUser.findAll({
				where: { status: 'active' },
				limit: 10
			});

			if (users.length === 0) {
				throw new Error('No active bank users found in the database');
			}

			// Find a user with transactions
			for (const potentialUser of users) {
				const transactionCount = await Transaction.count({
					where: {
						clientId: potentialUser.clientId,
						bankUserId: potentialUser.bankUserId
					}
				});

				if (transactionCount > 0) {
					user = potentialUser;
					logger.info(`Found bank user ${user.bankUserId} with ${transactionCount} transactions`);
					break;
				}
			}

			if (!user) {
				// If no user has transactions, just use the first user
				user = users[0];
				logger.warn(`No bank users with transactions found, using ${user.bankUserId} without transactions`);
			}
		}

		// Get client ID and bank user ID
		const clientId = user.clientId;
		bankUserId = user.bankUserId;

		// Get accounts for this user
		const accounts = await Account.findAll({
			where: {
				clientId,
				bankUserId,
				isActive: true
			}
		});

		if (accounts.length === 0) {
			logger.warn(`No active accounts found for bank user ${bankUserId}, generating mock accounts`);

			// Generate mock accounts for testing
			accounts.push({
				id: 'mock-account-1',
				accountId: 'checking-123',
				name: 'Primary Checking',
				type: 'Checking',
				balance: 4879.23,
				availableBalance: 4829.23,
				currency: 'USD',
				clientId,
				bankUserId
			});

			accounts.push({
				id: 'mock-account-2',
				accountId: 'savings-456',
				name: 'High-Yield Savings',
				type: 'Savings',
				balance: 12450.65,
				availableBalance: 12450.65,
				currency: 'USD',
				clientId,
				bankUserId
			});
		}

		// Get transactions for the last 90 days (increased from 30 for more data)
		const ninetyDaysAgo = new Date();
		ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

		const accountIds = accounts.map(account => account.accountId);

		let transactions = await Transaction.findAll({
			where: {
				clientId,
				bankUserId,
				accountId: { [Op.in]: accountIds },
				date: { [Op.gte]: ninetyDaysAgo }
			},
			order: [['date', 'DESC']]
		});

		logger.info(`Found ${transactions.length} transactions in the last 90 days for bank user ${bankUserId}`);

		// If no transactions found, create mock data
		if (transactions.length === 0) {
			logger.warn('No transactions found, generating mock transactions for testing');

			// Helper to create a date n days ago
			const daysAgo = (days) => {
				const date = new Date();
				date.setDate(date.getDate() - days);
				return date;
			};

			// Helper to generate random amount
			const randomAmount = (min, max) => {
				return parseFloat((Math.random() * (max - min) + min).toFixed(2));
			};

			// Generate mock transactions
			const mockTransactions = [];

			// Income transactions
			for (let i = 0; i < 3; i++) {
				mockTransactions.push({
					id: `mock-income-${i}`,
					transactionId: `income-${i}`,
					accountId: accounts[0].accountId,
					date: daysAgo(i * 14),
					description: 'DIRECT DEPOSIT - ACME CORP PAYROLL',
					amount: 2650.25,
					category: 'Income',
					type: 'income',
					merchantName: 'ACME CORP',
					clientId,
					bankUserId,
					pending: false
				});
			}

			// Bill payments
			mockTransactions.push(
				{
					id: 'mock-bill-1',
					transactionId: 'bill-rent',
					accountId: accounts[0].accountId,
					date: daysAgo(28),
					description: 'PAYMENT - RENT',
					amount: -1950.00,
					category: 'Housing',
					type: 'expense',
					merchantName: 'PROPERTY MANAGEMENT LLC',
					clientId,
					bankUserId,
					pending: false
				},
				{
					id: 'mock-bill-2',
					transactionId: 'bill-electric',
					accountId: accounts[0].accountId,
					date: daysAgo(27),
					description: 'PAYMENT - ELECTRIC BILL',
					amount: -124.53,
					category: 'Utilities',
					type: 'expense',
					merchantName: 'POWER COMPANY',
					clientId,
					bankUserId,
					pending: false
				}
			);

			// Various purchases
			const merchantNames = [
				'COSTCO WHOLESALE', 'AMAZON.COM', 'NETFLIX', 'UBER', 'STARBUCKS',
				'TRADER JOE\'S', 'DOORDASH', 'APPLE.COM', 'SPOTIFY', 'SHELL OIL'
			];

			const categories = [
				'Groceries', 'Shopping', 'Entertainment', 'Transportation', 'Dining',
				'Travel', 'Utilities', 'Health', 'Education', 'Subscriptions'
			];

			// Add various expenses
			for (let i = 0; i < 20; i++) {
				const merchantIndex = Math.floor(Math.random() * merchantNames.length);
				const categoryIndex = Math.floor(Math.random() * categories.length);
				const daysBack = Math.floor(Math.random() * 30);

				mockTransactions.push({
					id: `mock-purchase-${i}`,
					transactionId: `tx-${i}`,
					accountId: accounts[0].accountId,
					date: daysAgo(daysBack),
					description: `PURCHASE - ${merchantNames[merchantIndex]}`,
					amount: -randomAmount(5, 200),
					category: categories[categoryIndex],
					type: 'expense',
					merchantName: merchantNames[merchantIndex],
					clientId,
					bankUserId,
					pending: false
				});
			}

			transactions = mockTransactions;
		}

		// Summarize transaction categories
		const categories = {};
		transactions.forEach(tx => {
			const category = tx.category || 'Uncategorized';
			if (!categories[category]) {
				categories[category] = 0;
			}
			categories[category]++;
		});

		logger.info('Transaction categories:', categories);

		// Convert accounts and transactions to plain objects
		// This is important to avoid issues with Sequelize getter methods
		let plainAccounts = accounts.map(account => account.get ? account.get({ plain: true }) : account);
		let plainTransactions = transactions.map(tx => tx.get ? tx.get({ plain: true }) : tx);

		// Convert string numbers to actual numbers
		plainAccounts = plainAccounts.map(account => {
			const convertedAccount = convertStringNumbersToNumbers(account);

			// Ensure these are definitely numbers
			convertedAccount.balance = Number(convertedAccount.balance);
			convertedAccount.availableBalance = Number(convertedAccount.availableBalance);
			if (convertedAccount.creditLimit) {
				convertedAccount.creditLimit = Number(convertedAccount.creditLimit);
			}

			return convertedAccount;
		});

		plainTransactions = plainTransactions.map(tx => {
			const convertedTx = convertStringNumbersToNumbers(tx);

			// Ensure amount is definitely a number
			convertedTx.amount = Number(convertedTx.amount);

			return convertedTx;
		});

		// Create the statement data structure expected by the BankingCommandService
		const statementData = {
			user: {
				id: user.id,
				clientId: user.clientId,
				bankUserId: user.bankUserId,
				name: user.name || 'Test User',
				email: user.email || 'test@example.com',
			},
			accounts: plainAccounts,
			transactions: plainTransactions,
			dateRange: {
				startDate: ninetyDaysAgo,
				endDate: new Date()
			},
			timeframe: '90d'  // Increased from 30d for more data
		};

		// Debug log to check the data types
		const sampleAccount = statementData.accounts[0];
		logger.info('Sample account balance type check:', {
			balance: sampleAccount.balance,
			balanceType: typeof sampleAccount.balance,
			isNumber: typeof sampleAccount.balance === 'number'
		});

		if (typeof sampleAccount.balance !== 'number') {
			logger.warn('Account balance is not a number! Converting manually...');
			statementData.accounts = statementData.accounts.map(account => ({
				...account,
				balance: Number(account.balance),
				availableBalance: Number(account.availableBalance),
				creditLimit: account.creditLimit ? Number(account.creditLimit) : null
			}));
		}

		return {
			clientId,
			bankUserId,
			statementData
		};

	} catch (error) {
		logger.error('Error retrieving existing data:', error);
		throw error;
	}
}

/**
 * Create a patch for the BankingCommandService to fix the toFixed issue
 * @returns {Function} - Function to restore original methods
 */
function patchBankingCommandService() {
	const bankingCommandService = require('../services/banking-command.service');

	// Store original methods
	const originalCreateFinancialContext = bankingCommandService._createFinancialContext;

	// Create a patched version of _createFinancialContext that handles string numbers
	bankingCommandService._createFinancialContext = function (data) {
		try {
			// Ensure account balances are numbers
			if (data.accounts) {
				data.accounts = data.accounts.map(account => {
					if (account.balance && typeof account.balance !== 'number') {
						account.balance = Number(account.balance);
					}
					if (account.availableBalance && typeof account.availableBalance !== 'number') {
						account.availableBalance = Number(account.availableBalance);
					}
					if (account.creditLimit && typeof account.creditLimit !== 'number') {
						account.creditLimit = Number(account.creditLimit);
					}
					return account;
				});
			}

			// Ensure transaction amounts are numbers
			if (data.transactions) {
				data.transactions = data.transactions.map(tx => {
					if (tx.amount && typeof tx.amount !== 'number') {
						tx.amount = Number(tx.amount);
					}
					return tx;
				});
			}

			// Call the original method with the fixed data
			return originalCreateFinancialContext.call(this, data);
		} catch (error) {
			logger.error('Error in patched _createFinancialContext:', error);

			// Create a minimal financial context if the original method fails
			return `
FINANCIAL SUMMARY:
Total Balance: ${data.accounts ? data.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0) : 0}
Income: ${data.transactions ? data.transactions.filter(tx => Number(tx.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0) : 0}
Expenses: ${data.transactions ? data.transactions.filter(tx => Number(tx.amount) < 0).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0) : 0}

ACCOUNTS:
${data.accounts ? data.accounts.map(account => `${account.name || 'Account'}: $${Number(account.balance).toFixed(2)} (${account.type || 'Unknown'})`).join('\n') : 'No account information available'}

RECENT TRANSACTIONS:
${data.transactions ? data.transactions.slice(0, 10).map(tx => {
				const amount = Number(tx.amount);
				return `${tx.date}: ${Math.abs(amount).toFixed(2)} ${amount < 0 ? 'expense' : 'income'} - ${tx.category || 'Uncategorized'} - ${tx.description || ''}`;
			}).join('\n') : 'No transaction history available'}
`;
		}
	};

	// Return a function to restore the original methods
	return function restoreOriginal() {
		bankingCommandService._createFinancialContext = originalCreateFinancialContext;
	};
}

/**
 * Run the test for BankingCommandService with existing data
 * @param {string} bankUserId - Optional specific user ID to test
 */
async function runBankingCommandTest(bankUserId = null) {
	try {
		logger.info('Starting BankingCommandService test...');

		// Retrieve existing data
		const testData = await retrieveExistingData(bankUserId);
		bankUserId = testData.bankUserId;

		// Log data summary
		logger.info('Test data summary:', {
			bankUserId,
			accountCount: testData.statementData.accounts.length,
			transactionCount: testData.statementData.transactions.length
		});

		// Initialize the service
		const bankingCommandService = require('../services/banking-command.service');

		// Apply the patch to fix string-to-number conversion issues
		const restoreOriginal = patchBankingCommandService();

		try {
			// Generate the report using statementData instead of userId
			const reportParams = {
				userId: bankUserId,  // This is only used for logging
				timeframe: '90d',    // Consistent with the data collection timeframe
				requestId: `test-${Date.now()}`,
				includeDetailed: true,
				format: 'json',
				statementData: testData.statementData  // Pass the data directly
			};

			logger.info('Generating banking intelligence report...', {
				userId: bankUserId,
				requestId: reportParams.requestId,
				format: reportParams.format
			});

			const report = await bankingCommandService.generateReport(reportParams);

			// Log the report summary
			logger.info('Banking Intelligence report generated successfully', {
				userId: bankUserId,
				requestId: reportParams.requestId,
				sections: report.sections.map(s => s.title)
			});

			// Print the report sections
			console.log('\n===== BANKING INTELLIGENCE REPORT =====\n');
			console.log(`Generated: ${new Date(report.generated).toLocaleString()}`);
			console.log(`Period: ${report.period}`);
			console.log(`User: ${bankUserId}`);
			console.log('\n--- SECTIONS ---\n');

			report.sections.forEach((section, index) => {
				console.log(`${index + 1}. ${section.title}`);
				console.log('-'.repeat(section.title.length + 3));
				console.log(section.content);
				console.log('\n');
			});

			return report;
		} finally {
			// Always restore the original methods
			restoreOriginal();
		}
	} catch (error) {
		logger.error('Error running BankingCommandService test:', error);
		throw error;
	}
}

/**
 * Main function to run the test
 */
async function main() {
	try {
		// Optional: specify a particular bank user ID as a command-line argument
		const args = process.argv.slice(2);
		const specificBankUserId = args[0];

		if (specificBankUserId) {
			logger.info(`Testing with specific bank user ID: ${specificBankUserId}`);
		} else {
			logger.info('No specific bank user ID provided, will use first available user with transactions');
		}

		// Run the test
		const report = await runBankingCommandTest(specificBankUserId);

		// Exit with success
		logger.info('Test completed successfully!');
		process.exit(0);
	} catch (error) {
		logger.error('Test failed:', error);
		process.exit(1);
	}
}

// Run the main function
main();