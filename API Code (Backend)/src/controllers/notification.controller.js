// controllers/notification.controller.js
const notificationService = require('../services/notification.service');
const DeviceToken = require('../models/DeviceToken');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * Register a device for push notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async registerDevice(req, res) {
    try {
      const { userId } = req.auth;
      const { token, platform, deviceInfo } = req.body;
      
      if (!userId || !token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'User ID, device token, and platform are required'
        });
      }
      
      if (!['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({
          success: false,
          message: 'Platform must be one of: ios, android, web'
        });
      }
      
      const result = await notificationService.registerDevice(
        userId,
        token,
        platform,
        deviceInfo
      );
      
      return res.status(200).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          deviceId: result._id,
          platform: result.platform
        }
      });
    } catch (error) {
      logger.error('Error registering device:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register device'
      });
    }
  }
  
  /**
   * Unregister a device token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async unregisterDevice(req, res) {
    try {
      const { userId } = req.auth;
      const { token } = req.body;
      
      if (!userId || !token) {
        return res.status(400).json({
          success: false,
          message: 'User ID and device token are required'
        });
      }
      
      // Find the device token
      const deviceToken = await DeviceToken.findOne({ userId, token });
      
      if (!deviceToken) {
        return res.status(404).json({
          success: false,
          message: 'Device token not found'
        });
      }
      
      // Mark as inactive
      await deviceToken.deactivate();
      
      return res.status(200).json({
        success: true,
        message: 'Device unregistered successfully'
      });
    } catch (error) {
      logger.error('Error unregistering device:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unregister device'
      });
    }
  }
  
  /**
   * Update notification preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updatePreferences(req, res) {
    try {
      const { userId } = req.auth;
      const { preferences } = req.body;
      
      if (!userId || !preferences) {
        return res.status(400).json({
          success: false,
          message: 'User ID and preferences are required'
        });
      }
      
      // Update user preferences in the database
      // This would typically update your UserProfile model
      
      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences'
      });
    }
  }
  
  /**
   * Send a test notification (for debugging)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendTestNotification(req, res) {
    try {
      const { userId } = req.auth;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Only allow in development mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Test notifications are not allowed in production'
        });
      }
      
      // Send a test notification
      const notification = {
        title: 'Test Notification',
        body: 'This is a test notification from the API',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };
      
      const result = await notificationService.sendNotification(userId, notification);
      
      return res.status(200).json({
        success: true,
        message: 'Test notification sent',
        data: result
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send test notification'
      });
    }
  }
}

module.exports = new NotificationController();