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
 * Delete user data completely - CORRECTED version based on actual database schema
 * @param {string} userId - User ID
 * @param {Transaction} transaction - Sequelize transaction
 */
	async deleteUserData(userId, transaction) {
		const t = transaction || await sequelize.transaction();
		const isExternalTransaction = !!transaction;

		try {
			logger.info(`Starting comprehensive data deletion for user ${userId}`);

			const deletionResults = {
				userId,
				deletedCounts: {},
				errors: [],
				startTime: new Date()
			};

			// Log this deletion for compliance purposes
			await this.createRetentionLog('account_deleted', {
				userId,
				reason: 'admin_rejection_or_retention_policy',
				deletionMethod: 'comprehensive'
			}, t);

			// STEP 1: Get all clients associated with this user
			const clientRecords = await Client.findAll({
				where: { userId },
				attributes: ['clientId'],
				transaction: t
			});

			const clientIds = clientRecords.map(c => c.clientId);
			logger.info(`Found ${clientIds.length} clients for user ${userId}`, { clientIds });

			// STEP 2: Get all bankUserIds associated with these clients
			let bankUserIds = [];
			if (clientIds.length > 0) {
				const bankUserRecords = await sequelize.query(
					'SELECT DISTINCT "bankUserId" FROM "BankUsers" WHERE "clientId" IN (:clientIds)',
					{
						replacements: { clientIds },
						type: sequelize.QueryTypes.SELECT,
						transaction: t
					}
				);
				bankUserIds = bankUserRecords.map(bu => bu.bankUserId);
				logger.info(`Found ${bankUserIds.length} bankUsers for clients`, { bankUserIds });
			}

			// STEP 3: Delete in correct order respecting foreign key constraints

			// 3a. Delete Transactions (linked via clientId, NOT userId)
			if (clientIds.length > 0) {
				if (sequelize.models.Transaction) {
					// Use raw query since Transactions table doesn't have userId column
					const [, transactionDeleteCount] = await sequelize.query(
						'DELETE FROM "Transactions" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.transactions = transactionDeleteCount || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.transactions} transactions`);
				}
			}

			// 3b. Delete Accounts (linked via clientId, NOT userId)
			if (clientIds.length > 0) {
				if (sequelize.models.Account) {
					// Use raw query since Accounts table doesn't have userId column
					const [, accountDeleteCount] = await sequelize.query(
						'DELETE FROM "Accounts" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.accounts = accountDeleteCount || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.accounts} accounts`);
				}
			}

			// 3c. Delete BankUsers (linked via clientId)
			if (clientIds.length > 0) {
				if (sequelize.models.BankUser) {
					const bankUserDeleteCount = await sequelize.query(
						'DELETE FROM "BankUsers" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.bankUsers = bankUserDeleteCount[1] || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.bankUsers} bank users`);
				}
			}

			// 3d. Delete Tokens (directly linked to userId - this one is correct)
			const tokensDeleted = await Token.destroy({
				where: { userId },
				force: true,
				transaction: t
			});
			deletionResults.deletedCounts.tokens = tokensDeleted;
			logger.info(`Deleted ${tokensDeleted} tokens for user ${userId}`);

			// 3e. Delete Plaid Items (directly linked to userId)
			const plaidItemsDeleted = await PlaidItem.destroy({
				where: { userId },
				force: true,
				transaction: t
			});
			deletionResults.deletedCounts.plaidItems = plaidItemsDeleted;
			logger.info(`Deleted ${plaidItemsDeleted} Plaid items for user ${userId}`);

			// 3f. Delete user-specific data that DOES have userId column
			const userSpecificTables = [
				{ table: 'NotificationPreferences', column: 'userId' },
				{ table: 'InsightMetrics', column: 'userId' }
			];

			for (const { table, column } of userSpecificTables) {
				try {
					if (sequelize.models[table]) {
						const deleted = await sequelize.models[table].destroy({
							where: { [column]: userId },
							force: true,
							transaction: t
						});
						deletionResults.deletedCounts[table] = deleted;
						logger.info(`Deleted ${deleted} records from ${table}`);
					}
				} catch (error) {
					logger.warn(`Failed to delete from ${table}`, { error: error.message });
					deletionResults.errors.push({
						table,
						error: error.message
					});
				}
			}

			// 3g. Handle AdminLogs - Use system user instead of null to avoid constraint violation
			if (sequelize.models.AdminLog) {
				try {
					// Use the system user UUID created by migration
					const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

					// Verify system user exists (inactive admin user for deleted admin references)
					const systemUser = await sequelize.models.User.findByPk(SYSTEM_USER_ID, { transaction: t });

					if (!systemUser) {
						logger.error('System user for deleted admin references not found. Please run migration first.');
						throw new Error('System user not found - run migration: 20251006190000-add-system-user-for-deleted-admin-references');
					}

					// Update AdminLogs to reference system user instead of deleted admin
					const [adminLogsUpdated] = await sequelize.models.AdminLog.update(
						{
							adminId: SYSTEM_USER_ID, // Reference system user instead of null
							details: sequelize.fn('jsonb_set',
								sequelize.col('details'),
								'{originalAdminDeleted}',
								JSON.stringify({
									deletedAt: new Date().toISOString(),
									originalAdminId: userId,
									reason: 'Admin user deleted - reference preserved for audit trail'
								})
							)
						},
						{
							where: { adminId: userId },
							transaction: t
						}
					);

					deletionResults.deletedCounts.adminLogsAnonymized = adminLogsUpdated;
					logger.info(`Anonymized ${adminLogsUpdated} admin log entries to reference system user`);

				} catch (error) {
					logger.warn('Failed to handle admin logs', {
						error: error.message,
						suggestion: 'Consider running migration: 20251006190000-add-system-user-for-deleted-admin-references'
					});
					deletionResults.errors.push({
						table: 'AdminLogs',
						error: error.message,
						fix: 'Run migration to create system user for deleted admin references'
					});
				}
			}

			// 3h. Delete Clients (directly linked to userId)
			const clientsDeleted = await Client.destroy({
				where: { userId },
				force: true,
				transaction: t
			});
			deletionResults.deletedCounts.clients = clientsDeleted;
			logger.info(`Deleted ${clientsDeleted} clients for user ${userId}`);

			// 3i. Handle email suppressions (preserve but anonymize if linked to user email)
			if (sequelize.models.EmailSuppression) {
				try {
					// Get user email first
					const user = await User.findByPk(userId, {
						attributes: ['email'],
						transaction: t
					});

					if (user && user.email) {
						const [emailSuppressionsUpdated] = await sequelize.models.EmailSuppression.update(
							{
								metadata: sequelize.fn('jsonb_set',
									sequelize.col('metadata'),
									'{userDeleted}',
									JSON.stringify(true)
								)
							},
							{
								where: { email: user.email },
								transaction: t
							}
						);
						deletionResults.deletedCounts.emailSuppressionsUpdated = emailSuppressionsUpdated;
						logger.info(`Updated ${emailSuppressionsUpdated} email suppression records`);
					}
				} catch (error) {
					logger.warn('Failed to update email suppressions', { error: error.message });
					deletionResults.errors.push({
						table: 'EmailSuppression',
						error: error.message
					});
				}
			}

			// 3j. Delete any additional user-related data
			await this.deleteAdditionalUserData(userId, t, deletionResults);

			// 3k. Finally, delete the user record itself
			const userDeleted = await User.destroy({
				where: { id: userId },
				force: true,
				transaction: t
			});

			if (!userDeleted) {
				throw new Error(`Failed to delete user ${userId} - user not found or already deleted`);
			}

			deletionResults.deletedCounts.users = userDeleted;
			deletionResults.endTime = new Date();
			deletionResults.totalDuration = deletionResults.endTime - deletionResults.startTime;

			// Commit transaction if we created it
			if (!isExternalTransaction) {
				await t.commit();
			}

			logger.info(`User ${userId} completely deleted - comprehensive cleanup completed`, {
				duration: deletionResults.totalDuration,
				deletedCounts: deletionResults.deletedCounts,
				errorCount: deletionResults.errors.length
			});

			return {
				success: true,
				userId,
				deletionResults
			};

		} catch (error) {
			logger.error(`Error during comprehensive deletion for user ${userId}:`, {
				error: error.message,
				stack: error.stack
			});

			// Rollback transaction if we created it
			if (!isExternalTransaction) {
				try {
					await t.rollback();
					logger.info('Transaction rolled back successfully');
				} catch (rollbackError) {
					logger.error('Error rolling back transaction:', {
						error: rollbackError.message
					});
				}
			}

			throw new Error(`Data deletion failed: ${error.message}`);
		}
	}

	/**
	 * Delete additional user-related data from optional models - CORRECTED version
	 * @param {string} userId - User ID
	 * @param {Transaction} transaction - Sequelize transaction
	 * @param {Object} deletionResults - Results object to update
	 */
	async deleteAdditionalUserData(userId, transaction, deletionResults) {
		try {
			// List of additional models that might reference users
			// Only include models that actually have userId columns
			const additionalModels = [
				'UserSession',
				'UserPreference',
				'ApiUsageLog',
				'AuditLog',
				'UserActivity',
				'LoginHistory',
				'SecurityEvent'
			];

			for (const modelName of additionalModels) {
				if (sequelize.models[modelName]) {
					try {
						const deleted = await sequelize.models[modelName].destroy({
							where: { userId },
							force: true,
							transaction
						});
						if (deleted > 0) {
							deletionResults.deletedCounts[modelName] = deleted;
							logger.info(`Deleted ${deleted} ${modelName} records for user ${userId}`);
						}
					} catch (modelError) {
						logger.warn(`Could not delete ${modelName} for user ${userId}:`, modelError.message);
						deletionResults.errors.push({
							table: modelName,
							error: modelError.message
						});
					}
				}
			}

			// Handle ContactSubmission separately since it might not have userId
			if (sequelize.models.ContactSubmission) {
				try {
					// ContactSubmission might be linked by email rather than userId
					// Check your schema to see if it has userId column
					const userEmail = await User.findByPk(userId, {
						attributes: ['email'],
						transaction
					});

					if (userEmail) {
						const deleted = await sequelize.models.ContactSubmission.destroy({
							where: { email: userEmail.email }, // Assuming it's linked by email
							force: true,
							transaction
						});
						if (deleted > 0) {
							deletionResults.deletedCounts.ContactSubmission = deleted;
							logger.info(`Deleted ${deleted} contact submissions for user ${userId}`);
						}
					}
				} catch (modelError) {
					logger.warn(`Could not delete ContactSubmission for user ${userId}:`, modelError.message);
					deletionResults.errors.push({
						table: 'ContactSubmission',
						error: modelError.message
					});
				}
			}

		} catch (error) {
			logger.error(`Error deleting additional user data for ${userId}:`, error);
			deletionResults.errors.push({
				operation: 'deleteAdditionalUserData',
				error: error.message
			});
		}
	}

	/**
 * Verify user data deletion based on actual database schema
 * @param {string} userId - The user ID to verify
 * @returns {Object} - Verification results
 */
	async verifyUserDataDeletion(userId) {
		try {
			logger.info(`Verifying data deletion for user ${userId}`);

			const verificationResults = {
				userId,
				remainingData: {},
				relatedData: {},
				isCompletelyDeleted: false,
				verificationTime: new Date()
			};

			// Check tables that SHOULD be empty after user deletion

			// 1. Direct userId references (these should be 0)
			const directUserTables = [
				{ table: 'Users', column: 'id', description: 'User record' },
				{ table: 'Clients', column: 'userId', description: 'Client records' },
				{ table: 'Tokens', column: 'userId', description: 'Token records' },
				{ table: 'PlaidItems', column: 'userId', description: 'Plaid items' },
				{ table: 'NotificationPreferences', column: 'userId', description: 'Notification preferences' },
				{ table: 'InsightMetrics', column: 'userId', description: 'Insight metrics' }
			];

			for (const { table, column, description } of directUserTables) {
				try {
					if (sequelize.models[table]) {
						const count = await sequelize.models[table].count({
							where: { [column]: userId }
						});

						if (count > 0) {
							verificationResults.remainingData[table] = {
								count,
								description,
								columnChecked: column
							};
							logger.warn(`Found ${count} remaining records in ${table}`, { userId });
						} else {
							logger.info(`✓ No remaining data in ${table}`, { userId });
						}
					} else {
						logger.info(`ℹ Model ${table} not found, skipping check`);
					}
				} catch (error) {
					logger.error(`Error checking ${table}`, { error: error.message });
					verificationResults.remainingData[table] = {
						error: error.message,
						description,
						columnChecked: column
					};
				}
			}

			// 2. Check for related data through clientId relationships
			try {
				// This query checks if any data remains that should have been deleted
				// through the client relationship cascade
				const relatedDataQuery = `
				WITH user_clients AS (
					SELECT "clientId" FROM "Clients" WHERE "userId" = :userId
				)
				SELECT 
					(SELECT COUNT(*) FROM "Transactions" t 
					 WHERE t."clientId" IN (SELECT "clientId" FROM user_clients)) as transactions,
					(SELECT COUNT(*) FROM "Accounts" a 
					 WHERE a."clientId" IN (SELECT "clientId" FROM user_clients)) as accounts,
					(SELECT COUNT(*) FROM "BankUsers" bu 
					 WHERE bu."clientId" IN (SELECT "clientId" FROM user_clients)) as bankUsers
			`;

				const [relatedDataCheck] = await sequelize.query(relatedDataQuery, {
					replacements: { userId },
					type: sequelize.QueryTypes.SELECT
				});

				const relatedData = {
					transactions: parseInt(relatedDataCheck.transactions),
					accounts: parseInt(relatedDataCheck.accounts),
					bankUsers: parseInt(relatedDataCheck.bankUsers)
				};

				// Check if any related data remains
				const hasRelatedData = Object.values(relatedData).some(count => count > 0);

				if (hasRelatedData) {
					verificationResults.relatedData = relatedData;
					logger.warn('Found remaining related data', { userId, relatedData });
				} else {
					logger.info('✓ No remaining related data found', { userId });
				}
			} catch (error) {
				logger.error('Error checking related data', { error: error.message });
				verificationResults.relatedData = {
					error: error.message,
					description: 'Could not verify related data deletion'
				};
			}

			// 3. Check AdminLogs (should be anonymized, not deleted)
			try {
				const adminLogCount = await sequelize.query(
					'SELECT COUNT(*) as count FROM "AdminLogs" WHERE "adminId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.SELECT
					}
				);

				const count = parseInt(adminLogCount[0].count);
				if (count > 0) {
					verificationResults.remainingData.AdminLogs = {
						count,
						description: 'Admin logs (should be anonymized, not deleted)',
						note: 'These should have adminId set to null but preserve the log entries'
					};
					logger.warn(`Found ${count} admin logs still referencing userId ${userId} - should be anonymized`);
				} else {
					logger.info('✓ No admin logs referencing user ID (properly anonymized or no logs)');
				}
			} catch (error) {
				logger.error('Error checking admin logs', { error: error.message });
				verificationResults.remainingData.AdminLogs = {
					error: error.message,
					description: 'Could not verify admin log anonymization'
				};
			}

			// 4. Check contact submissions (if linked by email)
			try {
				// This is more complex since contact_submissions might be linked by email
				// We'll check if there are any submissions with emails that matched the deleted user
				const contactQuery = `
				SELECT COUNT(*) as count 
				FROM "contact_submissions" cs
				WHERE cs."email" IN (
					-- This subquery will be empty if user is deleted, which is what we want
					SELECT "email" FROM "Users" WHERE "id" = :userId
				)
			`;

				const [contactCheck] = await sequelize.query(contactQuery, {
					replacements: { userId },
					type: sequelize.QueryTypes.SELECT
				});

				const contactCount = parseInt(contactCheck.count);
				if (contactCount > 0) {
					verificationResults.remainingData.contact_submissions = {
						count: contactCount,
						description: 'Contact submissions linked by email',
						note: 'These may be preserved for business purposes'
					};
					logger.info(`Found ${contactCount} contact submissions - may be intentionally preserved`);
				}
			} catch (error) {
				logger.debug('Could not check contact submissions (may not exist or not linked to users)');
			}

			// 5. Summary
			const hasRemainingDirectData = Object.keys(verificationResults.remainingData).length > 0;
			const hasRemainingRelatedData = Object.keys(verificationResults.relatedData).length > 0
				&& !verificationResults.relatedData.error;

			verificationResults.isCompletelyDeleted = !hasRemainingDirectData && !hasRemainingRelatedData;

			// Generate summary
			const summary = {
				directDataTables: Object.keys(verificationResults.remainingData).length,
				relatedDataIssues: hasRemainingRelatedData ? Object.keys(verificationResults.relatedData).length : 0,
				overallStatus: verificationResults.isCompletelyDeleted ? 'COMPLETE' : 'INCOMPLETE'
			};

			logger.info(`Data deletion verification completed for user ${userId}`, {
				...summary,
				isCompletelyDeleted: verificationResults.isCompletelyDeleted
			});

			return {
				...verificationResults,
				summary
			};

		} catch (error) {
			logger.error(`Error verifying user data deletion for ${userId}`, {
				error: error.message,
				stack: error.stack
			});
			throw error;
		}
	}

	/**
	 * Delete insights metrics for a user - Enhanced version
	 * @param {string} userId - User ID
	 * @param {Transaction} transaction - Sequelize transaction
	 */
	async deleteInsightsMetrics(userId, transaction) {
		try {
			let totalDeleted = 0;

			// Delete from multiple possible insights-related models
			const insightModels = ['InsightMetrics', 'InsightQuery', 'InsightResult', 'UserInsight'];

			for (const modelName of insightModels) {
				if (sequelize.models[modelName]) {
					const deleted = await sequelize.models[modelName].destroy({
						where: { userId },
						force: true, // Hard delete
						transaction
					});
					totalDeleted += deleted;
					if (deleted > 0) {
						logger.info(`Deleted ${deleted} ${modelName} records for user ${userId}`);
					}
				}
			}

			if (totalDeleted > 0) {
				logger.info(`Total insights-related records deleted for user ${userId}: ${totalDeleted}`);
			} else {
				logger.info('No insights metrics found or models not available for user cleanup');
			}

			return totalDeleted;
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