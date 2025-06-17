// src/services/notification.service.unified.js
const pushNotificationService = require('./notification.service'); // Your existing push notification service
const emailNotificationService = require('./email.notification.service');
const logger = require('../utils/logger');
const { User, Client } = require('../models/User');

/**
 * Unified notification service that handles both push and email notifications
 */
class UnifiedNotificationService {
	constructor() {
		this.pushService = pushNotificationService;
		this.emailService = emailNotificationService;
		this.preferenceDefaults = {
			email: true,
			push: true
		};
	}

	/**
	 * Get user notification preferences
	 * @param {string} userId - User ID
	 * @returns {Object} - Notification preferences
	 */
	async getUserPreferences(userId) {
		try {
			// Get the NotificationPreference model
			const NotificationPreference = require('../models/NotificationPreference');

			// Get or create preferences for this user
			const preferences = await NotificationPreference.getOrCreateForUser(userId);

			// Convert to the format used internally
			return {
				email: {
					registration: preferences.emailRegistration,
					accountApproval: preferences.emailAccountApproval,
					accountStatus: preferences.emailAccountStatus,
					apiUsage: preferences.emailApiUsage,
					apiQuotaExceeded: preferences.emailApiQuotaExceeded,
					monthlySummary: preferences.emailMonthlySummary,
					securityAlerts: preferences.emailSecurityAlerts
				},
				push: {
					accountApproval: preferences.pushAccountApproval,
					accountStatus: preferences.pushAccountStatus,
					apiUsage: preferences.pushApiUsage,
					apiQuotaExceeded: preferences.pushApiQuotaExceeded,
					securityAlerts: preferences.pushSecurityAlerts
				}
			};
		} catch (error) {
			logger.error(`Error getting notification preferences for user ${userId}:`, error);
			return this.preferenceDefaults;
		}
	}

	/**
	 * Send notification through both channels based on user preferences
	 * @param {string} userId - User ID
	 * @param {string} type - Notification type
	 * @param {Object} data - Notification data
	 * @returns {Promise<Object>} - Results from both channels
	 */
	async sendNotification(userId, type, data) {
		try {
			const user = await User.findByPk(userId);

			if (!user) {
				logger.error(`User not found for notification: ${userId}`);
				return { success: false, message: 'User not found' };
			}

			// Get user preferences
			const preferences = await this.getUserPreferences(userId);

			// Results object
			const results = {
				email: { sent: false },
				push: { sent: false }
			};

			// Send email notification if enabled for this type
			if (preferences.email && preferences.email[type]) {
				results.email = await this._sendEmailNotification(user, type, data);
			}

			// Send push notification if enabled for this type
			if (preferences.push && preferences.push[type]) {
				results.push = await this._sendPushNotification(userId, type, data);
			}

			return {
				success: results.email.success || results.push.success,
				results
			};
		} catch (error) {
			logger.error(`Error sending unified notification to user ${userId}:`, error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Send email notification based on type
	 * @param {Object} user - User object
	 * @param {string} type - Notification type
	 * @param {Object} data - Notification data
	 * @returns {Promise<Object>} - Email send result
	 */
	async _sendEmailNotification(user, type, data) {
		try {
			switch (type) {
				case 'registration':
					return await this.emailService.sendRegistrationNotification(user, data.client);

				case 'accountApproval':
					return await this.emailService.sendAccountApprovalNotification(user, data.client);

				case 'accountStatus':
					return await this.emailService.sendAccountStatusChangeNotification(
						user,
						data.client,
						data.status,
						data.reason
					);

				case 'apiUsage':
					return await this.emailService.sendApiUsageNotification(user, data.client, data.threshold);

				case 'apiQuotaExceeded':
					return await this.emailService.sendApiQuotaExceededNotification(user, data.client);

				case 'monthlySummary':
					return await this.emailService.sendMonthlyUsageSummary(user, data);

				default:
					logger.warn(`Unknown email notification type: ${type}`);
					return { success: false, message: 'Unknown notification type' };
			}
		} catch (error) {
			logger.error(`Error sending email notification (${type}):`, error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Send push notification based on type
	 * @param {string} userId - User ID
	 * @param {string} type - Notification type
	 * @param {Object} data - Notification data
	 * @returns {Promise<Object>} - Push notification result
	 */
	async _sendPushNotification(userId, type, data) {
		try {
			let notification = {};

			switch (type) {
				case 'accountApproval':
					notification = {
						title: 'Account Approved',
						body: 'Your API service account has been approved. You can now start using our services.',
						data: {
							type: 'account_approval',
							clientId: data.client.clientId
						}
					};
					break;

				case 'accountStatus':
					notification = {
						title: `Account Status: ${data.status}`,
						body: `Your API service account status has been changed to ${data.status}.`,
						data: {
							type: 'account_status',
							status: data.status,
							clientId: data.client.clientId
						}
					};
					break;

				case 'apiUsage':
					notification = {
						title: 'API Usage Alert',
						body: `You've reached ${data.threshold}% of your monthly API quota.`,
						data: {
							type: 'api_usage',
							threshold: data.threshold,
							current: data.client.usageCount,
							quota: data.client.usageQuota
						}
					};
					break;

				case 'apiQuotaExceeded':
					notification = {
						title: 'API Quota Exceeded',
						body: 'You have reached your monthly API usage limit. API access is temporarily paused.',
						data: {
							type: 'api_quota_exceeded',
							resetDate: data.client.resetDate
						}
					};
					break;

				default:
					// Registration notifications are email-only, so we skip push for this type
					if (type !== 'registration' && type !== 'monthlySummary') {
						logger.warn(`Unknown push notification type: ${type}`);
					}
					return { success: false, message: 'Skipped or unknown notification type' };
			}

			return await this.pushService.sendNotification(userId, notification);
		} catch (error) {
			logger.error(`Error sending push notification (${type}):`, error);
			return { success: false, error: error.message };
		}
	}

	// ---- Convenience methods for different notification types ---- //

	/**
	 * Send registration notification
	 * @param {Object} user - User object
	 * @param {Object} client - Client object
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendRegistrationNotification(user, client) {
		return this.sendNotification(user.id, 'registration', { client });
	}

	/**
	 * Send account approval notification
	 * @param {Object} user - User object
	 * @param {Object} client - Client object
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendAccountApprovalNotification(user, client) {
		return this.sendNotification(user.id, 'accountApproval', { client });
	}

	/**
	 * Send account status change notification
	 * @param {Object} user - User object
	 * @param {Object} client - Client object
	 * @param {string} status - New status
	 * @param {string} reason - Reason for change
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendAccountStatusChangeNotification(user, client, status, reason) {
		return this.sendNotification(user.id, 'accountStatus', {
			client,
			status,
			reason
		});
	}

	/**
	 * Send API usage threshold notification
	 * @param {Object} user - User object
	 * @param {Object} client - Client object
	 * @param {number} threshold - Threshold percentage
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendApiUsageNotification(user, client, threshold) {
		return this.sendNotification(user.id, 'apiUsage', {
			client,
			threshold
		});
	}

	/**
	 * Send API quota exceeded notification
	 * @param {Object} user - User object
	 * @param {Object} client - Client object
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendApiQuotaExceededNotification(user, client) {
		return this.sendNotification(user.id, 'apiQuotaExceeded', { client });
	}

	/**
	 * Send monthly usage summary
	 * @param {Object} user - User object
	 * @param {Object} usageData - Usage data
	 * @returns {Promise<Object>} - Notification results
	 */
	async sendMonthlyUsageSummary(user, usageData) {
		return this.sendNotification(user.id, 'monthlySummary', usageData);
	}
}

module.exports = new UnifiedNotificationService();