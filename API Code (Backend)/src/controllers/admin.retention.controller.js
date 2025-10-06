// src/controllers/admin.retention.controller.js - Final Fix
const { Op } = require('sequelize'); // Import Op explicitly
const dataRetentionService = require('../services/data-retention.service');
const { User, Client } = require('../models');
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

			// Calculate statistics - Initialize with safe defaults
			const stats = {
				totalUsers: 0,
				activeUsers: 0,
				inactiveUsers: 0,
				markedForDeletion: 0,
				plaidConnections: 0,
				disconnectedPlaidItems: 0,
				retentionLogs: 0,
				recentActions: {},
				tokens: {
					total: 0,
					active: 0,
					expired: 0,
					revoked: 0
				}
			};

			try {
				// User stats
				stats.totalUsers = await User.count();
				stats.activeUsers = await User.count({
					where: { status: 'active' }
				});
				stats.inactiveUsers = await User.count({
					where: { status: 'inactive' }
				});
				stats.markedForDeletion = await User.count({
					where: { markedForDeletionAt: { [Op.ne]: null } }
				});
			} catch (err) {
				logger.error('Error getting user stats:', err);
				// Continue with other stats even if this fails
			}

			try {
				// Plaid connection stats (only if model exists)
				if (sequelize.models.PlaidItem) {
					stats.plaidConnections = await sequelize.models.PlaidItem.count();
					stats.disconnectedPlaidItems = await sequelize.models.PlaidItem.count({
						where: { status: 'disconnected' }
					});
				}
			} catch (err) {
				logger.error('Error getting plaid stats:', err);
				// Continue with other stats
			}

			try {
				// Retention logs data (only if model exists)
				if (sequelize.models.RetentionLog) {
					stats.retentionLogs = await sequelize.models.RetentionLog.count();
				}
			} catch (err) {
				logger.error('Error getting retention logs stats:', err);
				// Continue with other stats
			}

			try {
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
							timestamp: { [Op.gte]: thirtyDaysAgo }
						},
						group: ['action']
					});

					// Convert to object format for easy access
					actionCounts.forEach(item => {
						stats.recentActions[item.action] = parseInt(item.getDataValue('count'));
					});
				}
			} catch (err) {
				logger.error('Error getting recent actions stats:', err);
				// Continue with other stats
			}

			try {
				// Get token statistics (only if model exists)
				if (sequelize.models.Token) {
					stats.tokens.total = await sequelize.models.Token.count();
					stats.tokens.active = await sequelize.models.Token.count({
						where: {
							isRevoked: false,
							expiresAt: { [Op.gt]: now }
						}
					});
					stats.tokens.expired = await sequelize.models.Token.count({
						where: {
							isRevoked: false,
							expiresAt: { [Op.lt]: now }
						}
					});
					stats.tokens.revoked = await sequelize.models.Token.count({
						where: { isRevoked: true }
					});
				}
			} catch (err) {
				logger.error('Error getting token stats:', err);
				// Continue with other stats
			}

			return res.status(200).json({
				success: true,
				data: stats
			});
		} catch (error) {
			logger.error('Error getting retention policy stats:', error);

			// Return empty stats with safe defaults instead of error
			return res.status(200).json({
				success: true,
				data: {
					totalUsers: 0,
					activeUsers: 0,
					inactiveUsers: 0,
					markedForDeletion: 0,
					plaidConnections: 0,
					disconnectedPlaidItems: 0,
					retentionLogs: 0,
					recentActions: {},
					tokens: {
						total: 0,
						active: 0,
						expired: 0,
						revoked: 0
					}
				}
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

			// Log this admin action - wrap in try/catch to prevent failures
			try {
				await dataRetentionService.createRetentionLog('admin_updated_retention_settings', {
					userId,
					adminId: req.auth.userId,
					updatedPrefs,
					updatedStatus: status
				});
			} catch (logError) {
				logger.error('Error creating retention log:', logError);
				// Continue even if logging fails
			}

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
		let transaction;

		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			const { userId } = req.params;

			// Log the raw request body for debugging
			logger.info('Force delete request body:', {
				body: req.body,
				contentType: req.headers['content-type'],
				method: req.method
			});

			// Access req.body safely with fallbacks
			let confirmDeletion = '';
			let deletionReason = '';

			// Check if req.body exists and extract values safely
			if (req.body) {
				confirmDeletion = req.body.confirmDeletion || '';
				deletionReason = req.body.deletionReason || '';
			}

			// Log extracted values
			logger.info('Extracted values from request:', {
				userId,
				confirmDeletion: confirmDeletion ? 'provided' : 'missing',
				reasonLength: deletionReason ? deletionReason.length : 0
			});

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

			// Start transaction
			transaction = await sequelize.transaction();

			// Find the user - with transaction
			const user = await User.findByPk(userId, { transaction });
			if (!user) {
				if (transaction) await transaction.rollback();
				return res.status(404).json({
					success: false,
					message: `User ${userId} not found`
				});
			}

			// Store user email and name for logging
			const userEmail = user.email;
			const userName = user.clientName;

			logger.info(`Starting deletion process for ${userId} (${userEmail})`);

			// Process full deletion using service
			try {
				await dataRetentionService.deleteUserData(userId, transaction);
				logger.info(`Successfully deleted user data for ${userId}`);
			} catch (deleteError) {
				logger.error(`Error in deleteUserData service for ${userId}:`, deleteError);
				if (transaction) await transaction.rollback();
				throw new Error(`Data deletion failed: ${deleteError.message}`);
			}

			// Create admin log entry
			try {
				// Try to log to AdminLog model if it exists
				if (sequelize.models.AdminLog) {
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
					logger.info(`Created admin log for deletion of ${userId}`);
				} else {
					// Otherwise just log to server logs
					logger.info('Admin force deleted user:', {
						adminId: req.auth.userId,
						userId,
						reason: deletionReason
					});
				}
			} catch (logError) {
				logger.error(`Error creating admin log for ${userId}:`, logError);
				// Continue even if logging fails - don't roll back the transaction
			}

			// Commit transaction
			await transaction.commit();
			logger.info(`Force delete for user ${userId} completed successfully`);

			return res.status(200).json({
				success: true,
				message: 'User permanently deleted',
				data: {
					userId,
					deletedAt: new Date()
				}
			});
		} catch (error) {
			// Roll back transaction if it exists
			if (transaction) {
				try {
					await transaction.rollback();
				} catch (rollbackError) {
					logger.error('Error rolling back transaction:', rollbackError);
				}
			}

			logger.error('Error force deleting user:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to force delete user: ' + error.message,
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
					markedForDeletionAt: { [Op.ne]: null }
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
				// Get base user data
				const userData = user.toJSON ? user.toJSON() : {
					...user,
					markedForDeletionAt: user.markedForDeletionAt,
					id: user.id,
					email: user.email
				};

				// Safely calculate deletion date
				try {
					const markedDate = new Date(userData.markedForDeletionAt);
					const deletionDate = new Date(markedDate);

					// Set default retention period if service is not available
					const retentionPeriod = 30; // 30 days default

					// Try to use configured retention period if available
					try {
						if (dataRetentionService &&
							dataRetentionService.retentionRules &&
							dataRetentionService.retentionRules.inactivity &&
							typeof dataRetentionService.retentionRules.inactivity.deletionPeriod === 'number') {
							retentionPeriod = dataRetentionService.retentionRules.inactivity.deletionPeriod;
						}
					} catch (configError) {
						logger.warn('Could not access retention rules config:', configError);
					}

					deletionDate.setDate(markedDate.getDate() + retentionPeriod);

					return {
						...userData,
						scheduledDeletionDate: deletionDate
					};
				} catch (dateError) {
					logger.error('Error calculating deletion date:', dateError);
					return {
						...userData,
						scheduledDeletionDate: 'Error calculating date'
					};
				}
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
				message: 'Failed to run retention policy audit: ' + error.message,
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
					[Op.between]: [startDate, endDate]
				};
			} else if (startDate) {
				filters.timestamp = {
					[Op.gte]: startDate
				};
			} else if (endDate) {
				filters.timestamp = {
					[Op.lte]: endDate
				};
			}

			// Check if RetentionLog model exists
			if (!sequelize.models.RetentionLog) {
				logger.warn('RetentionLog model does not exist, returning empty results');
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