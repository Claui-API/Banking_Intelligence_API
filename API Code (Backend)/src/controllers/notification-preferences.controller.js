// src/controllers/notification-preferences.controller.js
const NotificationPreference = require('../models/NotificationPreference');
const logger = require('../utils/logger');

/**
 * Controller for managing user notification preferences
 */
class NotificationPreferencesController {
	/**
	 * Get notification preferences for a user
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getPreferences(req, res) {
		try {
			const { userId } = req.auth;

			// Get or create preferences for this user
			const preferences = await NotificationPreference.getOrCreateForUser(userId);

			return res.status(200).json({
				success: true,
				data: {
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
				}
			});
		} catch (error) {
			logger.error(`Error getting notification preferences: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve notification preferences'
			});
		}
	}

	/**
	 * Update notification preferences for a user
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async updatePreferences(req, res) {
		try {
			const { userId } = req.auth;
			const { email, push } = req.body;

			if (!email && !push) {
				return res.status(400).json({
					success: false,
					message: 'No preferences provided for update'
				});
			}

			// Get or create preferences for this user
			const preferences = await NotificationPreference.getOrCreateForUser(userId);

			// Update email preferences if provided
			if (email) {
				if (email.registration !== undefined) preferences.emailRegistration = !!email.registration;
				if (email.accountApproval !== undefined) preferences.emailAccountApproval = !!email.accountApproval;
				if (email.accountStatus !== undefined) preferences.emailAccountStatus = !!email.accountStatus;
				if (email.apiUsage !== undefined) preferences.emailApiUsage = !!email.apiUsage;
				if (email.apiQuotaExceeded !== undefined) preferences.emailApiQuotaExceeded = !!email.apiQuotaExceeded;
				if (email.monthlySummary !== undefined) preferences.emailMonthlySummary = !!email.monthlySummary;
				if (email.securityAlerts !== undefined) preferences.emailSecurityAlerts = !!email.securityAlerts;
			}

			// Update push preferences if provided
			if (push) {
				if (push.accountApproval !== undefined) preferences.pushAccountApproval = !!push.accountApproval;
				if (push.accountStatus !== undefined) preferences.pushAccountStatus = !!push.accountStatus;
				if (push.apiUsage !== undefined) preferences.pushApiUsage = !!push.apiUsage;
				if (push.apiQuotaExceeded !== undefined) preferences.pushApiQuotaExceeded = !!push.apiQuotaExceeded;
				if (push.securityAlerts !== undefined) preferences.pushSecurityAlerts = !!push.securityAlerts;
			}

			// Save changes
			await preferences.save();

			return res.status(200).json({
				success: true,
				message: 'Notification preferences updated successfully',
				data: {
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
				}
			});
		} catch (error) {
			logger.error(`Error updating notification preferences: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: 'Failed to update notification preferences'
			});
		}
	}

	/**
	 * Send a test notification
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async sendTestNotification(req, res) {
		try {
			const { userId } = req.auth;
			const { type, channel } = req.body;

			// Validate parameters
			const validTypes = ['registration', 'accountApproval', 'accountStatus', 'apiUsage', 'apiQuotaExceeded', 'monthlySummary', 'securityAlerts'];
			const validChannels = ['email', 'push', 'both'];

			if (!validTypes.includes(type)) {
				return res.status(400).json({
					success: false,
					message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
				});
			}

			if (!validChannels.includes(channel)) {
				return res.status(400).json({
					success: false,
					message: `Invalid channel. Must be one of: ${validChannels.join(', ')}`
				});
			}

			// Get user and client
			const { User, Client } = require('../models/User');
			const user = await User.findByPk(userId);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Get a client for this user
			const client = await Client.findOne({
				where: { userId }
			});

			if (!client) {
				return res.status(404).json({
					success: false,
					message: 'No client found for this user'
				});
			}

			// Create test data based on notification type
			let testData = {};
			switch (type) {
				case 'registration':
					testData = { client };
					break;
				case 'accountApproval':
					testData = { client };
					break;
				case 'accountStatus':
					testData = { client, status: 'active', reason: 'This is a test notification' };
					break;
				case 'apiUsage':
					testData = { client, threshold: 75 };
					break;
				case 'apiQuotaExceeded':
					testData = { client };
					break;
				case 'monthlySummary':
					testData = {
						client,
						previousUsage: Math.floor(client.usageQuota * 0.75),
						usagePercentage: 75,
						period: {
							start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
							end: new Date()
						},
						nextResetDate: new Date(client.resetDate)
					};
					break;
				case 'securityAlerts':
					testData = {
						activity: {
							timestamp: new Date(),
							ipAddress: req.ip || '127.0.0.1',
							description: 'Test security alert'
						}
					};
					break;
			}

			// Get notification service
			const notificationService = require('../services/notification.service.unified');

			// Override user preferences for this test
			const preferences = await NotificationPreference.getOrCreateForUser(userId);
			const originalPreferences = { ...preferences.toJSON() };

			// Temporarily modify preferences based on requested channel
			if (channel === 'email' || channel === 'both') {
				preferences.emailRegistration = type === 'registration';
				preferences.emailAccountApproval = type === 'accountApproval';
				preferences.emailAccountStatus = type === 'accountStatus';
				preferences.emailApiUsage = type === 'apiUsage';
				preferences.emailApiQuotaExceeded = type === 'apiQuotaExceeded';
				preferences.emailMonthlySummary = type === 'monthlySummary';
				preferences.emailSecurityAlerts = type === 'securityAlerts';
			} else {
				// Disable all email notifications
				preferences.emailRegistration = false;
				preferences.emailAccountApproval = false;
				preferences.emailAccountStatus = false;
				preferences.emailApiUsage = false;
				preferences.emailApiQuotaExceeded = false;
				preferences.emailMonthlySummary = false;
				preferences.emailSecurityAlerts = false;
			}

			if (channel === 'push' || channel === 'both') {
				preferences.pushAccountApproval = type === 'accountApproval';
				preferences.pushAccountStatus = type === 'accountStatus';
				preferences.pushApiUsage = type === 'apiUsage';
				preferences.pushApiQuotaExceeded = type === 'apiQuotaExceeded';
				preferences.pushSecurityAlerts = type === 'securityAlerts';
			} else {
				// Disable all push notifications
				preferences.pushAccountApproval = false;
				preferences.pushAccountStatus = false;
				preferences.pushApiUsage = false;
				preferences.pushApiQuotaExceeded = false;
				preferences.pushSecurityAlerts = false;
			}

			// Save temporary preferences
			await preferences.save();

			// Send test notification
			const result = await notificationService.sendNotification(userId, type, testData);

			// Restore original preferences
			await NotificationPreference.update(originalPreferences, { where: { id: preferences.id } });

			return res.status(200).json({
				success: true,
				message: `Test ${type} notification sent via ${channel}`,
				results: result
			});
		} catch (error) {
			logger.error(`Error sending test notification: ${error.message}`);
			return res.status(500).json({
				success: false,
				message: 'Failed to send test notification',
				error: error.message
			});
		}
	}
}

module.exports = new NotificationPreferencesController();