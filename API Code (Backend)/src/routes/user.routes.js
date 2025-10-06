// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, protectFinancialData } = require('../middleware/auth');
const logger = require('../utils/logger');
const userDataController = require('../controllers/UserDataController');

/**
 * @route GET /api/users/financial-data
 * @desc Get a user's financial data with strict privacy controls
 * @access Private
 */
router.get('/financial-data', authMiddleware, protectFinancialData, userDataController.getUserFinancialData);

/**
 * @route POST /api/users/session/clear
 * @desc Clear user session data on logout
 * @access Private
 */
router.post('/session/clear', authMiddleware, async (req, res) => {
	try {
		const { userId } = req.auth;

		if (!userId) {
			return res.status(400).json({
				success: false,
				message: 'User ID is required'
			});
		}

		// Import data service
		const dataService = require('../services/data.service');

		// Clear Plaid cache
		await dataService.clearUserPlaidCache(userId);

		logger.info(`Session data cleared for user ${userId}`);

		return res.status(200).json({
			success: true,
			message: 'Session data cleared successfully'
		});
	} catch (error) {
		logger.error('Error clearing session data:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to clear session data'
		});
	}
});

/**
 * @route GET /api/users/active-sessions
 * @desc Get active sessions for a user
 * @access Private
 */
router.get('/active-sessions', authMiddleware, async (req, res) => {
	try {
		const { userId } = req.auth;

		if (!userId) {
			return res.status(400).json({
				success: false,
				message: 'User ID is required'
			});
		}

		// In a real implementation, you would look up active sessions
		// from your token store or session database

		// For now, we'll return a mock response
		const currentSession = {
			id: req.auth.sessionId || 'current-session',
			createdAt: new Date().toISOString(),
			lastActive: new Date().toISOString(),
			ip: req.ip,
			userAgent: req.headers['user-agent'],
			isCurrent: true
		};

		return res.status(200).json({
			success: true,
			data: {
				sessions: [currentSession],
				count: 1
			}
		});
	} catch (error) {
		logger.error('Error getting active sessions:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve active sessions'
		});
	}
});

/**
 * @route POST /api/users/invalidate-all-sessions
 * @desc Invalidate all sessions for a user (log out everywhere)
 * @access Private
 */
router.post('/invalidate-all-sessions', authMiddleware, async (req, res) => {
	try {
		const { userId } = req.auth;

		if (!userId) {
			return res.status(400).json({
				success: false,
				message: 'User ID is required'
			});
		}

		// Import token model and auth service
		const { Token } = require('../models');
		const authService = require('../services/auth');

		// Revoke all tokens for this user except the current one
		await Token.update(
			{ isRevoked: true },
			{
				where: {
					userId,
					token: { [require('sequelize').Op.ne]: req.headers.authorization.split(' ')[1] }
				}
			}
		);

		logger.info(`All sessions invalidated for user ${userId} except current session`);

		return res.status(200).json({
			success: true,
			message: 'All other sessions have been invalidated'
		});
	} catch (error) {
		logger.error('Error invalidating sessions:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to invalidate sessions'
		});
	}
});

module.exports = router;