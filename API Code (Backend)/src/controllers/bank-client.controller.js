// src/controllers/bank-client.controller.js
const bankClientService = require('../services/bank-client.service');
const logger = require('../utils/logger');

/**
 * Controller for bank client dashboard
 */
class BankClientController {
	/**
	 * Get dashboard statistics for a bank client
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 */
	async getDashboardStats(req, res) {
		try {
			const { clientId } = req;

			logger.info(`Getting dashboard stats for client ${clientId}`);

			const stats = await bankClientService.getDashboardStats(clientId);

			return res.status(200).json({
				success: true,
				data: stats
			});
		} catch (error) {
			logger.error(`Error in getDashboardStats: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: error.message || 'Failed to get dashboard statistics'
			});
		}
	}

	/**
	 * Get bank users for a client with pagination and filtering
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 */
	async getBankUsers(req, res) {
		try {
			const { clientId } = req;
			const { page, limit, search, status, sortBy, sortOrder } = req.query;

			logger.info(`Getting bank users for client ${clientId}`);

			const options = {
				page,
				limit,
				search,
				status,
				sortBy,
				sortOrder
			};

			const result = await bankClientService.getBankUsers(clientId, options);

			return res.status(200).json({
				success: true,
				data: result.users,
				pagination: result.pagination
			});
		} catch (error) {
			logger.error(`Error in getBankUsers: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: error.message || 'Failed to get bank users'
			});
		}
	}

	/**
	 * Get detailed information for a specific bank user
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 */
	async getBankUserDetails(req, res) {
		try {
			const { clientId } = req;
			const { bankUserId } = req.params;

			if (!bankUserId) {
				return res.status(400).json({
					success: false,
					message: 'Bank user ID is required'
				});
			}

			logger.info(`Getting details for bank user ${bankUserId} (client: ${clientId})`);

			const userDetails = await bankClientService.getBankUserDetails(clientId, bankUserId);

			return res.status(200).json({
				success: true,
				data: userDetails
			});
		} catch (error) {
			logger.error(`Error in getBankUserDetails: ${error.message}`);

			// Handle not found error
			if (error.message.includes('not found')) {
				return res.status(404).json({
					success: false,
					message: error.message
				});
			}

			return res.status(500).json({
				success: false,
				message: error.message || 'Failed to get bank user details'
			});
		}
	}

	/**
	 * Get activity data for a specified date range
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 */
	async getActivityData(req, res) {
		try {
			const { clientId } = req;
			const { startDate, endDate } = req.query;

			logger.info(`Getting activity data for client ${clientId}`);

			const options = {
				startDate,
				endDate
			};

			const activityData = await bankClientService.getActivityData(clientId, options);

			return res.status(200).json({
				success: true,
				data: activityData
			});
		} catch (error) {
			logger.error(`Error in getActivityData: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: error.message || 'Failed to get activity data'
			});
		}
	}
}

module.exports = new BankClientController();