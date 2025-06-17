// src/routes/notification-preferences.routes.js
const express = require('express');
const router = express.Router();
const notificationPreferencesController = require('../controllers/notification-preferences.controller');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route GET /api/v1/notifications/preferences
 * @desc Get user notification preferences
 * @access Private
 */
router.get(
	'/preferences',
	authMiddleware,
	notificationPreferencesController.getPreferences
);

/**
 * @route PUT /api/v1/notifications/preferences
 * @desc Update user notification preferences
 * @access Private
 */
router.put(
	'/preferences',
	authMiddleware,
	notificationPreferencesController.updatePreferences
);

/**
 * @route POST /api/v1/notifications/test
 * @desc Send a test notification
 * @access Private
 */
router.post(
	'/test',
	authMiddleware,
	notificationPreferencesController.sendTestNotification
);

module.exports = router;