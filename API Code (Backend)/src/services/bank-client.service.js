// src/services/bank-client.service.js
const logger = require('../utils/logger');
const BankUser = require('../models/BankUser');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

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

			return {
				users: {
					total: totalUsers,
					active: activeUsers[0]?.count || 0
				},
				accounts: {
					total: totalAccounts,
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
			const usersWithCounts = await Promise.all(rows.map(async (user) => {
				const [accountCount, transactionCount] = await Promise.all([
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
					})
				]);

				return {
					...user.toJSON(),
					accountCount,
					transactionCount
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

			// Get accounts
			const accounts = await Account.findAll({
				where: {
					clientId,
					bankUserId
				},
				order: [['type', 'ASC'], ['name', 'ASC']]
			});

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

			return {
				bankUser: bankUser.toJSON(),
				accounts,
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
}

module.exports = new BankClientService();