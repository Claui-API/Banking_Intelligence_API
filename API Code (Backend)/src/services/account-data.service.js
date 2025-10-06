const { Account } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AccountDataService {
	/**
	 * Create or update an account with proper balance normalization
	 * @param {Object} accountData - Raw account data from external source
	 * @param {string} clientId - Client ID
	 * @param {string} bankUserId - Bank user ID
	 * @returns {Object} - { account, created }
	 */
	static async createOrUpdateAccount(accountData, clientId, bankUserId) {
		// Clean and validate data before database operations
		const cleanedData = this.normalizeAccountData(accountData, clientId, bankUserId);

		try {
			const [account, created] = await Account.findOrCreate({
				where: {
					clientId,
					bankUserId,
					accountId: cleanedData.accountId
				},
				defaults: cleanedData
			});

			if (!created) {
				// Update existing account with cleaned data
				await account.update(cleanedData);
				logger.debug(`Updated account ${cleanedData.accountId} for user ${bankUserId}`);
			} else {
				logger.debug(`Created account ${cleanedData.accountId} for user ${bankUserId}`);
			}

			return { account, created };
		} catch (error) {
			logger.error('Error creating/updating account:', {
				error: error.message,
				accountId: cleanedData.accountId,
				bankUserId,
				clientId
			});
			throw error;
		}
	}

	/**
	 * Normalize account data with comprehensive balance handling
	 * @param {Object} rawData - Raw account data
	 * @param {string} clientId - Client ID
	 * @param {string} bankUserId - Bank user ID
	 * @returns {Object} - Normalized account data
	 */
	static normalizeAccountData(rawData, clientId, bankUserId) {
		const normalized = {
			clientId,
			bankUserId,
			accountId: rawData.accountId || rawData.account_id,
			name: rawData.name || rawData.official_name || 'Unknown Account',
			type: rawData.type || rawData.account_type || 'unknown',
			subtype: rawData.subtype || rawData.account_subtype,
			currency: rawData.currency || 'USD',
			creditLimit: rawData.creditLimit || rawData.credit_limit,
			isActive: rawData.isActive !== false,
			metadata: rawData.metadata || {}
		};

		// Handle balance normalization with quality tracking
		let balance = rawData.balance;
		let availableBalance = rawData.availableBalance || rawData.available_balance;
		let qualityFlags = [];

		// Log what we received for debugging
		logger.debug('Normalizing account balance data:', {
			accountId: normalized.accountId,
			originalBalance: balance,
			originalAvailableBalance: availableBalance,
			balanceType: typeof balance,
			availableType: typeof availableBalance
		});

		// Apply normalization logic
		if (balance === null || balance === undefined || isNaN(balance)) {
			if (availableBalance !== null && availableBalance !== undefined && !isNaN(availableBalance)) {
				balance = Number(availableBalance);
				qualityFlags.push('balance_inferred_from_available');
				logger.info(`Inferred balance from availableBalance for account ${normalized.accountId}`);
			} else {
				balance = 0;
				qualityFlags.push('balance_defaulted_to_zero');
				logger.warn(`Defaulted balance to zero for account ${normalized.accountId}`);
			}
		}

		if (availableBalance === null || availableBalance === undefined || isNaN(availableBalance)) {
			if (balance !== null && balance !== undefined && !isNaN(balance)) {
				availableBalance = Number(balance);
				qualityFlags.push('available_inferred_from_balance');
				logger.info(`Inferred availableBalance from balance for account ${normalized.accountId}`);
			} else {
				availableBalance = 0;
				qualityFlags.push('available_defaulted_to_zero');
				logger.warn(`Defaulted availableBalance to zero for account ${normalized.accountId}`);
			}
		}

		normalized.balance = Number(balance);
		normalized.availableBalance = Number(availableBalance);

		// Track data quality issues
		if (qualityFlags.length > 0) {
			normalized.dataQualityFlags = {
				balanceNormalization: qualityFlags,
				normalizedAt: new Date().toISOString(),
				sourceData: {
					originalBalance: rawData.balance,
					originalAvailable: rawData.availableBalance || rawData.available_balance
				}
			};

			logger.info(`Applied ${qualityFlags.length} balance normalizations for account ${normalized.accountId}`, {
				flags: qualityFlags
			});
		}

		return normalized;
	}

	/**
	 * Get data quality report with client filtering
	 * @param {string} clientId - Optional client ID to filter results
	 * @returns {Object} - Data quality report
	 */
	static async getDataQualityReport(clientId = null) {
		const whereClause = {
			dataQualityFlags: {
				[Op.ne]: null
			}
		};

		// Add client filter if provided
		if (clientId) {
			whereClause.clientId = clientId;
		}

		const accountsWithFlags = await Account.findAll({
			where: whereClause,
			attributes: ['id', 'accountId', 'clientId', 'bankUserId', 'dataQualityFlags', 'createdAt']
		});

		const flagCounts = {};
		const clientCounts = {};

		accountsWithFlags.forEach(account => {
			const flags = account.dataQualityFlags?.balanceNormalization || [];
			flags.forEach(flag => {
				flagCounts[flag] = (flagCounts[flag] || 0) + 1;
			});

			// Track by client
			const client = account.clientId;
			if (!clientCounts[client]) {
				clientCounts[client] = 0;
			}
			clientCounts[client]++;
		});

		return {
			totalAccountsWithFlags: accountsWithFlags.length,
			flagBreakdown: flagCounts,
			clientBreakdown: clientCounts,
			accounts: accountsWithFlags.map(account => ({
				id: account.id,
				accountId: account.accountId,
				clientId: account.clientId,
				bankUserId: account.bankUserId,
				flags: account.dataQualityFlags?.balanceNormalization || [],
				normalizedAt: account.dataQualityFlags?.normalizedAt,
				createdAt: account.createdAt
			}))
		};
	}

	/**
	 * Get accounts with data quality issues for a specific client
	 * @param {string} clientId - Client ID
	 * @returns {Array} - Accounts with quality flags
	 */
	static async getClientDataQualityIssues(clientId) {
		const accounts = await Account.findAll({
			where: {
				clientId,
				dataQualityFlags: {
					[Op.ne]: null
				}
			},
			attributes: ['accountId', 'bankUserId', 'dataQualityFlags', 'balance', 'availableBalance', 'createdAt']
		});

		return accounts.map(account => ({
			accountId: account.accountId,
			bankUserId: account.bankUserId,
			issues: account.dataQualityFlags?.balanceNormalization || [],
			currentBalance: account.balance,
			currentAvailableBalance: account.availableBalance,
			normalizedAt: account.dataQualityFlags?.normalizedAt,
			originalData: account.dataQualityFlags?.sourceData,
			createdAt: account.createdAt
		}));
	}
}

module.exports = AccountDataService;