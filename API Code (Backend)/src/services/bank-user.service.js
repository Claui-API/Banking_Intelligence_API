// src/services/bank-user.service.js
const logger = require('../utils/logger');
const BankUser = require('../models/BankUser');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

class BankUserService {
	/**
	 * Create or update a bank user
	 * @param {string} clientId - Client ID (bank)
	 * @param {Object} userData - Bank user data
	 * @returns {Object} - Created/updated bank user
	 */
	async createOrUpdateBankUser(clientId, userData) {
		const transaction = await sequelize.transaction();

		try {
			if (!clientId || !userData || !userData.bankUserId) {
				throw new Error('Client ID and bank user ID are required');
			}

			logger.info(`Creating/updating bank user ${userData.bankUserId} for client ${clientId}`);

			// Find or create the bank user
			const [bankUser, created] = await BankUser.findOrCreate({
				where: {
					clientId,
					bankUserId: userData.bankUserId
				},
				defaults: {
					name: userData.name,
					email: userData.email,
					status: userData.status || 'active',
					metadata: userData.metadata || {}
				},
				transaction
			});

			// If user already exists, update their details
			if (!created) {
				bankUser.name = userData.name || bankUser.name;
				bankUser.email = userData.email || bankUser.email;
				bankUser.status = userData.status || bankUser.status;

				// Merge metadata if provided
				if (userData.metadata) {
					bankUser.metadata = {
						...(bankUser.metadata || {}),
						...userData.metadata
					};
				}

				await bankUser.save({ transaction });
				logger.info(`Updated existing bank user ${userData.bankUserId} for client ${clientId}`);
			} else {
				logger.info(`Created new bank user ${userData.bankUserId} for client ${clientId}`);
			}

			await transaction.commit();
			return bankUser;
		} catch (error) {
			await transaction.rollback();
			logger.error(`Error creating/updating bank user: ${error.message}`, { clientId });
			throw error;
		}
	}

	/**
	 * Store accounts for a bank user
	 * @param {string} clientId - Client ID (bank)
	 * @param {string} bankUserId - Bank user ID
	 * @param {Array} accountsData - Array of account objects
	 * @returns {Array} - Stored accounts
	 */
	async storeAccounts(clientId, bankUserId, accountsData) {
		try {
			if (!clientId || !bankUserId || !Array.isArray(accountsData)) {
				throw new Error('Client ID, bank user ID, and accounts array are required');
			}

			logger.info(`Storing ${accountsData.length} accounts for bank user ${bankUserId} (client: ${clientId})`);

			const storedAccounts = [];

			// Process each account
			for (const accountData of accountsData) {
				// Validate required fields
				if (!accountData.accountId) {
					logger.warn('Account missing required accountId, skipping', accountData);
					continue;
				}

				// Find or create the account
				const [account, created] = await Account.findOrCreate({
					where: {
						clientId,
						bankUserId,
						accountId: accountData.accountId
					},
					defaults: {
						name: accountData.name || 'Account',
						type: accountData.type || 'Other',
						subtype: accountData.subtype,
						balance: accountData.balance || 0,
						availableBalance: accountData.availableBalance,
						currency: accountData.currency || 'USD',
						creditLimit: accountData.creditLimit,
						metadata: accountData.metadata || {},
						lastUpdated: new Date()
					}
				});

				// If account already exists, update it
				if (!created) {
					account.name = accountData.name || account.name;
					account.type = accountData.type || account.type;
					account.subtype = accountData.subtype || account.subtype;
					account.balance = accountData.balance !== undefined ? accountData.balance : account.balance;
					account.availableBalance = accountData.availableBalance || account.availableBalance;
					account.currency = accountData.currency || account.currency;
					account.creditLimit = accountData.creditLimit !== undefined ? accountData.creditLimit : account.creditLimit;

					// Merge metadata if provided
					if (accountData.metadata) {
						account.metadata = {
							...(account.metadata || {}),
							...accountData.metadata
						};
					}

					account.lastUpdated = new Date();
					await account.save();
				}

				storedAccounts.push(account);
			}

			logger.info(`Successfully stored ${storedAccounts.length} accounts for bank user ${bankUserId}`);
			return storedAccounts;
		} catch (error) {
			logger.error(`Error storing accounts: ${error.message}`, { clientId, bankUserId });
			throw error;
		}
	}

	/**
	 * Store transactions for a bank user
	 * @param {string} clientId - Client ID (bank)
	 * @param {string} bankUserId - Bank user ID
	 * @param {Array} transactionsData - Array of transaction objects
	 * @returns {Array} - Stored transactions
	 */
	async storeTransactions(clientId, bankUserId, transactionsData) {
		try {
			if (!clientId || !bankUserId || !Array.isArray(transactionsData)) {
				throw new Error('Client ID, bank user ID, and transactions array are required');
			}

			logger.info(`Storing ${transactionsData.length} transactions for bank user ${bankUserId} (client: ${clientId})`);

			const storedTransactions = [];

			// Process each transaction
			for (const txData of transactionsData) {
				// Validate required fields
				if (!txData.transactionId || !txData.accountId) {
					logger.warn('Transaction missing required fields, skipping', txData);
					continue;
				}

				// Find or create the transaction
				const [transaction, created] = await Transaction.findOrCreate({
					where: {
						clientId,
						bankUserId,
						transactionId: txData.transactionId
					},
					defaults: {
						accountId: txData.accountId,
						date: txData.date || new Date(),
						description: txData.description || 'Unknown Transaction',
						amount: txData.amount || 0,
						category: txData.category,
						type: txData.type || (txData.amount >= 0 ? 'income' : 'expense'),
						pending: txData.pending || false,
						merchantName: txData.merchantName,
						metadata: txData.metadata || {}
					}
				});

				// If transaction exists but might have been updated
				if (!created && txData.pending === false) {
					transaction.accountId = txData.accountId || transaction.accountId;
					transaction.date = txData.date || transaction.date;
					transaction.description = txData.description || transaction.description;
					transaction.amount = txData.amount !== undefined ? txData.amount : transaction.amount;
					transaction.category = txData.category || transaction.category;
					transaction.type = txData.type || transaction.type;
					transaction.pending = false;
					transaction.merchantName = txData.merchantName || transaction.merchantName;

					// Merge metadata if provided
					if (txData.metadata) {
						transaction.metadata = {
							...(transaction.metadata || {}),
							...txData.metadata
						};
					}

					await transaction.save();
				}

				storedTransactions.push(transaction);
			}

			logger.info(`Successfully stored ${storedTransactions.length} transactions for bank user ${bankUserId}`);
			return storedTransactions;
		} catch (error) {
			logger.error(`Error storing transactions: ${error.message}`, { clientId, bankUserId });
			throw error;
		}
	}

	/**
	 * Get financial data for a bank user
	 * @param {string} clientId - Client ID (bank)
	 * @param {string} bankUserId - Bank user ID
	 * @param {Object} options - Query options
	 * @returns {Object} - Bank user financial data
	 */
	async getBankUserFinancialData(clientId, bankUserId, options = {}) {
		try {
			if (!clientId || !bankUserId) {
				throw new Error('Client ID and bank user ID are required');
			}

			logger.info(`Getting financial data for bank user ${bankUserId} (client: ${clientId})`);

			// Get bank user info
			const bankUser = await BankUser.findOne({
				where: {
					clientId,
					bankUserId,
					status: 'active'
				}
			});

			if (!bankUser) {
				throw new Error(`Bank user ${bankUserId} not found for client ${clientId}`);
			}

			// Get accounts
			const accounts = await Account.findAll({
				where: {
					clientId,
					bankUserId,
					isActive: true
				},
				order: [['type', 'ASC'], ['name', 'ASC']]
			});

			// Set transaction query options
			const transactionOptions = {
				where: {
					clientId,
					bankUserId
				},
				order: [['date', 'DESC']]
			};

			// Add date filter if provided
			if (options.startDate) {
				transactionOptions.where.date = {
					...(transactionOptions.where.date || {}),
					[Op.gte]: options.startDate
				};
			}

			if (options.endDate) {
				transactionOptions.where.date = {
					...(transactionOptions.where.date || {}),
					[Op.lte]: options.endDate
				};
			}

			// Add limit if provided
			if (options.limit) {
				transactionOptions.limit = options.limit;
			}

			// Get transactions
			const transactions = await Transaction.findAll(transactionOptions);

			logger.info(`Retrieved ${accounts.length} accounts and ${transactions.length} transactions for bank user ${bankUserId}`);

			return {
				clientId,
				bankUserId,
				userProfile: {
					name: bankUser.name,
					email: bankUser.email,
					metadata: bankUser.metadata
				},
				accounts,
				transactions,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			logger.error(`Error getting bank user financial data: ${error.message}`, { clientId, bankUserId });
			throw error;
		}
	}
}

module.exports = new BankUserService();