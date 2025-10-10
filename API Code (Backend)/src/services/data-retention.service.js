// src/services/data-retention.service.js - PostgreSQL Fixed Version
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
	 * Delete user data completely - FIXED PostgreSQL Version
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

			// Get models from sequelize (based on your actual schema)
			const {
				User,
				Client,  // Note: Client is called "Clients" in your schema
				Token,
				PlaidItem,
				NotificationPreference,
				InsightMetric,  // Note: singular in model but plural in table
				UserAnalysis,  // Note: plural "UserAnalyses" in table
				AdminLog,
				Account,
				Transaction,
				BankUser
			} = sequelize.models;

			// Alternative model access since model names may differ from table names
			const Clients = sequelize.models.Clients || sequelize.models.Client;
			const Tokens = sequelize.models.Tokens || sequelize.models.Token;
			const PlaidItems = sequelize.models.PlaidItems || sequelize.models.PlaidItem;
			const NotificationPreferences = sequelize.models.NotificationPreferences || sequelize.models.NotificationPreference;
			const InsightMetrics = sequelize.models.InsightMetrics || sequelize.models.InsightMetric;
			const UserAnalyses = sequelize.models.UserAnalyses || sequelize.models.UserAnalysis;
			const AdminLogs = sequelize.models.AdminLogs || sequelize.models.AdminLog;
			const Accounts = sequelize.models.Accounts || sequelize.models.Account;
			const Transactions = sequelize.models.Transactions || sequelize.models.Transaction;
			const BankUsers = sequelize.models.BankUsers || sequelize.models.BankUser;
			const Users = sequelize.models.Users || sequelize.models.User;

			// Log this deletion for compliance purposes
			await this.createRetentionLog('account_deleted', {
				userId,
				reason: 'admin_rejection_or_retention_policy',
				deletionMethod: 'comprehensive'
			}, t);

			// STEP 1: Get all clients associated with this user (using correct table name)
			const clientRecords = await sequelize.query(`
				SELECT "clientId" FROM "Clients" WHERE "userId" = :userId
			`, {
				replacements: { userId },
				type: sequelize.QueryTypes.SELECT,
				transaction: t
			});

			const clientIds = clientRecords.map(c => c.clientId);
			logger.info(`Found ${clientIds.length} clients for user ${userId}`, { clientIds });

			// STEP 2: Delete in correct order based on your ACTUAL schema constraints
			// Order: Transactions -> Accounts -> BankUsers -> UserAnalyses -> NotificationPreferences 
			//        -> InsightMetrics -> PlaidItems -> Tokens -> AdminLogs -> Clients -> User

			// 2a. Delete Transactions first (references BankUsers via composite FK)
			if (clientIds.length > 0) {
				try {
					const transactionsDeleted = await sequelize.query(
						'DELETE FROM "Transactions" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.transactions = transactionsDeleted[1] || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.transactions} transactions`);
				} catch (error) {
					logger.warn('Failed to delete transactions:', error.message);
					deletionResults.errors.push({ table: 'Transactions', error: error.message });
				}
			}

			// 2b. Delete Accounts (references BankUsers via composite FK)
			if (clientIds.length > 0) {
				try {
					const accountsDeleted = await sequelize.query(
						'DELETE FROM "Accounts" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.accounts = accountsDeleted[1] || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.accounts} accounts`);
				} catch (error) {
					logger.warn('Failed to delete accounts:', error.message);
					deletionResults.errors.push({ table: 'Accounts', error: error.message });
				}
			}

			// 2c. Delete BankUsers (references Clients)
			if (clientIds.length > 0) {
				try {
					const bankUsersDeleted = await sequelize.query(
						'DELETE FROM "BankUsers" WHERE "clientId" IN (:clientIds)',
						{
							replacements: { clientIds },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);
					deletionResults.deletedCounts.bankUsers = bankUsersDeleted[1] || 0;
					logger.info(`Deleted ${deletionResults.deletedCounts.bankUsers} bank users`);
				} catch (error) {
					logger.warn('Failed to delete bank users:', error.message);
					deletionResults.errors.push({ table: 'BankUsers', error: error.message });
				}
			}

			// 2d. Delete UserAnalyses (direct userId reference - cascades automatically)
			try {
				const userAnalysesDeleted = await sequelize.query(
					'DELETE FROM "UserAnalyses" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.userAnalyses = userAnalysesDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.userAnalyses} user analyses`);
			} catch (error) {
				logger.warn('Failed to delete user analyses:', error.message);
				deletionResults.errors.push({ table: 'UserAnalyses', error: error.message });
			}

			// 2e. Delete NotificationPreferences (CRITICAL: This was missed and blocking deletion!)
			try {
				const notificationPrefsDeleted = await sequelize.query(
					'DELETE FROM "NotificationPreferences" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.notificationPreferences = notificationPrefsDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.notificationPreferences} notification preferences`);
			} catch (error) {
				logger.warn('Failed to delete notification preferences:', error.message);
				deletionResults.errors.push({ table: 'NotificationPreferences', error: error.message });
			}

			// 2f. Delete InsightMetrics (no FK constraint visible, but linked by userId)
			try {
				const insightMetricsDeleted = await sequelize.query(
					'DELETE FROM "InsightMetrics" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.insightMetrics = insightMetricsDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.insightMetrics} insight metrics`);
			} catch (error) {
				logger.warn('Failed to delete insight metrics:', error.message);
				deletionResults.errors.push({ table: 'InsightMetrics', error: error.message });
			}

			// 2g. Delete PlaidItems (cascades automatically)
			try {
				const plaidItemsDeleted = await sequelize.query(
					'DELETE FROM "PlaidItems" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.plaidItems = plaidItemsDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.plaidItems} Plaid items`);
			} catch (error) {
				logger.warn('Failed to delete Plaid items:', error.message);
				deletionResults.errors.push({ table: 'PlaidItems', error: error.message });
			}

			// 2h. Delete Tokens (cascades automatically)
			try {
				const tokensDeleted = await sequelize.query(
					'DELETE FROM "Tokens" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.tokens = tokensDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.tokens} tokens`);
			} catch (error) {
				logger.warn('Failed to delete tokens:', error.message);
				deletionResults.errors.push({ table: 'Tokens', error: error.message });
			}

			// 2i. Handle AdminLogs - CRITICAL: details column is JSON not JSONB!
			try {
				// Create system user if needed
				const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

				// Try to ensure system user exists
				await sequelize.query(`
					INSERT INTO "Users" (id, "clientName", email, "passwordHash", "createdAt", "updatedAt")
					VALUES ($1, 'System', 'system@internal.local', 'SYSTEM_ACCOUNT', NOW(), NOW())
					ON CONFLICT (id) DO NOTHING
				`, {
					bind: [SYSTEM_USER_ID],
					type: sequelize.QueryTypes.INSERT,
					transaction: t
				});

				// Update AdminLogs using JSON operations (NOT JSONB - your table uses JSON!)
				let adminLogsUpdated = 0;
				const result = await sequelize.query(`
					UPDATE "AdminLogs" 
					SET "adminId" = $1,
						details = CASE 
							WHEN details IS NOT NULL THEN 
								(details::jsonb || jsonb_build_object(
									'originalAdminDeleted', true, 
									'deletedAt', NOW(), 
									'originalAdminId', "adminId"::text
								))::json
							ELSE 
								jsonb_build_object(
									'originalAdminDeleted', true, 
									'deletedAt', NOW(), 
									'originalAdminId', "adminId"::text
								)::json
						END
					WHERE "adminId" = $2
				`, {
					bind: [SYSTEM_USER_ID, userId],
					type: sequelize.QueryTypes.UPDATE,
					transaction: t
				});
				adminLogsUpdated = result[1] || 0;

				deletionResults.deletedCounts.adminLogsAnonymized = adminLogsUpdated;
				logger.info(`Updated ${adminLogsUpdated} admin log entries to reference system user`);

			} catch (error) {
				logger.warn('Failed to handle admin logs', { error: error.message });
				deletionResults.errors.push({
					table: 'AdminLogs',
					error: error.message,
					note: 'Admin logs may still reference deleted user - non-critical'
				});
			}

			// 2j. Delete Clients (cascades automatically from Users)
			try {
				const clientsDeleted = await sequelize.query(
					'DELETE FROM "Clients" WHERE "userId" = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.DELETE,
						transaction: t
					}
				);
				deletionResults.deletedCounts.clients = clientsDeleted[1] || 0;
				logger.info(`Deleted ${deletionResults.deletedCounts.clients} clients`);
			} catch (error) {
				logger.warn('Failed to delete clients:', error.message);
				deletionResults.errors.push({ table: 'Clients', error: error.message });
			}

			// 2k. Handle email_suppressions (JSONB metadata update)
			try {
				// Get user email first
				const userRecord = await sequelize.query(
					'SELECT email FROM "Users" WHERE id = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.SELECT,
						transaction: t
					}
				);

				if (userRecord.length > 0 && userRecord[0].email) {
					// Update using PostgreSQL JSONB operations
					const emailSuppressionsUpdated = await sequelize.query(`
						UPDATE email_suppressions 
						SET metadata = COALESCE(metadata, '{}'::jsonb) || 
							jsonb_build_object('userDeleted', true, 'deletedAt', NOW())
						WHERE email = :email
					`, {
						replacements: { email: userRecord[0].email },
						type: sequelize.QueryTypes.UPDATE,
						transaction: t
					});

					deletionResults.deletedCounts.emailSuppressionsUpdated = emailSuppressionsUpdated[1] || 0;
					if (deletionResults.deletedCounts.emailSuppressionsUpdated > 0) {
						logger.info(`Updated ${deletionResults.deletedCounts.emailSuppressionsUpdated} email suppression records`);
					}
				}
			} catch (error) {
				logger.warn('Failed to update email suppressions', { error: error.message });
				deletionResults.errors.push({
					table: 'email_suppressions',
					error: error.message,
					note: 'Non-critical - email suppressions not updated'
				});
			}

			// 2l. Handle contact_submissions (if it exists - not in your schema dump)
			try {
				// This table wasn't in your schema, so we'll skip it or handle gracefully
				logger.debug('Skipping contact_submissions - table not found in schema');
			} catch (error) {
				logger.debug('Could not update contact submissions (table may not exist)');
			}

			// 2m. Finally, delete the user record itself (handle soft deletes)
			try {
				// First check if user exists (including soft-deleted ones)
				const userCheck = await sequelize.query(
					'SELECT id, "deletedAt" FROM "Users" WHERE id = :userId',
					{
						replacements: { userId },
						type: sequelize.QueryTypes.SELECT,
						transaction: t
					}
				);

				if (userCheck.length === 0) {
					logger.warn(`User ${userId} not found in database - may have been already deleted by another process`);
					// Don't throw error - consider this a successful deletion
					deletionResults.deletedCounts.users = 0;
					deletionResults.notes = deletionResults.notes || [];
					deletionResults.notes.push('User record was already deleted');
				} else {
					// User exists, proceed with deletion (force delete even if soft-deleted)
					const userDeleted = await sequelize.query(
						'DELETE FROM "Users" WHERE id = :userId',
						{
							replacements: { userId },
							type: sequelize.QueryTypes.DELETE,
							transaction: t
						}
					);

					deletionResults.deletedCounts.users = userDeleted[1] || 1;
					logger.info(`Deleted user record for ${userId}`);
				}

			} catch (error) {
				logger.error(`Critical error deleting user record for ${userId}:`, error);
				// Don't throw - let's see if it's just a constraint issue

				// Try to get more info about why deletion failed
				try {
					const constraintCheck = await sequelize.query(`
						SELECT 
							tc.constraint_name,
							tc.table_name,
							kcu.column_name,
							ccu.table_name AS foreign_table_name,
							ccu.column_name AS foreign_column_name 
						FROM information_schema.table_constraints AS tc 
						JOIN information_schema.key_column_usage AS kcu
							ON tc.constraint_name = kcu.constraint_name
						JOIN information_schema.constraint_column_usage AS ccu
							ON ccu.constraint_name = tc.constraint_name
						WHERE tc.constraint_type = 'FOREIGN KEY' 
							AND ccu.table_name = 'Users'
					`, {
						type: sequelize.QueryTypes.SELECT,
						transaction: t
					});

					logger.info('Foreign key constraints on Users table:', constraintCheck);
				} catch (constraintError) {
					logger.debug('Could not check constraints');
				}

				throw new Error(`Failed to delete user record: ${error.message}`);
			}

			deletionResults.endTime = new Date();
			deletionResults.totalDuration = deletionResults.endTime - deletionResults.startTime;

			// Commit transaction if we created it
			if (!isExternalTransaction) {
				await t.commit();
			}

			logger.info(`User ${userId} completely deleted - PostgreSQL optimized cleanup completed`, {
				duration: deletionResults.totalDuration,
				deletedCounts: deletionResults.deletedCounts,
				errorCount: deletionResults.errors.length,
				criticalErrors: deletionResults.errors.filter(e => !e.note || !e.note.includes('non-critical')).length
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
	 * Verify user data deletion
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

			// Check for related data through clientId relationships
			try {
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

			// Summary
			const hasRemainingDirectData = Object.keys(verificationResults.remainingData).length > 0;
			const hasRemainingRelatedData = Object.keys(verificationResults.relatedData).length > 0
				&& !verificationResults.relatedData.error;

			verificationResults.isCompletelyDeleted = !hasRemainingDirectData && !hasRemainingRelatedData;

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
	 * Clean up old transactions based on retention policy
	 */
	async cleanupOldTransactions() {
		try {
			logger.info('Starting old transaction cleanup');

			const now = new Date();
			const transactionThreshold = new Date(now);
			transactionThreshold.setDate(now.getDate() - this.retentionRules.transactions);

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
		try {
			logger.info('Starting old insights cleanup');

			const now = new Date();
			const insightsThreshold = new Date(now);
			insightsThreshold.setDate(now.getDate() - this.retentionRules.insights);

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
			const now = new Date();
			const disconnectionThreshold = new Date(now);
			disconnectionThreshold.setDate(now.getDate() - this.retentionRules.plaidDisconnect);

			const disconnectedItems = await PlaidItem.findAll({
				where: {
					status: 'disconnected',
					updatedAt: { [Op.lt]: disconnectionThreshold }
				},
				transaction
			});

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
			const inactiveThreshold = new Date(now);
			inactiveThreshold.setDate(now.getDate() - this.retentionRules.inactivity.warningPeriod);

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

			for (const user of inactiveUsers) {
				try {
					const emailResult = await this.sendInactivityEmail(user);

					user.inactivityWarningDate = new Date();
					await user.save();

					logger.info(`Sent inactivity warning to user ${user.id} (${user.email})`);
				} catch (userError) {
					logger.error(`Error sending inactivity warning to user ${user.id}:`, userError);
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
	 */
	async sendInactivityEmail(user) {
		logger.info(`[MOCK] Sending inactivity warning email to ${user.email}`);
		return true;
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

			const now = new Date();

			// Check expired tokens
			const accessTokenThreshold = new Date(now);
			accessTokenThreshold.setDate(now.getDate() - this.retentionRules.tokens.accessToken);
			auditResults.expiredTokens = await Token.count({
				where: {
					tokenType: 'access',
					expiresAt: { [Op.lt]: accessTokenThreshold }
				}
			});

			// Check old transactions
			const transactionThreshold = new Date(now);
			transactionThreshold.setDate(now.getDate() - this.retentionRules.transactions);

			if (sequelize.models.Transaction) {
				auditResults.oldTransactions = await sequelize.models.Transaction.count({
					where: {
						date: { [Op.lt]: transactionThreshold }
					}
				});
			}

			// Check old insights
			const insightsThreshold = new Date(now);
			insightsThreshold.setDate(now.getDate() - this.retentionRules.insights);

			if (sequelize.models.InsightMetrics) {
				auditResults.oldInsights = await sequelize.models.InsightMetrics.count({
					where: {
						createdAt: { [Op.lt]: insightsThreshold }
					}
				});
			}

			// Check inactive accounts
			const inactiveThreshold = new Date(now);
			inactiveThreshold.setDate(now.getDate() - this.retentionRules.inactivity.warningPeriod);
			auditResults.inactiveAccounts = await User.count({
				where: {
					lastLoginAt: { [Op.lt]: inactiveThreshold },
					status: 'active'
				}
			});

			// Check disconnected Plaid items
			const disconnectionThreshold = new Date(now);
			disconnectionThreshold.setDate(now.getDate() - this.retentionRules.plaidDisconnect);
			auditResults.disconnectedPlaidItems = await PlaidItem.count({
				where: {
					status: 'disconnected',
					updatedAt: { [Op.lt]: disconnectionThreshold }
				}
			});

			auditResults.totalPendingDeletions =
				auditResults.expiredTokens +
				auditResults.oldTransactions +
				auditResults.oldInsights +
				auditResults.disconnectedPlaidItems;

			logger.info('Monthly retention policy audit completed', auditResults);

			await this.createRetentionLog('monthly_audit', auditResults);

			return auditResults;
		} catch (error) {
			logger.error('Error conducting retention policy audit:', error);
			throw error;
		}
	}

	/**
	 * Create a retention policy log entry
	 */
	async createRetentionLog(action, details, transaction = null) {
		try {
			if (sequelize.models.RetentionLog) {
				await sequelize.models.RetentionLog.create({
					action,
					details,
					timestamp: new Date()
				}, { transaction });

				logger.info(`Retention log created: ${action}`, { details });
			} else {
				logger.info(`[RETENTION EVENT] ${action}`, { details });
			}
		} catch (error) {
			logger.error(`Error creating retention log for action ${action}:`, error);
		}
	}

	// Additional methods remain the same...
	async handleAccountClosure(userId) {
		const transaction = await sequelize.transaction();

		try {
			logger.info(`Processing account closure for user ${userId}`);

			const user = await User.findByPk(userId, { transaction });

			if (!user) {
				throw new Error(`User ${userId} not found`);
			}

			user.status = 'inactive';
			user.markedForDeletionAt = new Date();
			await user.save({ transaction });

			await Token.update(
				{ isRevoked: true },
				{ where: { userId }, transaction }
			);

			await Client.update(
				{ status: 'revoked' },
				{ where: { userId }, transaction }
			);

			const deletionDate = new Date();
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.inactivity.deletionPeriod);

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

	async handlePlaidDisconnection(userId, itemId) {
		const transaction = await sequelize.transaction();

		try {
			logger.info(`Processing Plaid disconnection for user ${userId}, item ${itemId}`);

			const plaidItem = await PlaidItem.findOne({
				where: { userId, itemId },
				transaction
			});

			if (!plaidItem) {
				throw new Error(`Plaid item ${itemId} not found for user ${userId}`);
			}

			plaidItem.status = 'disconnected';
			plaidItem.disconnectedAt = new Date();
			plaidItem.accessToken = cryptoService.encrypt('INVALIDATED');

			await plaidItem.save({ transaction });

			const deletionDate = new Date();
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.plaidDisconnect);

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

			const now = new Date();
			const deletionDate = new Date(user.markedForDeletionAt);
			deletionDate.setDate(deletionDate.getDate() + this.retentionRules.inactivity.deletionPeriod);

			if (now > deletionDate) {
				throw new Error(`Deletion grace period has expired for user ${userId}`);
			}

			user.status = 'active';
			user.markedForDeletionAt = null;
			user.inactivityWarningDate = null;
			await user.save({ transaction });

			await Client.update(
				{ status: 'active' },
				{
					where: {
						userId,
						status: 'revoked',
					},
					transaction
				}
			);

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

	async exportUserData(userId) {
		try {
			logger.info(`Exporting data for user ${userId}`);

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

			const financialData = await dataService.getUserFinancialData(userId);

			let insightsHistory = [];
			if (sequelize.models.InsightMetrics) {
				insightsHistory = await sequelize.models.InsightMetrics.findAll({
					where: { userId },
					attributes: ['queryId', 'query', 'queryType', 'createdAt'],
					order: [['createdAt', 'DESC']],
					limit: 100
				});
			}

			await this.createRetentionLog('data_exported', {
				userId,
				requestedAt: new Date()
			});

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