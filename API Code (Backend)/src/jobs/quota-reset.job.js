// src/jobs/quota-reset.job.js
const { Client, User } = require('../models/User');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Reset notification thresholds for a client
 * @param {string} clientId - Client ID
 * @returns {Promise<void>}
 */
const resetClientNotificationThresholds = async (clientId) => {
	try {
		const client = await Client.findOne({ where: { clientId } });
		if (client) {
			// Reset the lastNotifiedThreshold to 0
			client.lastNotifiedThreshold = 0;
			await client.save();
			logger.info(`Reset notification thresholds for client ${clientId}`);
		}
	} catch (error) {
		logger.error(`Failed to reset notification thresholds for client ${clientId}:`, error);
	}
};

/**
 * Job to reset usage quotas at the start of a new billing cycle
 */
const resetQuotasJob = async () => {
	try {
		logger.info('Starting monthly quota reset job');

		// Get current date
		const now = new Date();

		// Find clients due for reset
		const clients = await Client.findAll({
			where: {
				status: 'active',
				resetDate: {
					[Op.lte]: now
				}
			},
			include: [{ model: User }]
		});

		logger.info(`Found ${clients.length} clients due for quota reset`);

		for (const client of clients) {
			try {
				// Store previous usage for reporting
				const previousUsage = client.usageCount;
				const usagePercentage = Math.floor((previousUsage / client.usageQuota) * 100);

				// Store last reset date
				client.lastResetDate = client.resetDate || new Date();

				// Reset usage count
				client.usageCount = 0;

				// Calculate next reset date (usually 1 month from now)
				const nextResetDate = new Date();
				nextResetDate.setMonth(nextResetDate.getMonth() + 1);
				nextResetDate.setDate(1); // First day of next month
				nextResetDate.setHours(0, 0, 0, 0);
				client.resetDate = nextResetDate;

				// Reset notification threshold directly here instead of using external function
				client.lastNotifiedThreshold = 0;

				// Save changes
				await client.save();

				logger.info(`Reset quota for client ${client.clientId}: ${previousUsage} → 0, next reset on ${nextResetDate.toISOString()}`);

				// Send usage report if user exists and unified notification service is available
				if (client.User) {
					try {
						// Try to get the unified notification service
						const notificationService = require('../services/notification.service.unified');

						// Create monthly usage summary data
						const usageSummaryData = {
							client,
							previousUsage,
							usagePercentage,
							period: {
								start: client.lastResetDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Fallback to 30 days ago
								end: now
							},
							nextResetDate
						};

						// Send the monthly summary notification
						await notificationService.sendMonthlyUsageSummary(client.User, usageSummaryData);
						logger.info(`Sent monthly usage summary for client ${client.clientId}`);
					} catch (notificationError) {
						// If notification service isn't available or fails, log and continue
						logger.error(`Failed to send monthly usage summary for client ${client.clientId}:`, notificationError);
					}
				}
			} catch (error) {
				logger.error(`Failed to reset quota for client ${client.clientId}:`, error);
				// Continue with next client
			}
		}

		logger.info('Completed monthly quota reset job');
		return { success: true, count: clients.length };
	} catch (error) {
		logger.error('Error running quota reset job:', error);
		throw error;
	}
};

module.exports = {
	resetQuotasJob,
	resetClientNotificationThresholds
};