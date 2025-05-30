// src/middleware/retention-logging.middleware.js
const logger = require('../utils/logger');

/**
 * Middleware to log data retention related events
 */
const retentionLoggingMiddleware = (sequelize) => {
	return async (req, res, next) => {
		// Store original response methods
		const originalSend = res.send;
		const originalJson = res.json;
		const originalEnd = res.end;

		// Track if this request involves data-retention related operations
		let isRetentionRelated = false;

		// Check if the route is related to data retention
		if (req.path.includes('/api/v1/data/')) {
			isRetentionRelated = true;
		}

		// Intercept response methods to log retention-related activities
		if (isRetentionRelated) {
			// Override res.send
			res.send = function (data) {
				logRetentionActivity(req, res, data);
				return originalSend.apply(res, arguments);
			};

			// Override res.json
			res.json = function (data) {
				logRetentionActivity(req, res, data);
				return originalJson.apply(res, arguments);
			};

			// Override res.end
			res.end = function (data) {
				if (data) {
					logRetentionActivity(req, res, data);
				}
				return originalEnd.apply(res, arguments);
			};
		}

		next();
	};

	/**
	 * Helper function to log retention-related activity
	 */
	async function logRetentionActivity(req, res, data) {
		try {
			// Parse the data if it's a string
			let responseData = data;
			if (typeof data === 'string') {
				try {
					responseData = JSON.parse(data);
				} catch (e) {
					// Not JSON, ignore parsing
					return;
				}
			}

			const userId = req.auth?.userId;
			const action = determineRetentionAction(req);

			if (!action || !userId) {
				return;
			}

			// Skip logging if the response is an error
			if (res.statusCode >= 400) {
				return;
			}

			// Log to retention log if model exists
			if (sequelize.models.RetentionLog) {
				await sequelize.models.RetentionLog.create({
					action,
					details: {
						userId,
						method: req.method,
						path: req.path,
						statusCode: res.statusCode
					},
					timestamp: new Date()
				});
			}

			logger.info(`Retention action logged: ${action}`, {
				userId,
				method: req.method,
				path: req.path
			});
		} catch (error) {
			logger.error('Error logging retention activity:', error);
			// Don't block the response due to logging errors
		}
	}

	/**
	 * Determine the retention action based on the request
	 */
	function determineRetentionAction(req) {
		const { method, path } = req;

		if (method === 'POST' && path.includes('/close-account')) {
			return 'account_closure_initiated';
		}

		if (method === 'POST' && path.includes('/cancel-closure')) {
			return 'account_closure_cancelled';
		}

		if (method === 'POST' && path.includes('/disconnect-bank')) {
			return 'bank_account_disconnected';
		}

		if (method === 'GET' && path.includes('/export')) {
			return 'user_data_exported';
		}

		return null;
	}
};

module.exports = retentionLoggingMiddleware;