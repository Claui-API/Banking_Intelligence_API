// src/controllers/UserDataController.js
const logger = require('../utils/logger');
const dataService = require('../services/data.service');
const plaidService = require('../services/plaid.service');

/**
 * Controller for handling user data access and management
 * Provides proper user isolation and data privacy
 */
class UserDataController {
	/**
	 * Get financial data for the authenticated user with strict privacy checks
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getUserFinancialData(req, res) {
		try {
			const { userId } = req.auth;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required to access financial data'
				});
			}

			// Log the request for audit trail
			logger.info(`Financial data requested for user ${userId}`, {
				endpoint: req.path,
				method: req.method,
				ip: req.ip
			});

			// Get user's financial data with strict user isolation
			const userData = await dataService.getUserFinancialData(userId);

			return res.status(200).json({
				success: true,
				data: userData,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			logger.error('Error getting user financial data:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve financial data',
				error: error.message
			});
		}
	}

	/**
	 * Disconnect a user's bank account with proper permission checks
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async disconnectBankAccount(req, res) {
		try {
			const { userId } = req.auth;
			const { itemId } = req.params;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			if (!itemId) {
				return res.status(400).json({
					success: false,
					message: 'Item ID is required'
				});
			}

			// Verify this user owns the Plaid item they're trying to disconnect
			const userItems = await dataService.getPlaidItemsByUser(userId);
			const hasPermission = userItems.some(item => item.itemId === itemId);

			if (!hasPermission) {
				logger.warn(`Unauthorized attempt to disconnect Plaid item ${itemId} by user ${userId}`);
				return res.status(403).json({
					success: false,
					message: 'You do not have permission to disconnect this account'
				});
			}

			// Disconnect the account
			await dataService.disconnectPlaidItem(userId, itemId);

			logger.info(`User ${userId} disconnected Plaid item ${itemId}`);

			return res.status(200).json({
				success: true,
				message: 'Bank account disconnected successfully',
				data: { itemId }
			});
		} catch (error) {
			logger.error('Error disconnecting bank account:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to disconnect bank account',
				error: error.message
			});
		}
	}

	/**
	 * Reconnect bank accounts with clean state
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async reconnectBankAccounts(req, res) {
		try {
			const { userId } = req.auth;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Prepare for reconnection (mark existing connections as disconnected)
			await dataService.reconnectBankAccounts(userId);

			logger.info(`User ${userId} initiated bank reconnection process`);

			return res.status(200).json({
				success: true,
				message: 'Ready for bank reconnection',
				data: {
					userId,
					timestamp: new Date().toISOString()
				}
			});
		} catch (error) {
			logger.error('Error preparing for bank reconnection:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to prepare for bank reconnection',
				error: error.message
			});
		}
	}
}

module.exports = new UserDataController();