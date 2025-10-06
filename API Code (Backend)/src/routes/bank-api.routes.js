// src/routes/bank-api.routes.js - Enhanced with Session Isolation
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const bankUserService = require('../services/bank-user.service');
const insightsController = require('../controllers/insights.controller');
const sessionManager = require('../services/session.service'); // Add session manager
const geminiService = require('../services/gemini.service'); // Direct access for isolated insights
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
		const { Client } = require('../models');
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
 * @desc Generate insights for a bank user with isolated session
 * @access Private
 */
router.post('/users/:bankUserId/insights', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const userId = req.auth.userId;
		const { bankUserId } = req.params;
		const { query, requestId, sessionId: providedSessionId } = req.body;

		if (!bankUserId || !query) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID and query are required'
			});
		}

		// Create a unique identifier for this bank user
		const subUserId = `${clientId}_bank_${bankUserId}`;

		// Get or create session for this specific bank user
		let sessionId = providedSessionId;
		if (!sessionId) {
			// Check if we already have a session for this bank user
			sessionId = sessionManager.getOrCreateSubUserSession(userId, subUserId);
		} else {
			// Validate the provided session belongs to this bank user
			const session = sessionManager.getSession(sessionId);
			if (!session || session.subUserId !== subUserId) {
				// Invalid or wrong session, create new one
				sessionId = sessionManager.getOrCreateSubUserSession(userId, subUserId);
				logger.warn('Invalid session provided for bank user, created new session', {
					bankUserId,
					newSessionId: sessionId
				});
			}
		}

		logger.info('Processing bank user insight request', {
			clientId,
			bankUserId,
			subUserId,
			sessionId,
			query: query.substring(0, 50)
		});

		// Get financial data for this bank user
		const financialData = await bankUserService.getBankUserFinancialData(clientId, bankUserId);

		// Prepare the request data with session isolation
		const insightData = {
			query,
			queryType: classifyQuery(query),
			requestId: requestId || `bank-${clientId}-${bankUserId}-${Date.now()}`,
			userId: userId, // Main user ID
			subUserId: subUserId, // Bank user identifier
			sessionId: sessionId, // Bank user's specific session
			accounts: financialData.accounts || [],
			transactions: financialData.transactions || [],
			userProfile: {
				name: financialData.bankUserName || `Bank User ${bankUserId}`,
				email: financialData.bankUserEmail,
				bankUserId: bankUserId
			}
		};

		// Generate insights using Gemini directly with session isolation
		const insights = await geminiService.generateInsights(insightData);

		return res.status(200).json({
			success: true,
			data: {
				bankUserId,
				query,
				insights: insights.insight,
				sessionId: sessionId, // Return session for future requests
				timestamp: new Date().toISOString(),
				queryType: insights.queryType
			}
		});
	} catch (error) {
		logger.error('Error generating insights for bank user:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to generate insights'
		});
	}
});

/**
 * @route DELETE /api/bank/users/:bankUserId/session
 * @desc Clear conversation session for a bank user
 * @access Private
 */
router.delete('/users/:bankUserId/session', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const userId = req.auth.userId;
		const { bankUserId } = req.params;
		const { sessionId } = req.body;

		if (!bankUserId) {
			return res.status(400).json({
				success: false,
				message: 'Bank user ID is required'
			});
		}

		const subUserId = `${clientId}_bank_${bankUserId}`;

		// Delete the session for this bank user
		if (sessionId) {
			const deleted = sessionManager.deleteSession(sessionId);
			if (deleted) {
				logger.info('Deleted session for bank user', {
					bankUserId,
					sessionId
				});
			}
		} else {
			// Find and delete all sessions for this bank user
			const deletedCount = sessionManager.deleteSubUserSessions(userId, subUserId);
			logger.info('Deleted all sessions for bank user', {
				bankUserId,
				count: deletedCount
			});
		}

		// Create a new session for future requests
		const newSessionId = sessionManager.createSubUserSession(userId, subUserId);

		return res.status(200).json({
			success: true,
			message: 'Session cleared for bank user',
			data: {
				bankUserId,
				sessionId: newSessionId
			}
		});
	} catch (error) {
		logger.error('Error clearing bank user session:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to clear session'
		});
	}
});

/**
 * @route GET /api/bank/users/:bankUserId/session-status
 * @desc Check session status for a bank user
 * @access Private
 */
router.get('/users/:bankUserId/session-status', authMiddleware, getClientIdMiddleware, async (req, res) => {
	try {
		const { clientId } = req;
		const userId = req.auth.userId;
		const { bankUserId } = req.params;
		const { sessionId } = req.query;

		const subUserId = `${clientId}_bank_${bankUserId}`;

		if (sessionId) {
			const session = sessionManager.getSession(sessionId);
			if (session && session.subUserId === subUserId) {
				return res.status(200).json({
					success: true,
					data: {
						hasSession: true,
						sessionId: sessionId,
						bankUserId: bankUserId,
						createdAt: session.createdAt,
						lastAccessed: session.lastAccessed,
						queryCount: session.conversationHistory?.recentQueries?.length || 0
					}
				});
			}
		}

		// No valid session found
		return res.status(200).json({
			success: true,
			data: {
				hasSession: false,
				bankUserId: bankUserId,
				message: 'No active session for this bank user'
			}
		});
	} catch (error) {
		logger.error('Error checking bank user session status:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to check session status'
		});
	}
});

/**
 * Helper function to classify query type
 */
function classifyQuery(query) {
	if (!query) return 'general';
	const normalizedQuery = query.trim().toLowerCase();

	if (/\b(cocaine|heroin|hack|bomb|illegal|drug|weapon)\b/.test(normalizedQuery)) {
		return 'harmful';
	}
	if (/^(hi|hello|hey)/.test(normalizedQuery)) return 'greeting';
	if (/joke|funny/.test(normalizedQuery)) return 'joke';
	if (/budget/.test(normalizedQuery)) return 'budgeting';
	if (/spend/.test(normalizedQuery)) return 'spending';
	if (/save|saving/.test(normalizedQuery)) return 'saving';
	if (/invest/.test(normalizedQuery)) return 'investing';
	if (/debt|loan/.test(normalizedQuery)) return 'debt';

	return 'general';
}

module.exports = router;