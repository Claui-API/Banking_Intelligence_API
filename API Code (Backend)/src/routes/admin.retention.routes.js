// src/routes/admin.retention.routes.js - Fixed for DELETE requests

const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const adminRetentionController = require('../controllers/admin.retention.controller');
const logger = require('../utils/logger');
const bodyParser = require('body-parser'); // Make sure this is available

// Check if all required controller methods exist
const controllerMethodCheck = () => {
	const requiredMethods = [
		'getPolicyStats',
		'updateUserRetentionSettings',
		'forceDeleteUser',
		'getAccountsMarkedForDeletion',
		'runRetentionAudit',
		'getRetentionLogs'
	];

	const missingMethods = [];

	for (const method of requiredMethods) {
		if (typeof adminRetentionController[method] !== 'function') {
			missingMethods.push(method);
			logger.error(`Missing controller method: adminRetentionController.${method}`);
		}
	}

	if (missingMethods.length > 0) {
		logger.error(`The following admin controller methods are missing: ${missingMethods.join(', ')}`);
	}
};

// Run the check
controllerMethodCheck();

// Add body parser middleware specifically for JSON
router.use(bodyParser.json());

// Log middleware to debug request body issues
router.use((req, res, next) => {
	if (req.method === 'DELETE') {
		logger.debug('DELETE request received:', {
			path: req.path,
			contentType: req.get('Content-Type'),
			hasBody: !!req.body,
			bodySize: req.body ? Object.keys(req.body).length : 0
		});
	}
	next();
});

// All routes require authentication and admin role
router.use(authMiddleware, authorize('admin'));

/**
 * @route GET /api/admin/retention/stats
 * @desc Get data retention policy statistics
 * @access Private (Admin only)
 */
router.get('/stats',
	typeof adminRetentionController.getPolicyStats === 'function'
		? adminRetentionController.getPolicyStats
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route PUT /api/admin/retention/users/:userId
 * @desc Update user data retention settings
 * @access Private (Admin only)
 */
router.put('/users/:userId',
	typeof adminRetentionController.updateUserRetentionSettings === 'function'
		? adminRetentionController.updateUserRetentionSettings
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route DELETE /api/admin/retention/users/:userId/force
 * @desc Force delete a user and all their data (emergency function)
 * @access Private (Admin only)
 */
router.delete('/users/:userId/force',
	typeof adminRetentionController.forceDeleteUser === 'function'
		? adminRetentionController.forceDeleteUser
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route GET /api/admin/retention/marked-for-deletion
 * @desc Get accounts marked for deletion
 * @access Private (Admin only)
 */
router.get('/marked-for-deletion',
	typeof adminRetentionController.getAccountsMarkedForDeletion === 'function'
		? adminRetentionController.getAccountsMarkedForDeletion
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route POST /api/admin/retention/audit
 * @desc Run retention policy audit manually
 * @access Private (Admin only)
 */
router.post('/audit',
	typeof adminRetentionController.runRetentionAudit === 'function'
		? adminRetentionController.runRetentionAudit
		: (req, res) => res.status(501).json({ success: false, message: "Method not implemented" })
);

/**
 * @route GET /api/admin/retention/logs
 * @desc Get retention logs
 * @access Private (Admin only)
 */
router.get('/logs',
	typeof adminRetentionController.getRetentionLogs === 'function'
		? adminRetentionController.getRetentionLogs
		: (req, res) => {
			logger.warn('getRetentionLogs not implemented in adminRetentionController, returning empty result');
			return res.status(200).json({
				success: true,
				data: {
					logs: [],
					pagination: {
						total: 0,
						page: 1,
						limit: 20,
						totalPages: 0
					}
				}
			});
		}
);

module.exports = router;