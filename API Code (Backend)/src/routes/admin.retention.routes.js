// src/routes/admin.retention.routes.js - Enhanced with proper DELETE handling and logging

const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const adminRetentionController = require('../controllers/admin.retention.controller');
const logger = require('../utils/logger');
const bodyParser = require('body-parser');

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
		logger.error(`The following admin retention controller methods are missing: ${missingMethods.join(', ')}`);
	} else {
		logger.info('All required admin retention controller methods are available');
	}
};

// Run the controller method check
controllerMethodCheck();

// Add body parser middleware specifically for JSON - must be before auth middleware
router.use(bodyParser.json({ limit: '10mb' }));
router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging middleware for debugging request body issues
router.use((req, res, next) => {
	if (req.method === 'DELETE') {
		logger.debug('DELETE request received on retention routes:', {
			path: req.path,
			originalUrl: req.originalUrl,
			contentType: req.get('Content-Type'),
			contentLength: req.get('Content-Length'),
			hasBody: !!req.body,
			bodyKeys: req.body ? Object.keys(req.body) : [],
			bodySize: req.body ? Object.keys(req.body).length : 0,
			rawBody: JSON.stringify(req.body).substring(0, 500) // First 500 chars for debugging
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
		: (req, res) => {
			logger.warn('getPolicyStats not implemented in adminRetentionController');
			res.status(501).json({
				success: false,
				message: "Data retention policy stats method not implemented"
			});
		}
);

/**
 * @route PUT /api/admin/retention/users/:userId
 * @desc Update user data retention settings
 * @access Private (Admin only)
 */
router.put('/users/:userId',
	typeof adminRetentionController.updateUserRetentionSettings === 'function'
		? adminRetentionController.updateUserRetentionSettings
		: (req, res) => {
			logger.warn('updateUserRetentionSettings not implemented in adminRetentionController');
			res.status(501).json({
				success: false,
				message: "Update user retention settings method not implemented"
			});
		}
);

/**
 * @route DELETE /api/admin/retention/users/:userId/force
 * @desc Force delete a user and all their data (emergency function)
 * @access Private (Admin only)
 */
router.delete('/users/:userId/force',
	typeof adminRetentionController.forceDeleteUser === 'function'
		? (req, res, next) => {
			// Additional logging for force delete requests
			logger.info('Force delete user request initiated:', {
				userId: req.params.userId,
				adminId: req.auth?.userId,
				adminEmail: req.auth?.userEmail,
				requestBody: req.body,
				timestamp: new Date().toISOString()
			});
			adminRetentionController.forceDeleteUser(req, res, next);
		}
		: (req, res) => {
			logger.error('forceDeleteUser not implemented in adminRetentionController');
			res.status(501).json({
				success: false,
				message: "Force delete user method not implemented"
			});
		}
);

/**
 * @route GET /api/admin/retention/marked-for-deletion
 * @desc Get accounts marked for deletion
 * @access Private (Admin only)
 */
router.get('/marked-for-deletion',
	typeof adminRetentionController.getAccountsMarkedForDeletion === 'function'
		? adminRetentionController.getAccountsMarkedForDeletion
		: (req, res) => {
			logger.warn('getAccountsMarkedForDeletion not implemented in adminRetentionController');
			res.status(501).json({
				success: false,
				message: "Get accounts marked for deletion method not implemented"
			});
		}
);

/**
 * @route POST /api/admin/retention/audit
 * @desc Run retention policy audit manually
 * @access Private (Admin only)
 */
router.post('/audit',
	typeof adminRetentionController.runRetentionAudit === 'function'
		? (req, res, next) => {
			logger.info('Manual retention audit initiated by admin:', {
				adminId: req.auth?.userId,
				adminEmail: req.auth?.userEmail,
				timestamp: new Date().toISOString()
			});
			adminRetentionController.runRetentionAudit(req, res, next);
		}
		: (req, res) => {
			logger.warn('runRetentionAudit not implemented in adminRetentionController');
			res.status(501).json({
				success: false,
				message: "Run retention audit method not implemented"
			});
		}
);

/**
 * @route GET /api/admin/retention/logs
 * @desc Get retention logs with pagination and filtering
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
						page: parseInt(req.query.page) || 1,
						limit: parseInt(req.query.limit) || 20,
						totalPages: 0
					}
				},
				message: 'Retention logs feature not yet implemented'
			});
		}
);

/**
 * @route GET /api/admin/retention/users/:userId/data
 * @desc Get user's data retention information
 * @access Private (Admin only)
 */
router.get('/users/:userId/data', (req, res) => {
	// This could be implemented to show what data exists for a user
	logger.info('User data inspection request:', {
		userId: req.params.userId,
		adminId: req.auth?.userId
	});

	res.status(501).json({
		success: false,
		message: 'User data inspection not yet implemented'
	});
});

/**
 * Error handling middleware for retention routes
 */
router.use((error, req, res, next) => {
	logger.error('Error in admin retention routes:', {
		error: error.message,
		stack: error.stack,
		path: req.path,
		method: req.method,
		userId: req.params?.userId,
		adminId: req.auth?.userId
	});

	res.status(error.status || 500).json({
		success: false,
		message: error.message || 'An error occurred processing the retention request',
		...(process.env.NODE_ENV === 'development' && { stack: error.stack })
	});
});

module.exports = router;