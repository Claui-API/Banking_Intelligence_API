// src/middleware/usage-notification.middleware.js
const { User, Client } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Define notification thresholds (percentages)
 */
const THRESHOLDS = [25, 50, 75, 90, 95];

/**
 * Save client changes safely, handling both Sequelize models and plain objects
 * @param {Object} client - Client object or model
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
const saveClientSafely = async (client, updates) => {
	try {
		// Check if client is a Sequelize model with a save method
		if (client && typeof client.save === 'function') {
			// Apply updates
			Object.keys(updates).forEach(key => {
				client[key] = updates[key];
			});

			// Save the model
			await client.save();
		} else if (client && client.clientId) {
			// If it's a plain object with clientId, do a direct update
			await Client.update(updates, {
				where: { clientId: client.clientId }
			});

			// Update the object in memory too
			Object.keys(updates).forEach(key => {
				client[key] = updates[key];
			});
		} else {
			logger.warn('Cannot save client changes: invalid client object');
		}
	} catch (error) {
		logger.error(`Error saving client changes: ${error.message}`);
		throw error;
	}
};

/**
 * Middleware to monitor API usage and trigger notifications
 * This should be applied after the auth middleware
 */
const usageNotificationMiddleware = async (req, res, next) => {
	try {
		// Skip if no client in request (happens for admin routes or non-API routes)
		if (!req.client || !req.auth || !req.auth.userId) {
			return next();
		}

		// Get the client from the request (added by auth middleware)
		const client = req.client;

		// Calculate current usage percentage
		const usagePercentage = Math.floor((client.usageCount / client.usageQuota) * 100);

		// Get the user associated with this client
		const user = await User.findByPk(req.auth.userId);
		if (!user) {
			logger.error(`User not found for notification: ${req.auth.userId}`);
			return next();
		}

		// Initialize lastNotifiedThreshold if not exists
		if (client.lastNotifiedThreshold === undefined) {
			try {
				// Add to the model if it doesn't exist (fallback logic)
				await saveClientSafely(client, { lastNotifiedThreshold: 0 });
			} catch (error) {
				// Log but continue
				logger.error(`Failed to initialize lastNotifiedThreshold: ${error.message}`);
			}
		}

		// Check if we've crossed any notification thresholds
		for (const threshold of THRESHOLDS) {
			if (usagePercentage >= threshold && client.lastNotifiedThreshold < threshold) {
				try {
					// Update the last notified threshold
					await saveClientSafely(client, { lastNotifiedThreshold: threshold });

					// Attempt to send notification
					try {
						// Try to get the notification service
						const notificationService = require('../services/notification.service.unified');

						// Send threshold notification asynchronously
						notificationService.sendApiUsageNotification(user, client, threshold)
							.catch(error => {
								logger.error(`Failed to send usage threshold notification: ${error.message}`);
							});

						logger.info(`Usage threshold ${threshold}% notification triggered for client ${client.clientId}`);
					} catch (notificationError) {
						logger.error(`Error loading notification service: ${notificationError.message}`);
					}

					// Only send one notification at a time (the highest threshold crossed)
					break;
				} catch (updateError) {
					logger.error(`Failed to update threshold notification: ${updateError.message}`);
					// Continue with next threshold
				}
			}
		}

		// Check for quota exceeded (should be redundant with auth middleware, but good as a backup)
		if (client.usageCount >= client.usageQuota && client.lastNotifiedThreshold < 100) {
			try {
				// Update the last notified threshold
				await saveClientSafely(client, { lastNotifiedThreshold: 100 });

				// Attempt to send notification
				try {
					// Try to get the notification service
					const notificationService = require('../services/notification.service.unified');

					// Send quota exceeded notification asynchronously
					notificationService.sendApiQuotaExceededNotification(user, client)
						.catch(error => {
							logger.error(`Failed to send quota exceeded notification: ${error.message}`);
						});

					logger.info(`Quota exceeded notification triggered for client ${client.clientId}`);
				} catch (notificationError) {
					logger.error(`Error loading notification service: ${notificationError.message}`);
				}
			} catch (updateError) {
				logger.error(`Failed to update quota exceeded notification: ${updateError.message}`);
			}
		}

		// Continue with the request
		next();
	} catch (error) {
		logger.error('Error in usage notification middleware:', error);
		// Don't block the request if notification fails
		next();
	}
};

/**
 * Reset notification thresholds for a client
 * @param {string} clientId - Client ID to reset
 * @returns {Promise<void>}
 */
const resetNotificationThresholds = async (clientId) => {
	try {
		const client = await Client.findOne({ where: { clientId } });
		if (client) {
			await saveClientSafely(client, { lastNotifiedThreshold: 0 });
			logger.info(`Reset notification thresholds for client ${clientId}`);
		}
	} catch (error) {
		logger.error(`Failed to reset notification thresholds for client ${clientId}:`, error);
	}
};

module.exports = {
	usageNotificationMiddleware,
	resetNotificationThresholds
};