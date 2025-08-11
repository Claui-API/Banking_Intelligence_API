// src/routes/bank-api.routes.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const bankUserService = require('../services/bank-user.service');
const insightsController = require('../controllers/insights.controller');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Middleware to get client ID from auth token
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
			req.clientId = req.auth.clientId;
			return next();
		}

		// Otherwise, look up the client ID for this user
		const { Client } = require('../models/User');
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
 * @route POST /api/bank/users
 * @desc Create or update a bank user
 * @access Private
 */
router.post('/users', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const userData = req.body;

		if (!userData || !userData.bankUserId) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID is required'
			});
		}

		const bankUser = await bankUserService.createOrUpdateBankUser(clientId, userData);

		return res.status(201).json({
			success: true,
			message: 'Bank user created/updated successfully',
			data: {
				bankUserId: bankUser.bankUserId,
				name: bankUser.name,
				email: bankUser.email,
				status: bankUser.status
			}
		});
	} catch (error) {
		logger.error('Error creating/updating bank user:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to create/update bank user'
		});
	}
});

/**
 * @route POST /api/bank/users/:bankUserId/accounts
 * @desc Upload accounts for a bank user
 * @access Private
 */
router.post('/users/:bankUserId/accounts', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;
		const { accounts } = req.body;

		if (!bankUserId || !accounts || !Array.isArray(accounts)) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID and accounts array are required'
			});
		}

		logger.info(`Received account upload for bank user ${bankUserId}: ${accounts.length} accounts`);

		// Ensure the bank user exists
		await bankUserService.createOrUpdateBankUser(clientId, { bankUserId });

		// Store the accounts
		const storedAccounts = await bankUserService.storeAccounts(clientId, bankUserId, accounts);

		return res.status(200).json({
			success: true,
			message: `Successfully stored ${storedAccounts.length} accounts`,
			data: {
				count: storedAccounts.length
			}
		});
	} catch (error) {
		logger.error('Error uploading accounts:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to upload accounts'
		});
	}
});

/**
 * @route POST /api/bank/users/:bankUserId/transactions
 * @desc Upload transactions for a bank user
 * @access Private
 */
router.post('/users/:bankUserId/transactions', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;
		const { transactions } = req.body;

		if (!bankUserId || !transactions || !Array.isArray(transactions)) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID and transactions array are required'
			});
		}

		logger.info(`Received transaction upload for bank user ${bankUserId}: ${transactions.length} transactions`);

		// Ensure the bank user exists
		await bankUserService.createOrUpdateBankUser(clientId, { bankUserId });

		// Store the transactions
		const storedTransactions = await bankUserService.storeTransactions(clientId, bankUserId, transactions);

		return res.status(200).json({
			success: true,
			message: `Successfully stored ${storedTransactions.length} transactions`,
			data: {
				count: storedTransactions.length
			}
		});
	} catch (error) {
		logger.error('Error uploading transactions:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to upload transactions'
		});
	}
});

/**
 * @route GET /api/bank/users/:bankUserId/financial-data
 * @desc Get financial data for a bank user
 * @access Private
 */
router.get('/users/:bankUserId/financial-data', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;
		const { startDate, endDate, limit } = req.query;

		if (!bankUserId) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID is required'
			});
		}

		// Parse date parameters
		const options = {};
		if (startDate) options.startDate = new Date(startDate);
		if (endDate) options.endDate = new Date(endDate);
		if (limit) options.limit = parseInt(limit);

		// Get financial data
		const financialData = await bankUserService.getBankUserFinancialData(clientId, bankUserId, options);

		return res.status(200).json({
			success: true,
			data: financialData
		});
	} catch (error) {
		logger.error('Error getting financial data:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to get financial data'
		});
	}
});

/**
 * @route POST /api/bank/users/:bankUserId/insights
 * @desc Generate insights for a bank user
 * @access Private
 */
router.post('/users/:bankUserId/insights', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const { bankUserId } = req.params;
		const { query, requestId } = req.body;

		if (!bankUserId || !query) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID and query are required'
			});
		}

		// Get financial data for this bank user
		const financialData = await bankUserService.getBankUserFinancialData(clientId, bankUserId);

		// Call the insights controller with this data
		const insightData = {
			query,
			requestId: requestId || `bank-${clientId}-${bankUserId}-${Date.now()}`,
			...financialData
		};

		// Generate insights
		const insights = await insightsController.generateInsightsInternal(insightData);

		return res.status(200).json({
			success: true,
			data: {
				bankUserId,
				query,
				insights,
				timestamp: new Date().toISOString()
			}
		});
	} catch (error) {
		logger.error('Error generating insights:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to generate insights'
		});
	}
});

module.exports = router;