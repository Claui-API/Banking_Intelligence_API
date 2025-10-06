// src/controllers/data-retention.controller.js
const { Op } = require('sequelize'); // Import Op explicitly
const dataRetentionService = require('../services/data-retention.service');
const logger = require('../utils/logger');
const { User } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Controller for handling user data retention requests
 */
class DataRetentionController {
	/**
	 * Get user's data retention settings
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getRetentionSettings(req, res) {
		try {
			const { userId } = req.auth;

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Fetch user from database to get retention preferences
			const user = await User.findByPk(userId);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Get data retention preferences from user model
			// If not set, use default values
			const defaultSettings = {
				transactionRetentionDays: 730, // 24 months
				insightRetentionDays: 365, // 12 months
				emailNotifications: true,
				analyticalDataUse: true
			};

			const retentionSettings = user.dataRetentionPreferences || defaultSettings;

			// Check if account is marked for deletion
			const accountStatus = {
				isMarkedForDeletion: user.markedForDeletionAt !== null,
				markedForDeletionAt: user.markedForDeletionAt,
				status: user.status
			};

			// Calculate scheduled deletion date if marked for deletion
			if (accountStatus.isMarkedForDeletion) {
				const deletionDate = new Date(user.markedForDeletionAt);
				deletionDate.setDate(deletionDate.getDate() +
					dataRetentionService.retentionRules.inactivity.deletionPeriod);

				accountStatus.scheduledDeletionDate = deletionDate;
			}

			logger.info(`Retrieved retention settings for user ${userId}`);

			return res.status(200).json({
				success: true,
				data: {
					settings: retentionSettings,
					accountStatus
				}
			});
		} catch (error) {
			logger.error('Error retrieving retention settings:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve retention settings',
				error: error.message
			});
		}
	}

	/**
	 * Update user's data retention settings
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async updateRetentionSettings(req, res) {
		try {
			const { userId } = req.auth;
			const {
				transactionRetentionDays,
				insightRetentionDays,
				emailNotifications,
				analyticalDataUse
			} = req.body;

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Fetch user from database
			const user = await User.findByPk(userId);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Get current settings or initialize defaults
			const currentSettings = user.dataRetentionPreferences || {
				transactionRetentionDays: 730,
				insightRetentionDays: 365,
				emailNotifications: true,
				analyticalDataUse: true
			};

			// Update settings with new values if provided
			const updatedSettings = {
				...currentSettings,
				...(transactionRetentionDays !== undefined && {
					transactionRetentionDays: Number(transactionRetentionDays)
				}),
				...(insightRetentionDays !== undefined && {
					insightRetentionDays: Number(insightRetentionDays)
				}),
				...(emailNotifications !== undefined && {
					emailNotifications: Boolean(emailNotifications)
				}),
				...(analyticalDataUse !== undefined && {
					analyticalDataUse: Boolean(analyticalDataUse)
				})
			};

			// Save updated settings to user model
			user.dataRetentionPreferences = updatedSettings;
			await user.save();

			// Log this update
			await dataRetentionService.createRetentionLog('retention_settings_updated', {
				userId,
				settings: updatedSettings
			});

			logger.info(`Updated retention settings for user ${userId}`);

			return res.status(200).json({
				success: true,
				message: 'Data retention settings updated successfully',
				data: updatedSettings
			});
		} catch (error) {
			logger.error('Error updating retention settings:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to update retention settings',
				error: error.message
			});
		}
	}

	/**
	 * Export user's data for data portability
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async exportUserData(req, res) {
		try {
			const { userId } = req.auth;
			const format = req.query.format ? req.query.format.toLowerCase() : 'json';

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			logger.info(`Processing data export request for user ${userId} in ${format} format`);

			// Use the existing service method to get the export data
			const exportData = await dataRetentionService.exportUserData(userId);

			// Handle different export formats
			if (format === 'pdf') {
				try {
					// Load the PDF generator (using dynamic import to avoid loading if not needed)
					const { generatePDF } = require('../utils/pdf-generator');

					// Generate PDF
					const pdfBuffer = await generatePDF(exportData);

					// Set headers for PDF download
					res.setHeader('Content-Type', 'application/pdf');
					res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.pdf`);

					// Send the PDF
					return res.send(pdfBuffer);
				} catch (pdfError) {
					logger.error(`Error generating PDF for user ${userId}:`, pdfError);

					// Fall back to JSON if PDF generation fails
					logger.info('Falling back to JSON format due to PDF generation error');

					res.setHeader('Content-Type', 'application/json');
					res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.json`);

					return res.status(200).json(exportData);
				}
			} else {
				// Default to JSON format
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.json`);

				return res.status(200).json(exportData);
			}
		} catch (error) {
			logger.error(`Error exporting data for user ${req.auth?.userId}:`, error);

			return res.status(500).json({
				success: false,
				message: 'Failed to export user data',
				error: error.message
			});
		}
	}

	/**
	 * For admin: view retention logs
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
				return res.status(404).json({
					success: false,
					message: 'Retention logging is not configured in this environment'
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

			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve retention logs',
				error: error.message
			});
		}
	}

	/**
	 * Request account closure (initiate account deletion process)
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async requestAccountClosure(req, res) {
		try {
			const { userId } = req.auth;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Get confirmation from request body
			const { confirmation, reason } = req.body;

			if (!confirmation || confirmation !== 'DELETE_MY_ACCOUNT') {
				return res.status(400).json({
					success: false,
					message: 'Please type "DELETE_MY_ACCOUNT" to confirm account closure'
				});
			}

			// Fetch user
			const user = await User.findByPk(userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Check if account is already marked for deletion
			if (user.markedForDeletionAt) {
				return res.status(400).json({
					success: false,
					message: 'Account is already marked for deletion',
					data: {
						markedForDeletionAt: user.markedForDeletionAt,
						scheduledDeletionDate: new Date(user.markedForDeletionAt.getTime() + (30 * 24 * 60 * 60 * 1000))
					}
				});
			}

			// Use the data retention service
			const result = await dataRetentionService.handleAccountClosure(userId, reason);

			// Mark user as inactive
			user.status = 'marked_for_deletion';
			user.markedForDeletionAt = new Date();
			await user.save();

			logger.info(`Account closure requested for user ${userId}`, {
				reason,
				scheduledDeletionDate: result.scheduledDeletionDate
			});

			return res.status(200).json({
				success: true,
				message: 'Account closure has been initiated. You have 30 days to cancel this request.',
				data: {
					scheduledDeletionDate: result.scheduledDeletionDate,
					gracePeriodDays: 30
				}
			});

		} catch (error) {
			logger.error('Error requesting account closure:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to process account closure request',
				error: error.message
			});
		}
	}

	/**
	 * Cancel account closure (if within grace period)
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async cancelAccountClosure(req, res) {
		try {
			const { userId } = req.auth;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Fetch user
			const user = await User.findByPk(userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Check if account is marked for deletion
			if (!user.markedForDeletionAt) {
				return res.status(400).json({
					success: false,
					message: 'Account is not marked for deletion'
				});
			}

			// Check if still within grace period (30 days)
			const gracePeriodMs = 30 * 24 * 60 * 60 * 1000; // 30 days
			const now = new Date();
			const markedTime = new Date(user.markedForDeletionAt);
			const gracePeriodEnd = new Date(markedTime.getTime() + gracePeriodMs);

			if (now > gracePeriodEnd) {
				return res.status(400).json({
					success: false,
					message: 'Grace period has expired. Account closure cannot be cancelled.',
					data: {
						markedForDeletionAt: user.markedForDeletionAt,
						gracePeriodEndedAt: gracePeriodEnd
					}
				});
			}

			// Cancel the deletion
			user.status = 'active';
			user.markedForDeletionAt = null;
			await user.save();

			// Log the cancellation
			await dataRetentionService.createRetentionLog('account_closure_cancelled', {
				userId,
				cancelledAt: new Date()
			});

			logger.info(`Account closure cancelled for user ${userId}`);

			return res.status(200).json({
				success: true,
				message: 'Account closure has been successfully cancelled',
				data: {
					status: user.status,
					cancelledAt: new Date()
				}
			});

		} catch (error) {
			logger.error('Error cancelling account closure:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to cancel account closure',
				error: error.message
			});
		}
	}

	/**
	 * Disconnect a bank account (via Plaid itemId)
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

			// Check if PlaidItem model exists
			const PlaidItem = sequelize.models.PlaidItem;
			if (!PlaidItem) {
				return res.status(404).json({
					success: false,
					message: 'Plaid integration is not available in this environment'
				});
			}

			// Verify user owns this Plaid item
			const plaidItem = await PlaidItem.findOne({
				where: {
					itemId,
					userId
				}
			});

			if (!plaidItem) {
				return res.status(404).json({
					success: false,
					message: 'Bank account not found or does not belong to your account'
				});
			}

			// Use the data retention service to handle disconnection
			const result = await dataRetentionService.handlePlaidDisconnection(userId, itemId);

			logger.info(`Bank account disconnected for user ${userId}`, {
				itemId,
				institutionName: plaidItem.institutionName,
				scheduledDeletionDate: result.scheduledDeletionDate
			});

			return res.status(200).json({
				success: true,
				message: 'Bank account has been disconnected. Associated data will be deleted after 30 days.',
				data: {
					itemId,
					institutionName: plaidItem.institutionName,
					disconnectedAt: new Date(),
					scheduledDeletionDate: result.scheduledDeletionDate
				}
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
	 * Run manual data retention cleanup (admin only)
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async runManualCleanup(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			const { dryRun = false } = req.body;

			logger.info(`Manual data retention cleanup initiated by admin ${req.auth.userId}`, { dryRun });

			const results = {
				expiredTokens: 0,
				inactiveAccounts: 0,
				oldTransactions: 0,
				oldInsights: 0,
				disconnectedPlaidItems: 0,
				errors: []
			};

			try {
				// Run each cleanup operation
				if (dryRun) {
					// For dry run, just count what would be deleted
					results.expiredTokens = await this.countExpiredTokens();
					results.inactiveAccounts = await this.countInactiveAccounts();
					results.oldTransactions = await this.countOldTransactions();
					results.oldInsights = await this.countOldInsights();
					results.disconnectedPlaidItems = await this.countDisconnectedPlaidItems();
				} else {
					// Actually perform cleanup
					results.expiredTokens = await dataRetentionService.cleanupExpiredTokens();
					results.inactiveAccounts = await dataRetentionService.cleanupInactiveAccounts();
					results.oldTransactions = await dataRetentionService.cleanupOldTransactions();
					results.oldInsights = await dataRetentionService.cleanupOldInsights();
					results.disconnectedPlaidItems = await dataRetentionService.cleanupDisconnectedPlaidItems();
				}

			} catch (cleanupError) {
				results.errors.push(cleanupError.message);
				logger.error('Error during manual cleanup:', cleanupError);
			}

			// Log the cleanup results
			await dataRetentionService.createRetentionLog('manual_cleanup_executed', {
				adminId: req.auth.userId,
				dryRun,
				results
			});

			return res.status(200).json({
				success: true,
				message: dryRun ? 'Dry run completed successfully' : 'Manual cleanup completed successfully',
				data: {
					dryRun,
					results,
					executedAt: new Date()
				}
			});

		} catch (error) {
			logger.error('Error running manual cleanup:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to run manual cleanup',
				error: error.message
			});
		}
	}

	// Helper methods for counting (used in dry run)
	async countExpiredTokens() {
		try {
			const Token = sequelize.models.Token;
			if (!Token) return 0;

			const count = await Token.count({
				where: {
					[Op.or]: [
						{
							expiresAt: { [Op.lt]: new Date() },
							createdAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
						},
						{
							isRevoked: true,
							createdAt: { [Op.lt]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
						}
					]
				}
			});

			return count;
		} catch (error) {
			logger.error('Error counting expired tokens:', error);
			return 0;
		}
	}

	async countInactiveAccounts() {
		try {
			const warningDate = new Date(Date.now() - this.retentionRules.inactivity.warningPeriod * 24 * 60 * 60 * 1000);
			const deletionDate = new Date(Date.now() - (this.retentionRules.inactivity.gracePeriod + this.retentionRules.inactivity.deletionPeriod) * 24 * 60 * 60 * 1000);

			const count = await User.count({
				where: {
					[Op.or]: [
						{
							lastLoginAt: { [Op.lt]: deletionDate }
						},
						{
							lastLoginAt: null,
							createdAt: { [Op.lt]: deletionDate }
						}
					]
				}
			});

			return count;
		} catch (error) {
			logger.error('Error counting inactive accounts:', error);
			return 0;
		}
	}

	async countOldTransactions() {
		try {
			const Transaction = sequelize.models.Transaction;
			if (!Transaction) return 0;

			const cutoffDate = new Date(Date.now() - this.retentionRules.transactions * 24 * 60 * 60 * 1000);
			const count = await Transaction.count({
				where: {
					date: { [Op.lt]: cutoffDate }
				}
			});

			return count;
		} catch (error) {
			logger.error('Error counting old transactions:', error);
			return 0;
		}
	}

	async countOldInsights() {
		try {
			const Insight = sequelize.models.Insight;
			if (!Insight) return 0;

			const cutoffDate = new Date(Date.now() - this.retentionRules.insights * 24 * 60 * 60 * 1000);
			const count = await Insight.count({
				where: {
					createdAt: { [Op.lt]: cutoffDate }
				}
			});

			return count;
		} catch (error) {
			logger.error('Error counting old insights:', error);
			return 0;
		}
	}

	async countDisconnectedPlaidItems() {
		try {
			const PlaidItem = sequelize.models.PlaidItem;
			if (!PlaidItem) return 0;

			const cutoffDate = new Date(Date.now() - this.retentionRules.plaidDisconnect * 24 * 60 * 60 * 1000);
			const count = await PlaidItem.count({
				where: {
					status: 'disconnected',
					disconnectedAt: { [Op.lt]: cutoffDate }
				}
			});

			return count;
		} catch (error) {
			logger.error('Error counting disconnected Plaid items:', error);
			return 0;
		}
	}
}

// Export singleton instance
module.exports = new DataRetentionController();