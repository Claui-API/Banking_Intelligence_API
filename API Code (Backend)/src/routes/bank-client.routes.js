// src/routes/bank-client.routes.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const bankUserService = require('../services/bank-user.service');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const BankUser = require('../models/BankUser');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

const router = express.Router();

/**
 * Middleware to get client ID from auth token and verify client role
 * This ensures only actual bank clients can access these endpoints
 */
const getClientIdMiddleware = async (req, res, next) => {
	try {
		if (!req.auth || !req.auth.userId) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required'
			});
		}

		// If client credentials were used, we already have the clientId
		if (req.auth.clientId) {
			// Verify the client exists and is active
			const { Client } = require('../models/User');
			const client = await Client.findOne({
				where: {
					clientId: req.auth.clientId,
					status: 'active'
				}
			});

			if (!client) {
				return res.status(403).json({
					success: false,
					message: 'Invalid or inactive client credentials'
				});
			}

			req.clientId = req.auth.clientId;
			return next();
		}

		// Otherwise, look up the client ID for this user
		const { Client, User } = require('../models/User');
		const user = await User.findByPk(req.auth.userId);

		// Make sure user is not an admin
		if (user && user.role === 'admin') {
			return res.status(403).json({
				success: false,
				message: 'Admin users cannot access bank client dashboard'
			});
		}

		const clients = await Client.findAll({
			where: {
				userId: req.auth.userId,
				status: 'active'
			}
		});

		if (!clients || clients.length === 0) {
			return res.status(403).json({
				success: false,
				message: 'No active clients found for this user'
			});
		}

		// Use the first active client
		req.clientId = clients[0].clientId;
		next();
	} catch (error) {
		logger.error('Error in client ID middleware:', error);
		return res.status(500).json({
			success: false,
			message: 'Error processing request'
		});
	}
};

/**
 * @route GET /api/bank-client/stats
 * @desc Get stats for bank client dashboard
 * @access Private (Bank Client only)
 */
router.get('/stats', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;

		// Get counts from database
		const [userCount, accountCount, transactionCount] = await Promise.all([
			BankUser.count({ where: { clientId } }),
			Account.count({ where: { clientId } }),
			Transaction.count({ where: { clientId } })
		]);

		// Get active users count (users with at least one transaction)
		const activeUsersCount = await sequelize.query(
			`SELECT COUNT(DISTINCT "bankUserId") as count FROM "Transactions" WHERE "clientId" = :clientId`,
			{
				replacements: { clientId },
				type: sequelize.QueryTypes.SELECT
			}
		);

		// Get account types breakdown
		const accountTypes = await sequelize.query(
			`SELECT "type", COUNT(*) as count FROM "Accounts" WHERE "clientId" = :clientId GROUP BY "type"`,
			{
				replacements: { clientId },
				type: sequelize.QueryTypes.SELECT
			}
		);

		// Get transaction volume by month for the last 6 months
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const transactionVolume = await sequelize.query(
			`SELECT 
        DATE_TRUNC('month', "date") as month,
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

		return res.json({
			success: true,
			data: {
				users: {
					total: userCount,
					active: activeUsersCount[0]?.count || 0
				},
				accounts: {
					total: accountCount,
					byType: accountTypes
				},
				transactions: {
					total: transactionCount,
					volumeByMonth: transactionVolume
				}
			}
		});
	} catch (error) {
		logger.error('Error fetching bank client stats:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch dashboard statistics'
		});
	}
});

/**
 * @route GET /api/bank-client/users
 * @desc Get all bank users for this client
 * @access Private (Bank Client only)
 */
router.get('/users', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { page = 1, limit = 10, search = '', status = '' } = req.query;

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
			order: [['createdAt', 'DESC']]
		});

		// For each user, get their account count
		const usersWithCounts = await Promise.all(rows.map(async (user) => {
			const accountCount = await Account.count({
				where: {
					clientId,
					bankUserId: user.bankUserId
				}
			});

			return {
				...user.toJSON(),
				accountCount
			};
		}));

		return res.json({
			success: true,
			data: usersWithCounts,
			pagination: {
				total: count,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(count / limit)
			}
		});
	} catch (error) {
		logger.error('Error fetching bank users:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch bank users'
		});
	}
});

/**
 * @route GET /api/bank-client/users/:bankUserId/accounts
 * @desc Get accounts for a specific bank user
 * @access Private (Bank Client only)
 */
router.get('/users/:bankUserId/accounts', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;

		// Verify the bank user belongs to this client
		const bankUser = await BankUser.findOne({
			where: {
				clientId,
				bankUserId
			}
		});

		if (!bankUser) {
			return res.status(404).json({
				success: false,
				message: 'Bank user not found'
			});
		}

		// Get accounts
		const accounts = await Account.findAll({
			where: {
				clientId,
				bankUserId
			},
			order: [['type', 'ASC'], ['name', 'ASC']]
		});

		return res.json({
			success: true,
			data: accounts
		});
	} catch (error) {
		logger.error('Error fetching user accounts:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch user accounts'
		});
	}
});

/**
 * @route GET /api/bank-client/users/:bankUserId/transactions
 * @desc Get transactions for a specific bank user with filtering
 * @access Private (Bank Client only)
 */
router.get('/users/:bankUserId/transactions', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;
		const {
			page = 1,
			limit = 50,
			startDate = '',
			endDate = '',
			accountId = '',
			type = '',
			category = '',
			search = ''
		} = req.query;

		// Verify the bank user belongs to this client
		const bankUser = await BankUser.findOne({
			where: {
				clientId,
				bankUserId
			}
		});

		if (!bankUser) {
			return res.status(404).json({
				success: false,
				message: 'Bank user not found'
			});
		}

		const offset = (page - 1) * limit;
		const whereClause = { clientId, bankUserId };

		// Add date filters if provided
		if (startDate) {
			whereClause.date = {
				...(whereClause.date || {}),
				[Op.gte]: new Date(startDate)
			};
		}

		if (endDate) {
			whereClause.date = {
				...(whereClause.date || {}),
				[Op.lte]: new Date(endDate)
			};
		}

		// Add account filter if provided
		if (accountId) {
			whereClause.accountId = accountId;
		}

		// Add type filter if provided
		if (type) {
			whereClause.type = type;
		}

		// Add category filter if provided
		if (category) {
			whereClause.category = category;
		}

		// Add search filter if provided
		if (search) {
			whereClause[Op.or] = [
				{ description: { [Op.iLike]: `%${search}%` } },
				{ merchantName: { [Op.iLike]: `%${search}%` } }
			];
		}

		// Get transactions with pagination
		const { count, rows } = await Transaction.findAndCountAll({
			where: whereClause,
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [['date', 'DESC']]
		});

		return res.json({
			success: true,
			data: rows,
			pagination: {
				total: count,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(count / limit)
			}
		});
	} catch (error) {
		logger.error('Error fetching user transactions:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch user transactions'
		});
	}
});

/**
 * @route GET /api/bank-client/activity
 * @desc Get activity data for charts
 * @access Private (Bank Client only)
 */
router.get('/activity', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { startDate, endDate } = req.query;

		// Parse dates or use defaults (last 30 days)
		const end = endDate ? new Date(endDate) : new Date();
		const start = startDate ? new Date(startDate) : new Date(end);
		if (!startDate) {
			start.setDate(end.getDate() - 30);
		}

		// Generate daily activity data
		const activityData = [];

		// Clone start date for iteration
		const currentDate = new Date(start);

		while (currentDate <= end) {
			const day = currentDate.toISOString().split('T')[0];

			// Get transaction count for this day
			const transactionCount = await Transaction.count({
				where: {
					clientId,
					date: {
						[Op.gte]: new Date(currentDate.setHours(0, 0, 0, 0)),
						[Op.lt]: new Date(currentDate.setHours(23, 59, 59, 999))
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
						dayStart: new Date(currentDate.setHours(0, 0, 0, 0)),
						dayEnd: new Date(currentDate.setHours(23, 59, 59, 999))
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

		return res.json({
			success: true,
			data: activityData
		});
	} catch (error) {
		logger.error('Error fetching activity data:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch activity data'
		});
	}
});

module.exports = router;