// routes/notification.routes.js
const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/v1/notifications/register-device
 * @desc Register a device for push notifications
 * @access Private
 */
router.post('/register-device', authMiddleware, notificationController.registerDevice);

/**
 * @route POST /api/v1/notifications/unregister-device
 * @desc Unregister a device from push notifications
 * @access Private
 */
router.post('/unregister-device', authMiddleware, notificationController.unregisterDevice);

/**
 * @route PUT /api/v1/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
router.put('/preferences', authMiddleware, notificationController.updatePreferences);

/**
 * @route POST /api/v1/notifications/test
 * @desc Send a test notification (development only)
 * @access Private
 */
router.post('/test', authMiddleware, notificationController.sendTestNotification);

module.exports = router;