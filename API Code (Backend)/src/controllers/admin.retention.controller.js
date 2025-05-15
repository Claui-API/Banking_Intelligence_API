// src/controllers/admin.retention.controller.js - Updated with getRetentionLogs method
const { Op } = require('sequelize'); // Import Op explicitly
const dataRetentionService = require('../services/data-retention.service');
const { User, Client } = require('../models/User');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

/**
 * Controller for admin data retention operations
 */
class AdminRetentionController {
	/**
	 * Get data retention policy statistics
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getPolicyStats(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			// Get the current date
			const now = new Date();

			// Calculate statistics
			const stats = {
				totalUsers: await User.count(),
				activeUsers: await User.count({
					where: { status: 'active' }
				}),
				inactiveUsers: await User.count({
					where: { status: 'inactive' }
				}),
				markedForDeletion: await User.count({
					where: { markedForDeletionAt: { [Op.ne]: null } } // Use Op.ne instead of Op.not
				}),

				// Plaid connection stats
				plaidConnections: await sequelize.models.PlaidItem ?
					sequelize.models.PlaidItem.count() : 0,
				disconnectedPlaidItems: await sequelize.models.PlaidItem ?
					sequelize.models.PlaidItem.count({
						where: { status: 'disconnected' }
					}) : 0,

				// Retention logs data
				retentionLogs: await sequelize.models.RetentionLog ?
					sequelize.models.RetentionLog.count() : 0,

				// Retention actions in the last 30 days
				recentActions: {}
			};

			// Get counts of recent retention actions
			if (sequelize.models.RetentionLog) {
				const thirtyDaysAgo = new Date(now);
				thirtyDaysAgo.setDate(now.getDate() - 30);

				const actionCounts = await sequelize.models.RetentionLog.findAll({
					attributes: [
						'action',
						[sequelize.fn('COUNT', sequelize.col('action')), 'count']
					],
					where: {
						timestamp: { [Op.gte]: thirtyDaysAgo } // Use Op from import
					},
					group: ['action']
				});

				// Convert to object format for easy access
				actionCounts.forEach(item => {
					stats.recentActions[item.action] = parseInt(item.getDataValue('count'));
				});
			}

			// Get token statistics
			if (sequelize.models.Token) {
				stats.tokens = {
					total: await sequelize.models.Token.count(),
					active: await sequelize.models.Token.count({
						where: {
							isRevoked: false,
							expiresAt: { [Op.gt]: now } // Use Op from import
						}
					}),
					expired: await sequelize.models.Token.count({
						where: {
							isRevoked: false,
							expiresAt: { [Op.lt]: now } // Use Op from import
						}
					}),
					revoked: await sequelize.models.Token.count({
						where: { isRevoked: true }
					})
				};
			}

			return res.status(200).json({
				success: true,
				data: stats
			});
		} catch (error) {
			logger.error('Error getting retention policy stats:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to get retention policy statistics',
				error: error.message
			});
		}
	}

	/**
	 * Update user data retention settings
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async updateUserRetentionSettings(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			const { userId } = req.params;
			const {
				transactionRetentionDays,
				insightRetentionDays,
				emailNotifications,
				analyticalDataUse,
				status
			} = req.body;

			// Find the user
			const user = await User.findByPk(userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					message: `User ${userId} not found`
				});
			}

			// Update data retention preferences
			const currentPrefs = user.dataRetentionPreferences || {};
			const updatedPrefs = {
				...currentPrefs,
				...(transactionRetentionDays !== undefined && { transactionRetentionDays }),
				...(insightRetentionDays !== undefined && { insightRetentionDays }),
				...(emailNotifications !== undefined && { emailNotifications }),
				...(analyticalDataUse !== undefined && { analyticalDataUse })
			};

			user.dataRetentionPreferences = updatedPrefs;

			// Update user status if provided
			if (status) {
				// Special handling for status changes
				if (status === 'inactive' && user.status === 'active') {
					// Set marked for deletion timestamp when changing to inactive
					user.markedForDeletionAt = new Date();
				} else if (status === 'active' && user.status === 'inactive') {
					// Clear marked for deletion timestamp when reactivating
					user.markedForDeletionAt = null;
					user.inactivityWarningDate = null;
				}

				user.status = status;
			}

			await user.save();

			// Log this admin action
			await dataRetentionService.createRetentionLog('admin_updated_retention_settings', {
				userId,
				adminId: req.auth.userId,
				updatedPrefs,
				updatedStatus: status
			});

			return res.status(200).json({
				success: true,
				message: 'User retention settings updated successfully',
				data: {
					userId,
					dataRetentionPreferences: user.dataRetentionPreferences,
					status: user.status
				}
			});
		} catch (error) {
			logger.error('Error updating user retention settings:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to update user retention settings',
				error: error.message
			});
		}
	}

	/**
	 * Force delete a user and all their data
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async forceDeleteUser(req, res) {
		const transaction = await sequelize.transaction();

		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			const { userId } = req.params;
			const { confirmDeletion, deletionReason } = req.body;

			// Require confirmation and reason
			if (!confirmDeletion || confirmDeletion !== 'CONFIRM_PERMANENT_DELETION') {
				return res.status(400).json({
					success: false,
					message: 'Confirmation required for permanent deletion'
				});
			}

			if (!deletionReason || deletionReason.trim().length < 10) {
				return res.status(400).json({
					success: false,
					message: 'A detailed deletion reason is required (at least 10 characters)'
				});
			}

			// Find the user
			const user = await User.findByPk(userId, { transaction });
			if (!user) {
				await transaction.rollback();
				return res.status(404).json({
					success: false,
					message: `User ${userId} not found`
				});
			}

			// Store user email and name for logging
			const userEmail = user.email;
			const userName = user.clientName;

			// Process full deletion
			await dataRetentionService.deleteUserData(userId, transaction);

			// Log this admin action in a separate system
			await sequelize.models.AdminLog.create({
				adminId: req.auth.userId,
				action: 'force_delete_user',
				details: {
					userId,
					userEmail,
					userName,
					reason: deletionReason
				},
				ipAddress: req.ip,
				timestamp: new Date()
			}, { transaction });

			await transaction.commit();

			return res.status(200).json({
				success: true,
				message: 'User permanently deleted',
				data: {
					userId,
					deletedAt: new Date()
				}
			});
		} catch (error) {
			await transaction.rollback();
			logger.error('Error force deleting user:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to force delete user',
				error: error.message
			});
		}
	}

	/**
	 * View details of accounts marked for deletion
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getAccountsMarkedForDeletion(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			// Parse pagination parameters
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;

			// Find users marked for deletion - Using Op.ne instead of Op.not
			const { count, rows } = await User.findAndCountAll({
				where: {
					markedForDeletionAt: { [Op.ne]: null } // Changed from Op.not to Op.ne
				},
				attributes: [
					'id', 'email', 'clientName', 'status',
					'markedForDeletionAt', 'lastLoginAt'
				],
				include: [
					{
						model: Client,
						attributes: ['clientId', 'status'],
						required: false
					}
				],
				limit,
				offset: (page - 1) * limit,
				order: [['markedForDeletionAt', 'ASC']]
			});

			// Calculate deletion dates
			const usersWithDeletionDates = rows.map(user => {
				const markedDate = new Date(user.markedForDeletionAt);
				const deletionDate = new Date(markedDate);

				// Calculate actual deletion date based on grace period + deletion period
				deletionDate.setDate(
					markedDate.getDate() +
					dataRetentionService.retentionRules.inactivity.deletionPeriod
				);

				return {
					...user.toJSON(),
					scheduledDeletionDate: deletionDate
				};
			});

			return res.status(200).json({
				success: true,
				data: {
					accounts: usersWithDeletionDates,
					pagination: {
						total: count,
						page,
						limit,
						totalPages: Math.ceil(count / limit)
					}
				}
			});
		} catch (error) {
			logger.error('Error getting accounts marked for deletion:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to get accounts marked for deletion',
				error: error.message
			});
		}
	}

	/**
	 * Run the monthly retention policy audit manually
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async runRetentionAudit(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			// Run the audit
			const auditResults = await dataRetentionService.auditRetentionCompliance();

			return res.status(200).json({
				success: true,
				message: 'Retention policy audit completed',
				data: auditResults
			});
		} catch (error) {
			logger.error('Error running retention audit:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to run retention policy audit',
				error: error.message
			});
		}
	}

	/**
	 * Get retention logs
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getRetentionLogs(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			// Parse query parameters
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const action = req.query.action || null;
			const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
			const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

			// Validate date range if provided
			if (startDate && endDate && startDate > endDate) {
				return res.status(400).json({
					success: false,
					message: 'Invalid date range: start date must be before end date'
				});
			}

			// Build query filters
			const filters = {};

			if (action) {
				filters.action = action;
			}

			if (startDate && endDate) {
				filters.timestamp = {
					[Op.between]: [startDate, endDate] // Using imported Op
				};
			} else if (startDate) {
				filters.timestamp = {
					[Op.gte]: startDate // Using imported Op
				};
			} else if (endDate) {
				filters.timestamp = {
					[Op.lte]: endDate // Using imported Op
				};
			}

			// Check if RetentionLog model exists
			if (!sequelize.models.RetentionLog) {
				// Return empty result if model doesn't exist
				return res.status(200).json({
					success: true,
					data: {
						logs: [],
						pagination: {
							total: 0,
							page,
							limit,
							totalPages: 0
						}
					}
				});
			}

			// Fetch logs
			const { count, rows } = await sequelize.models.RetentionLog.findAndCountAll({
				where: filters,
				limit,
				offset: (page - 1) * limit,
				order: [['timestamp', 'DESC']]
			});

			// Return logs with pagination info
			return res.status(200).json({
				success: true,
				data: {
					logs: rows,
					pagination: {
						total: count,
						page,
						limit,
						totalPages: Math.ceil(count / limit)
					}
				}
			});
		} catch (error) {
			logger.error('Error retrieving retention logs:', error);

			// Return empty result rather than error to avoid breaking the UI
			return res.status(200).json({
				success: true,
				data: {
					logs: [],
					pagination: {
						total: 0,
						page: 1,
						limit: 20,
						totalPages: 0
					},
					error: error.message
				}
			});
		}
	}
}

// Export singleton instance
module.exports = new AdminRetentionController();