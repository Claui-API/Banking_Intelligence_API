// src/services/bank-client.service.js
// Minor updates needed for Account normalization integration

const logger = require('../utils/logger');
const BankUser = require('../models/BankUser');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
// ADD THIS IMPORT for data quality monitoring
const AccountDataService = require('./account-data.service');

class BankClientService {
	/**
	 * Get dashboard statistics for a bank client
	 * @param {string} clientId - Client ID
	 * @returns {Object} - Dashboard statistics
	 */
	async getDashboardStats(clientId) {
		try {
			if (!clientId) {
				throw new Error('Client ID is required');
			}

			logger.info(`Fetching dashboard stats for client ${clientId}`);

			// Get user counts
			const totalUsers = await BankUser.count({
				where: { clientId }
			});

			const activeUsers = await sequelize.query(
				`SELECT COUNT(DISTINCT "bankUserId") as count 
         FROM "Transactions" 
         WHERE "clientId" = :clientId`,
				{
					replacements: { clientId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			// Get account stats
			const totalAccounts = await Account.count({
				where: { clientId }
			});

			// ADD: Get account balance health check
			const accountBalanceStats = await sequelize.query(
				`SELECT 
					COUNT(*) as total,
					COUNT(CASE WHEN balance = 0 AND "availableBalance" = 0 THEN 1 END) as zero_balance,
					COUNT(CASE WHEN "dataQualityFlags" IS NOT NULL THEN 1 END) as normalized_accounts,
					AVG(balance) as avg_balance,
					SUM(balance) as total_balance
				FROM "Accounts" 
				WHERE "clientId" = :clientId AND "isActive" = true`,
				{
					replacements: { clientId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			const accountTypes = await sequelize.query(
				`SELECT "type", COUNT(*) as count 
         FROM "Accounts" 
         WHERE "clientId" = :clientId 
         GROUP BY "type"`,
				{
					replacements: { clientId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			// Get transaction stats
			const totalTransactions = await Transaction.count({
				where: { clientId }
			});

			const pendingTransactions = await Transaction.count({
				where: {
					clientId,
					pending: true
				}
			});

			// Get recent transactions (last 30 days)
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const recentTransactions = await Transaction.count({
				where: {
					clientId,
					date: {
						[Op.gte]: thirtyDaysAgo
					}
				}
			});

			// Get transaction volume by month for last 6 months
			const sixMonthsAgo = new Date();
			sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

			const transactionVolume = await sequelize.query(
				`SELECT 
          TO_CHAR(DATE_TRUNC('month', "date"), 'YYYY-MM') as month,
          COUNT(*) as count,
          SUM(CASE WHEN "amount" >= 0 THEN "amount" ELSE 0 END) as income,
          SUM(CASE WHEN "amount" < 0 THEN ABS("amount") ELSE 0 END) as expense
        FROM "Transactions"
        WHERE "clientId" = :clientId AND "date" >= :sixMonthsAgo
        GROUP BY DATE_TRUNC('month', "date")
        ORDER BY month DESC`,
				{
					replacements: { clientId, sixMonthsAgo },
					type: sequelize.QueryTypes.SELECT
				}
			);

			// ENHANCED RETURN: Include account balance health info
			return {
				users: {
					total: totalUsers,
					active: activeUsers[0]?.count || 0
				},
				accounts: {
					total: totalAccounts,
					totalBalance: parseFloat(accountBalanceStats[0]?.total_balance || 0),
					averageBalance: parseFloat(accountBalanceStats[0]?.avg_balance || 0),
					zeroBalanceAccounts: parseInt(accountBalanceStats[0]?.zero_balance || 0),
					normalizedAccounts: parseInt(accountBalanceStats[0]?.normalized_accounts || 0),
					byType: accountTypes
				},
				transactions: {
					total: totalTransactions,
					pending: pendingTransactions,
					recent: recentTransactions,
					volumeByMonth: transactionVolume
				}
			};
		} catch (error) {
			logger.error(`Error getting dashboard stats: ${error.message}`, { clientId });
			throw error;
		}
	}

	/**
	 * Get bank users for a client with pagination and filtering
	 * @param {string} clientId - Client ID
	 * @param {Object} options - Query options
	 * @returns {Object} - Bank users with pagination info
	 */
	async getBankUsers(clientId, options = {}) {
		try {
			if (!clientId) {
				throw new Error('Client ID is required');
			}

			const {
				page = 1,
				limit = 10,
				search = '',
				status = '',
				sortBy = 'createdAt',
				sortOrder = 'DESC'
			} = options;

			logger.info(`Fetching bank users for client ${clientId} (page ${page}, limit ${limit})`);

			const offset = (page - 1) * limit;
			const whereClause = { clientId };

			// Add search filter if provided
			if (search) {
				whereClause[Op.or] = [
					{ bankUserId: { [Op.iLike]: `%${search}%` } },
					{ name: { [Op.iLike]: `%${search}%` } },
					{ email: { [Op.iLike]: `%${search}%` } }
				];
			}

			// Add status filter if provided
			if (status) {
				whereClause.status = status;
			}

			// Get users with pagination
			const { count, rows } = await BankUser.findAndCountAll({
				where: whereClause,
				limit: parseInt(limit),
				offset: parseInt(offset),
				order: [[sortBy, sortOrder]]
			});

			// For each user, get their account count and transaction count
			// ENHANCED: Also get total balance for each user
			const usersWithCounts = await Promise.all(rows.map(async (user) => {
				const [accountCount, transactionCount, balanceInfo] = await Promise.all([
					Account.count({
						where: {
							clientId,
							bankUserId: user.bankUserId
						}
					}),
					Transaction.count({
						where: {
							clientId,
							bankUserId: user.bankUserId
						}
					}),
					// ADD: Get user's total balance and account health
					sequelize.query(
						`SELECT 
							SUM(balance) as total_balance,
							COUNT(CASE WHEN "dataQualityFlags" IS NOT NULL THEN 1 END) as accounts_with_flags
						FROM "Accounts" 
						WHERE "clientId" = :clientId AND "bankUserId" = :bankUserId AND "isActive" = true`,
						{
							replacements: { clientId, bankUserId: user.bankUserId },
							type: sequelize.QueryTypes.SELECT
						}
					)
				]);

				return {
					...user.toJSON(),
					accountCount,
					transactionCount,
					totalBalance: parseFloat(balanceInfo[0]?.total_balance || 0),
					accountsWithDataFlags: parseInt(balanceInfo[0]?.accounts_with_flags || 0)
				};
			}));

			return {
				users: usersWithCounts,
				pagination: {
					total: count,
					page: parseInt(page),
					limit: parseInt(limit),
					pages: Math.ceil(count / limit)
				}
			};
		} catch (error) {
			logger.error(`Error getting bank users: ${error.message}`, { clientId });
			throw error;
		}
	}

	/**
	 * Get detailed information for a specific bank user
	 * @param {string} clientId - Client ID
	 * @param {string} bankUserId - Bank User ID
	 * @returns {Object} - Bank user details
	 */
	async getBankUserDetails(clientId, bankUserId) {
		try {
			if (!clientId || !bankUserId) {
				throw new Error('Client ID and Bank User ID are required');
			}

			logger.info(`Fetching details for bank user ${bankUserId} (client: ${clientId})`);

			// Get bank user
			const bankUser = await BankUser.findOne({
				where: {
					clientId,
					bankUserId
				}
			});

			if (!bankUser) {
				throw new Error(`Bank user ${bankUserId} not found for client ${clientId}`);
			}

			// Get accounts - ENHANCED: Include balance normalization info
			const accounts = await Account.findAll({
				where: {
					clientId,
					bankUserId
				},
				order: [['type', 'ASC'], ['name', 'ASC']]
			});

			// ADD: Check for data quality issues in user's accounts
			const accountsWithIssues = accounts.filter(account =>
				account.dataQualityFlags && account.dataQualityFlags.balanceNormalization
			);

			// Get transaction summary
			const transactionSummary = await sequelize.query(
				`SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN pending = true THEN 1 END) as pending,
          SUM(CASE WHEN "amount" >= 0 THEN "amount" ELSE 0 END) as totalIncome,
          SUM(CASE WHEN "amount" < 0 THEN "amount" ELSE 0 END) as totalExpense
        FROM "Transactions" 
        WHERE "clientId" = :clientId AND "bankUserId" = :bankUserId`,
				{
					replacements: { clientId, bankUserId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			// Get transaction categories
			const categories = await sequelize.query(
				`SELECT 
          category, 
          COUNT(*) as count,
          SUM("amount") as amount
        FROM "Transactions" 
        WHERE "clientId" = :clientId AND "bankUserId" = :bankUserId AND category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC`,
				{
					replacements: { clientId, bankUserId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			// Get recent transactions (last 10)
			const recentTransactions = await Transaction.findAll({
				where: {
					clientId,
					bankUserId
				},
				limit: 10,
				order: [['date', 'DESC']]
			});

			// ENHANCED RETURN: Include data quality information
			return {
				bankUser: bankUser.toJSON(),
				accounts,
				dataQuality: {
					totalAccounts: accounts.length,
					accountsWithNormalization: accountsWithIssues.length,
					normalizationDetails: accountsWithIssues.map(account => ({
						accountId: account.accountId,
						flags: account.dataQualityFlags?.balanceNormalization || [],
						normalizedAt: account.dataQualityFlags?.normalizedAt
					}))
				},
				transactionSummary: transactionSummary[0] || {
					total: 0,
					pending: 0,
					totalIncome: 0,
					totalExpense: 0
				},
				categories,
				recentTransactions
			};
		} catch (error) {
			logger.error(`Error getting bank user details: ${error.message}`, { clientId, bankUserId });
			throw error;
		}
	}

	/**
	 * Get activity data for a specified date range
	 * @param {string} clientId - Client ID
	 * @param {Object} options - Query options
	 * @returns {Array} - Activity data
	 */
	async getActivityData(clientId, options = {}) {
		try {
			if (!clientId) {
				throw new Error('Client ID is required');
			}

			const { startDate, endDate } = options;

			// Parse dates or use defaults (last 30 days)
			const end = endDate ? new Date(endDate) : new Date();
			const start = startDate ? new Date(startDate) : new Date(end);
			if (!startDate) {
				start.setDate(end.getDate() - 30);
			}

			logger.info(`Fetching activity data for client ${clientId} from ${start.toISOString()} to ${end.toISOString()}`);

			// Generate daily activity data
			const activityData = [];

			// Clone start date for iteration
			const currentDate = new Date(start);

			while (currentDate <= end) {
				const day = currentDate.toISOString().split('T')[0];

				// Get transaction count for this day
				const dayStart = new Date(currentDate);
				dayStart.setHours(0, 0, 0, 0);

				const dayEnd = new Date(currentDate);
				dayEnd.setHours(23, 59, 59, 999);

				const transactionCount = await Transaction.count({
					where: {
						clientId,
						date: {
							[Op.gte]: dayStart,
							[Op.lt]: dayEnd
						}
					}
				});

				// Get active users count for this day
				const activeUsersCount = await sequelize.query(
					`SELECT COUNT(DISTINCT "bankUserId") as count FROM "Transactions" 
           WHERE "clientId" = :clientId AND "date" BETWEEN :dayStart AND :dayEnd`,
					{
						replacements: {
							clientId,
							dayStart,
							dayEnd
						},
						type: sequelize.QueryTypes.SELECT
					}
				);

				activityData.push({
					date: day,
					transactions: transactionCount,
					users: activeUsersCount[0]?.count || 0
				});

				// Move to next day
				currentDate.setDate(currentDate.getDate() + 1);
			}

			return activityData;
		} catch (error) {
			logger.error(`Error getting activity data: ${error.message}`, { clientId });
			throw error;
		}
	}

	/**
	 * NEW METHOD: Get data quality summary for a client
	 * @param {string} clientId - Client ID
	 * @returns {Object} - Data quality information
	 */
	async getDataQualitySummary(clientId) {
		try {
			if (!clientId) {
				throw new Error('Client ID is required');
			}

			logger.info(`Fetching data quality summary for client ${clientId}`);

			// Get comprehensive data quality info using AccountDataService
			const qualityReport = await AccountDataService.getDataQualityReport(clientId);

			// Get additional client-specific metrics
			const clientSpecificMetrics = await sequelize.query(
				`SELECT 
					COUNT(*) as total_accounts,
					COUNT(CASE WHEN "dataQualityFlags" IS NOT NULL THEN 1 END) as accounts_with_flags,
					COUNT(CASE WHEN balance = 0 AND "availableBalance" = 0 THEN 1 END) as zero_balance_accounts,
					AVG(balance) as avg_balance,
					MIN(balance) as min_balance,
					MAX(balance) as max_balance
				FROM "Accounts" 
				WHERE "clientId" = :clientId AND "isActive" = true`,
				{
					replacements: { clientId },
					type: sequelize.QueryTypes.SELECT
				}
			);

			const metrics = clientSpecificMetrics[0];

			return {
				clientId,
				summary: {
					totalAccounts: parseInt(metrics.total_accounts),
					accountsWithNormalization: parseInt(metrics.accounts_with_flags),
					normalizationPercentage: metrics.total_accounts > 0 ?
						(parseInt(metrics.accounts_with_flags) / parseInt(metrics.total_accounts) * 100).toFixed(1) : '0.0',
					zeroBalanceAccounts: parseInt(metrics.zero_balance_accounts),
					averageBalance: parseFloat(metrics.avg_balance || 0),
					balanceRange: {
						min: parseFloat(metrics.min_balance || 0),
						max: parseFloat(metrics.max_balance || 0)
					}
				},
				flagBreakdown: qualityReport.flagBreakdown,
				recentNormalizations: qualityReport.accounts
					.filter(account => account.clientId === clientId)
					.sort((a, b) => new Date(b.normalizedAt) - new Date(a.normalizedAt))
					.slice(0, 10)
			};
		} catch (error) {
			logger.error(`Error getting data quality summary: ${error.message}`, { clientId });
			throw error;
		}
	}
}

module.exports = new BankClientService();