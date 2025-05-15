// src/routes/data-retention.routes.js - Fixed version with method check
const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const dataRetentionController = require('../controllers/data-retention.controller');
const { require2FA } = require('../middleware/auth');
const logger = require('../utils/logger');

// First check all methods exist before using them
const controllerMethodCheck = () => {
	// Log which methods are missing
	const requiredMethods = [
		'getRetentionSettings',
		'updateRetentionSettings',
		'requestAccountClosure',
		'cancelAccountClosure',
		'disconnectBankAccount',
		'exportUserData',
		'runManualCleanup',
		'getRetentionLogs'
	];

	const missingMethods = [];

	for (const method of requiredMethods) {
		if (typeof dataRetentionController[method] !== 'function') {
			missingMethods.push(method);
			logger.error(`Missing controller method: dataRetentionController.${method}`);
		}
	}

	if (missingMethods.length > 0) {
		logger.error(`The following controller methods are missing: ${missingMethods.join(', ')}`);
	}
};

// Run the check
controllerMethodCheck();

/**
 * @route GET /api/v1/data/retention-settings
 * @desc Get user's data retention settings
 * @access Private
 */
router.get('/retention-settings',
	authMiddleware,
	// Only use the method if it exists
	typeof dataRetentionController.getRetentionSettings === 'function'
		? dataRetentionController.getRetentionSettings
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route PUT /api/v1/data/retention-settings
 * @desc Update user's data retention settings
 * @access Private
 */
router.put('/retention-settings',
	authMiddleware,
	// Only use the method if it exists
	typeof dataRetentionController.updateRetentionSettings === 'function'
		? dataRetentionController.updateRetentionSettings
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route POST /api/v1/data/close-account
 * @desc Request account closure (initiates the data deletion process)
 * @access Private (requires 2FA verification)
 */
router.post('/close-account',
	authMiddleware,
	require2FA,
	// Only use the method if it exists
	typeof dataRetentionController.requestAccountClosure === 'function'
		? dataRetentionController.requestAccountClosure
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route POST /api/v1/data/cancel-closure
 * @desc Cancel a previously requested account closure (if within grace period)
 * @access Private
 */
router.post('/cancel-closure',
	authMiddleware,
	// Only use the method if it exists
	typeof dataRetentionController.cancelAccountClosure === 'function'
		? dataRetentionController.cancelAccountClosure
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route POST /api/v1/data/disconnect-bank/:itemId
 * @desc Disconnect a bank account (via Plaid itemId)
 * @access Private
 */
router.post('/disconnect-bank/:itemId',
	authMiddleware,
	// Only use the method if it exists
	typeof dataRetentionController.disconnectBankAccount === 'function'
		? dataRetentionController.disconnectBankAccount
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route GET /api/v1/data/export
 * @desc Export user's data (for data portability)
 * @access Private
 */
router.get('/export',
	authMiddleware,
	// Only use the method if it exists
	typeof dataRetentionController.exportUserData === 'function'
		? dataRetentionController.exportUserData
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route POST /api/v1/data/retention/cleanup
 * @desc Manually run data retention cleanup (admin only)
 * @access Private (Admin only)
 */
router.post('/retention/cleanup',
	authMiddleware,
	authorize('admin'),
	// Only use the method if it exists
	typeof dataRetentionController.runManualCleanup === 'function'
		? dataRetentionController.runManualCleanup
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route GET /api/v1/data/retention/logs
 * @desc View data retention logs (admin only)
 * @access Private (Admin only)
 */
router.get('/retention/logs',
	authMiddleware,
	authorize('admin'),
	// Only use the method if it exists
	typeof dataRetentionController.getRetentionLogs === 'function'
		? dataRetentionController.getRetentionLogs
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

module.exports = router;