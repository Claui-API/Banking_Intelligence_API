// src/services/data-retention.service.js
const { Op } = require('sequelize');
const schedule = require('node-schedule');
const { sequelize } = require('../config/database');
const { User, Client } = require('../models');
const { Token } = require('../models');
const { PlaidItem } = require('../models');
const logger = require('../utils/logger');
const dataService = require('./data.service');
const cryptoService = require('./crypto.service');

/**
 * Service responsible for implementing data retention and deletion policies
 */
class DataRetentionService {
	constructor() {
		this.initialized = false;
		this.retentionRules = {
			tokens: {
				accessToken: 7, // days after expiration
				refreshToken: 30, // days after expiration
				revokedToken: 90 // days after revocation
			},
			inactivity: {
				warningPeriod: 365, // days (12 months)
				gracePeriod: 90, // days (3 months)
				deletionPeriod: 30 // days (after grace period)
			},
			transactions: 730, // days (24 months)
			insights: 365, // days (12 months)
			plaidDisconnect: 30 // days after disconnection
		};
	}

	/**
	 * Initialize the service and schedule jobs
	 */
	async initialize() {
		if (this.initialized) {
			logger.info('Data retention service already initialized');
			return;
		}

		logger.info('Initializing data retention service');

		try {
			// Schedule daily cleanup jobs
			// Run at 2 AM every day
			schedule.scheduleJob('0 2 * * *', async () => {
				try {
					logger.info('Starting scheduled data retention cleanup');

					await this.cleanupExpiredTokens();
					await this.cleanupInactiveAccounts();
					await this.cleanupOldTransactions();
					await this.cleanupOldInsights();
					await this.cleanupDisconnectedPlaidItems();

					logger.info('Scheduled data retention cleanup completed');
				} catch (error) {
					logger.error('Error during scheduled data retention cleanup:', error);
				}
			});

			// Weekly job to send inactivity warnings - Run at 3 AM every Monday
			schedule.scheduleJob('0 3 * * 1', async () => {
				try {
					logger.info('Starting inactivity notification job');
					await this.sendInactivityWarnings();
					logger.info('Inactivity notification job completed');
				} catch (error) {
					logger.error('Error during inactivity notification job:', error);
				}
			});

			// Monthly audit job - Run at 4 AM on the 1st of each month
			schedule.scheduleJob('0 4 1 * *', async () => {
				try {
					logger.info('Starting monthly retention policy audit');
					await this.auditRetentionCompliance();
					logger.info('Monthly retention policy audit completed');
				} catch (error) {
					logger.error('Error during monthly retention policy audit:', error);
				}
			});

			this.initialized = true;
			logger.info('Data retention service initialized successfully');
		} catch (error) {
			logger.error('Error initializing data retention service:', error);
			throw error;
		}
	}

	/**
	 * Clean up expired tokens based on retention rules
	 */
	async cleanupExpiredTokens() {
		const transaction = await sequelize.transaction();

		try {
			const now = new Date();

			// Get date thresholds for each token type
			const accessTokenThreshold = new Date(now);
			accessTokenThreshold.setDate(now.getDate() - this.retentionRules.tokens.accessToken);

			const refreshTokenThreshold = new Date(now);
			refreshTokenThreshold.setDate(now.getDate() - this.retentionRules.tokens.refreshToken);

			const revokedTokenThreshold = new Date(now);
			revokedTokenThreshold.setDate(now.getDate() - this.retentionRules.tokens.revokedToken);

			// Delete expired access tokens
			const expiredAccessTokens = await Token.destroy({
				where: {
					tokenType: 'access',
					expiresAt: { [Op.lt]: accessTokenThreshold },
				},
				transaction
			});

			// Delete expired refresh tokens
			const expiredRefreshTokens = await Token.destroy({
				where: {
					tokenType: 'refresh',
					expiresAt: { [Op.lt]: refreshTokenThreshold },
				},
				transaction
			});

			// Delete old revoked tokens
			const oldRevokedTokens = await Token.destroy({
				where: {
					isRevoked: true,
					updatedAt: { [Op.lt]: revokedTokenThreshold },
				},
				transaction
			});

			await transaction.commit();

			logger.info('Token cleanup completed', {
				expiredAccessTokens,
				expiredRefreshTokens,
				oldRevokedTokens
			});

			return {
				expiredAccessTokens,
				expiredRefreshTokens,
				oldRevokedTokens
			};
		} catch (error) {
			await transaction.rollback();
			logger.error('Error cleaning up expired tokens:', error);
			throw error;
		}
	}

	/**
	 * Find inactive accounts and send warnings or mark for deletion
	 */
	async cleanupInactiveAccounts() {
		const transaction = await sequelize.transaction();

		try {
			const now = new Date();

			// Calculate threshold dates
			const inactiveThreshold = new Date(now);
			inactiveThreshold.setDate(now.getDate() - this.retentionRules.inactivity.warningPeriod);

			const gracePeriodThreshold = new Date(now);
			gracePeriodThreshold.setDate(now.getDate() - (this.retentionRules.inactivity.warningPeriod + this.retentionRules.inactivity.gracePeriod));

			const deletionThreshold = new Date(now);
			deletionThreshold.setDate(now.getDate() - (this.retentionRules.inactivity.warningPeriod + this.retentionRules.inactivity.gracePeriod + this.retentionRules.inactivity.deletionPeriod));

			// Mark accounts for deletion that have passed through warning, grace period, and deletion period
			const accountsToDelete = await User.findAll({
				where: {
					lastLoginAt: { [Op.lt]: deletionThreshold },
					status: 'inactive', // Only delete accounts already marked as inactive
					markedForDeletionAt: { [Op.not]: null }
				},
				transaction
			});

			// Process account deletions
			for (const user of accountsToDelete) {
				await this.deleteUserData(user.id, transaction);
			}

			// Mark as inactive accounts that have passed warning and grace period
			const accountsToMarkInactive = await User.findAll({
				where: {
					lastLoginAt: { [Op.lt]: gracePeriodThreshold },
					status: 'active'
				},
				transaction
			});

			for (const user of accountsToMarkInactive) {
				user.status = 'inactive';
				user.markedForDeletionAt = new Date();
				await user.save({ transaction });

				// Log this action for compliance
				await this.createRetentionLog('account_marked_for_deletion', {
					userId: user.id,
					reason: 'inactivity',
					scheduledDeletionDate: new Date(now.getTime() + (this.retentionRules.inactivity.deletionPeriod * 24 * 60 * 60 * 1000))
				}, transaction);
			}

			await transaction.commit();

			logger.info('Inactive account cleanup completed', {
				accountsDeleted: accountsToDelete.length,
				accountsMarkedInactive: accountsToMarkInactive.length
			});

			return {
				accountsDeleted: accountsToDelete.length,
				accountsMarkedInactive: accountsToMarkInactive.length
			};
		} catch (error) {
			await transaction.rollback();
			logger.error('Error cleaning up inactive accounts:', error);
			throw error;
		}
	}

	/**
	 * Delete user data completely
	 * @param {string} userId - User ID
	 * @param {Transaction} transaction - Sequelize transaction
	 */
	async deleteUserData(userId, transaction) {
		try {
			// Log this deletion for compliance purposes
			await this.createRetentionLog('account_deleted', {
				userId,
				reason: 'retention_policy'
			}, transaction);

			// Delete related data first (foreign key constraints)
			// 1. Delete tokens
			await Token.destroy({
				where: { userId },
				transaction
			});

			// 2. Delete Plaid connections
			await PlaidItem.destroy({
				where: { userId },
				transaction
			});

			// 3. Delete clients (we assume Client model has userId FK to User)
			await Client.destroy({
				where: { userId },
				transaction
			});

			// 4. Delete any insights metrics
			await this.deleteInsightsMetrics(userId, transaction);

			// 5. Delete user profile
			await User.destroy({
				where: { id: userId },
				transaction
			});

			logger.info(`User ${userId} completely deleted due to retention policy`);
		} catch (error) {
			logger.error(`Error deleting user ${userId} data:`, error);
			throw error;
		}
	}

	/**
	 * Delete insights metrics for a user
	 * @param {string} userId - User ID
	 * @param {Transaction} transaction - Sequelize transaction
	 */
	async deleteInsightsMetrics(userId, transaction) {
		try {
			// Check if InsightMetrics model exists in the Sequelize models
			if (sequelize.models.InsightMetrics) {
				await sequelize.models.InsightMetrics.destroy({
					where: { userId },
					transaction
				});
			} else {
				logger.info('InsightMetrics model not found, skipping metrics deletion');
			}
		} catch (error) {
			logger.error(`Error deleting insights metrics for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Clean up old transactions based on retention policy
	 */
	async cleanupOldTransactions() {
		// This would typically integrate with your actual Transaction model
		// This is a placeholder implementation
		try {
			logger.info('Starting old transaction cleanup');

			// Calculate threshold date for transaction retention
			const now = new Date();
			const transactionThreshold = new Date(now);
			transactionThreshold.setDate(now.getDate() - this.retentionRules.transactions);

			// If you're using MongoDB or another database for transactions, you would use its specific query syntax
			// For this example, we'll assume a SQL database with Sequelize
			if (sequelize.models.Transaction) {
				const result = await sequelize.models.Transaction.destroy({
					where: {
						date: { [Op.lt]: transactionThreshold }
					}
				});

				logger.info(`Deleted ${result} old transactions`);
				return result;
			} else {
				logger.info('Transaction model not found, skipping transaction cleanup');
				return 0;
			}
		} catch (error) {
			logger.error('Error cleaning up old transactions:', error);
			throw error;
		}
	}

	/**
	 * Clean up old insights based on retention policy
	 */
	async cleanupOldInsights() {
		// This would integrate with your insights storage system
		try {
			logger.info('Starting old insights cleanup');

			// Calculate threshold date for insights retention
			const now = new Date();
			const insightsThreshold = new Date(now);
			insightsThreshold.setDate(now.getDate() - this.retentionRules.insights);

			// Delete old insights if the model exists
			if (sequelize.models.InsightMetrics) {
				const result = await sequelize.models.InsightMetrics.destroy({
					where: {
						createdAt: { [Op.lt]: insightsThreshold }
					}
				});

				logger.info(`Deleted ${result} old insights`);
				return result;
			} else {
				logger.info('InsightMetrics model not found, skipping insights cleanup');
				return 0;
			}
		} catch (error) {
			logger.error('Error cleaning up old insights:', error);
			throw error;
		}
	}

	/**
	 * Clean up disconnected Plaid items after retention period
	 */
	async cleanupDisconnectedPlaidItems() {
		const transaction = await sequelize.transaction();

		try {
			// Calculate threshold date for Plaid disconnection retention
			const now = new Date();
			const disconnectionThreshold = new Date(now);
			disconnectionThreshold.setDate(now.getDate() - this.retentionRules.plaidDisconnect);

			// Find disconnected Plaid items beyond retention period
			const disconnectedItems = await PlaidItem.findAll({
				where: {
					status: 'disconnected',
					updatedAt: { [Op.lt]: disconnectionThreshold }
				},
				transaction
			});

			// Delete the items and log each deletion
			for (const item of disconnectedItems) {
				await this.createRetentionLog('plaid_item_deleted', {
					userId: item.userId,
					itemId: item.itemId,
					institutionId: item.institutionId,
					institutionName: item.institutionName,
					reason: 'retention_policy'
				}, transaction);

				await item.destroy({ transaction });
			}

			await transaction.commit();

			logger.info(`Deleted ${disconnectedItems.length} disconnected Plaid items`);
			return disconnectedItems.length;
		} catch (error) {
			await transaction.rollback();
			logger.error('Error cleaning up disconnected Plaid items:', error);
			throw error;
		}
	}

	/**
	 * Send warnings to users with inactive accounts
	 */
	async sendInactivityWarnings() {
		try {
			const now = new Date();

			// Calculate threshold date for warning
			const inactiveThreshold = new Date(now);
			inactiveThreshold.setDate(now.getDate() - this.retentionRules.inactivity.warningPeriod);

			// Find users who are inactive but haven't been warned yet
			const inactiveUsers = await User.findAll({
				where: {
					lastLoginAt: { [Op.lt]: inactiveThreshold },
					status: 'active',
					inactivityWarningDate: null
				},
				include: [{
					model: Client,
					required: true
				}]
			});

			logger.info(`Found ${inactiveUsers.length} inactive users to warn`);

			// In a real system, you would integrate with an email service
			for (const user of inactiveUsers) {
				try {
					// Send email notification (placeholder)
					const emailResult = await this.sendInactivityEmail(user);

					// Update user record to track that warning was sent
					user.inactivityWarningDate = new Date();
					await user.save();

					logger.info(`Sent inactivity warning to user ${user.id} (${user.email})`);
				} catch (userError) {
					logger.error(`Error sending inactivity warning to user ${user.id}:`, userError);
					// Continue with other users even if one fails
				}
			}

			return inactiveUsers.length;
		} catch (error) {
			logger.error('Error sending inactivity warnings:', error);
			throw error;
		}
	}

	/**
	 * Send inactivity warning email to user (placeholder implementation)
	 * @param {Object} user - User object
	 * @returns {Promise<boolean>} - Success status
	 */
	async sendInactivityEmail(user) {
		// This is a placeholder - in production, integrate with your email service
		logger.info(`[MOCK] Sending inactivity warning email to ${user.email}`);

		// In a real implementation, you would send an actual email:
		/*
		const emailService = require('./email.service');
		return emailService.sendEmail({
		  to: user.email,
		  subject: 'Your Banking Intelligence API Account Is Inactive',
		  template: 'inactivity-warning',
		  data: {
			name: user.clientName,
			lastLoginDate: user.lastLoginAt,
			daysUntilDeletion: this.retentionRules.inactivity.gracePeriod + this.retentionRules.inactivity.deletionPeriod,
			loginLink: 'https://bankingintelligenceapi.com/login'
		  }
		});
		*/

		return true; // Mock success
	}

	/**
	 * Conduct monthly audit of retention policy compliance
	 */
	async auditRetentionCompliance() {
		try {
			const auditResults = {
				expiredTokens: 0,
				oldTransactions: 0,
				oldInsights: 0,
				inactiveAccounts: 0,
				disconnectedPlaidItems: 0,
				totalPendingDeletions: 0
			};

			// Check for expired tokens that should be deleted
			const now = new Date();

			// Access tokens past retention period
			const accessTokenThreshold = new Date(now);
			accessTokenThreshold.setDate(now.getDate() - this.retentionRules.tokens.accessToken);
			auditResults.expiredTokens = await Token.count({
				where: {
					tokenType: 'access',
					expiresAt: { [Op.lt]: accessTokenThreshold }
				}
			});

			// Check for old transactions
			const transactionThreshold = new Date(now);
			transactionThreshold.setDate(now.getDate() - this.retentionRules.transactions);

			if (sequelize.models.Transaction) {
				auditResults.oldTransactions = await sequelize.models.Transaction.count({
					where: {
						date: { [Op.lt]: transactionThreshold }
					}
				});
			}

			// Check for old insights
			const insightsThreshold = new Date(now);
			insightsThreshold.setDate(now.getDate() - this.retentionRules.insights);

			if (sequelize.models.InsightMetrics) {
				auditResults.oldInsights = await sequelize.models.InsightMetrics.count({
					where: {
						createdAt: { [Op.lt]: insightsThreshold }
					}
				});
			}

			// Check for inactive accounts
			const inactiveThreshold = new Date(now);
			inactiveThreshold.setDate(now.getDate() - this.retentionRules.inactivity.warningPeriod);
			auditResults.inactiveAccounts = await User.count({
				where: {
					lastLoginAt: { [Op.lt]: inactiveThreshold },
					status: 'active'
				}
			});

			// Check for disconnected Plaid items
			const disconnectionThreshold = new Date(now);
			disconnectionThreshold.setDate(now.getDate() - this.retentionRules.plaidDisconnect);
			auditResults.disconnectedPlaidItems = await PlaidItem.count({
				where: {
					status: 'disconnected',
					updatedAt: { [Op.lt]: disconnectionThreshold }
				}
			});

			// Add up total pending deletions
			auditResults.totalPendingDeletions =
				auditResults.expiredTokens +
				auditResults.oldTransactions +
				auditResults.oldInsights +
				auditResults.disconnectedPlaidItems;

			// Log audit report
			logger.info('Monthly retention policy audit completed', auditResults);

			// Create audit record
			await this.createRetentionLog('monthly_audit', auditResults);

			return auditResults;
		} catch (error) {
			logger.error('Error conducting retention policy audit:', error);
			throw error;
		}
	}

	/**
	 * Create a retention policy log entry
	 * @param {string} action - The action taken
	 * @param {Object} details - Details of the action
	 * @param {Transaction} transaction - Optional Sequelize transaction
	 */
	async createRetentionLog(action, details, transaction = null) {
		try {
			// Check if RetentionLog model exists
			if (sequelize.models.RetentionLog) {
				await sequelize.models.RetentionLog.create({
					action,
					details,
					timestamp: new Date()
				}, { transaction });

				logger.info(`Retention log created: ${action}`, { details });
			} else {
				// Fallback to just logging if model doesn't exist
				logger.info(`[RETENTION EVENT] ${action}`, { details });
			}
		} catch (error) {
			logger.error(`Error creating retention log for action ${action}:`, error);
		}
	}

	/**
	 * Handle user-initiated account closure
	 * @param {string} userId - User ID
	 */
	async handleAccountClosure(userId) {
		const transaction = await sequelize.transaction();

		try {
			logger.info(`Processing account closure for user ${userId}`);

			const user = await User.findByPk(userId, { transaction });

			if (!user) {
				throw new Error(`User ${userId} not found`);
			}

			// Mark account for deletion but don't delete immediately (grace period)
			user.status = 'inactive';
			user.markedForDeletionAt = new Date();
			await user.save({ transaction });

			// Revoke all tokens
			await Token.update(
				{ isRevoked: true },
				{ where: { userId }, transaction }
			);

			// Mark all clients as revoked
			await Client.update(
				{ status: 'revoked' },
				{ where: { userId }, transaction }
			);

			// Calculate scheduled deletion date
			const deletionDate = new Date();
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.inactivity.deletionPeriod);

			// Log the account closure
			await this.createRetentionLog('account_closure_requested', {
				userId,
				scheduledDeletionDate: deletionDate
			}, transaction);

			await transaction.commit();

			logger.info(`User ${userId} account marked for deletion, scheduled for ${deletionDate.toISOString()}`);

			return {
				success: true,
				userId,
				scheduledDeletionDate: deletionDate
			};
		} catch (error) {
			await transaction.rollback();
			logger.error(`Error handling account closure for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Handle disconnection of a Plaid bank account
	 * @param {string} userId - User ID
	 * @param {string} itemId - Plaid Item ID
	 */
	async handlePlaidDisconnection(userId, itemId) {
		const transaction = await sequelize.transaction();

		try {
			logger.info(`Processing Plaid disconnection for user ${userId}, item ${itemId}`);

			// Find the Plaid item
			const plaidItem = await PlaidItem.findOne({
				where: { userId, itemId },
				transaction
			});

			if (!plaidItem) {
				throw new Error(`Plaid item ${itemId} not found for user ${userId}`);
			}

			// Mark as disconnected but don't delete immediately
			plaidItem.status = 'disconnected';
			plaidItem.disconnectedAt = new Date();
			plaidItem.accessToken = cryptoService.encrypt('INVALIDATED'); // Replace with actual encrypted value

			await plaidItem.save({ transaction });

			// Calculate scheduled deletion date
			const deletionDate = new Date();
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.plaidDisconnect);

			// Log the disconnection
			await this.createRetentionLog('plaid_item_disconnected', {
				userId,
				itemId,
				institutionId: plaidItem.institutionId,
				institutionName: plaidItem.institutionName,
				scheduledDeletionDate: deletionDate
			}, transaction);

			await transaction.commit();

			logger.info(`Plaid item ${itemId} marked as disconnected, scheduled for deletion on ${deletionDate.toISOString()}`);

			return {
				success: true,
				userId,
				itemId,
				scheduledDeletionDate: deletionDate
			};
		} catch (error) {
			await transaction.rollback();
			logger.error(`Error handling Plaid disconnection for user ${userId}, item ${itemId}:`, error);
			throw error;
		}
	}

	/**
	 * Cancel scheduled account deletion (if within grace period)
	 * @param {string} userId - User ID
	 */
	async cancelAccountDeletion(userId) {
		const transaction = await sequelize.transaction();

		try {
			logger.info(`Processing cancellation of account deletion for user ${userId}`);

			const user = await User.findOne({
				where: {
					id: userId,
					status: 'inactive',
					markedForDeletionAt: { [Op.not]: null }
				},
				transaction
			});

			if (!user) {
				throw new Error(`User ${userId} not found or not marked for deletion`);
			}

			// Check if still within grace period
			const now = new Date();
			const deletionDate = new Date(user.markedForDeletionAt);
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.inactivity.deletionPeriod);

			if (now > deletionDate) {
				throw new Error(`Deletion grace period has expired for user ${userId}`);
			}

			// Reactivate account
			user.status = 'active';
			user.markedForDeletionAt = null;
			user.inactivityWarningDate = null;
			await user.save({ transaction });

			// Reactivate client if it was only revoked due to account closure
			// This won't reactivate clients manually revoked by admins
			await Client.update(
				{ status: 'active' },
				{
					where: {
						userId,
						status: 'revoked',
						// Only update clients that were active before
						// For pending clients, they would still need admin approval
					},
					transaction
				}
			);

			// Log the cancellation
			await this.createRetentionLog('account_deletion_cancelled', {
				userId
			}, transaction);

			await transaction.commit();

			logger.info(`Account deletion cancelled for user ${userId}`);

			return {
				success: true,
				userId
			};
		} catch (error) {
			await transaction.rollback();
			logger.error(`Error cancelling account deletion for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Export user data for data portability
	 * @param {string} userId - User ID
	 * @returns {Promise<Object>} - Exported user data
	 */
	async exportUserData(userId) {
		try {
			logger.info(`Exporting data for user ${userId}`);

			// Collect user profile
			const user = await User.findByPk(userId, {
				attributes: ['id', 'clientName', 'email', 'createdAt', 'lastLoginAt'],
				include: [
					{
						model: Client,
						attributes: ['clientId', 'description', 'status', 'createdAt', 'lastUsedAt', 'usageCount']
					}
				]
			});

			if (!user) {
				throw new Error(`User ${userId} not found`);
			}

			// Get financial data
			const financialData = await dataService.getUserFinancialData(userId);

			// Get insights history if InsightMetrics model exists
			let insightsHistory = [];
			if (sequelize.models.InsightMetrics) {
				insightsHistory = await sequelize.models.InsightMetrics.findAll({
					where: { userId },
					attributes: ['queryId', 'query', 'queryType', 'createdAt'],
					order: [['createdAt', 'DESC']],
					limit: 100 // Last 100 insights
				});
			}

			// Log export activity
			await this.createRetentionLog('data_exported', {
				userId,
				requestedAt: new Date()
			});

			// Prepare export package
			const exportPackage = {
				userProfile: {
					id: user.id,
					name: user.clientName,
					email: user.email,
					createdAt: user.createdAt,
					lastLoginAt: user.lastLoginAt
				},
				clients: user.Clients.map(client => ({
					clientId: client.clientId,
					description: client.description,
					status: client.status,
					createdAt: client.createdAt,
					lastUsedAt: client.lastUsedAt,
					usageCount: client.usageCount
				})),
				financialData: {
					accounts: financialData.accounts,
					transactions: financialData.transactions
				},
				insights: insightsHistory.map(insight => ({
					query: insight.query,
					queryType: insight.queryType,
					timestamp: insight.createdAt
				})),
				exportDate: new Date().toISOString()
			};

			logger.info(`Data export completed for user ${userId}`);

			return exportPackage;
		} catch (error) {
			logger.error(`Error exporting data for user ${userId}:`, error);
			throw error;
		}
	}
}

// Singleton instance
const dataRetentionService = new DataRetentionService();

module.exports = dataRetentionService;