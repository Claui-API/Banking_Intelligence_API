// controllers/notification.controller.js
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * In-memory storage for device tokens
 * In a production environment, this would be replaced with a database
 */
const deviceTokens = new Map();

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
      
      // Get user's devices or initialize empty array
      const userKey = `user-${userId}`;
      const userDevices = deviceTokens.get(userKey) || [];
      
      // Check if device token already exists
      const existingTokenIndex = userDevices.findIndex(device => device.token === token);
      
      if (existingTokenIndex >= 0) {
        // Update existing token
        userDevices[existingTokenIndex] = {
          ...userDevices[existingTokenIndex],
          lastSeen: new Date(),
          deviceInfo: { ...userDevices[existingTokenIndex].deviceInfo, ...deviceInfo }
        };
        
        logger.info(`Updated existing device token for user ${userId}`);
      } else {
        // Add new token
        userDevices.push({
          token,
          platform,
          deviceInfo,
          active: true,
          createdAt: new Date(),
          lastSeen: new Date(),
          id: `device-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
        });
        
        logger.info(`Registered new device token for user ${userId}`);
      }
      
      // Save updated devices
      deviceTokens.set(userKey, userDevices);
      
      // Get the device that was just added or updated
      const deviceToken = userDevices[existingTokenIndex >= 0 ? existingTokenIndex : userDevices.length - 1];
      
      return res.status(200).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          deviceId: deviceToken.id,
          platform: deviceToken.platform
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
      
      // Get user's devices
      const userKey = `user-${userId}`;
      const userDevices = deviceTokens.get(userKey) || [];
      
      // Find the device token
      const deviceIndex = userDevices.findIndex(device => device.token === token);
      
      if (deviceIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Device token not found'
        });
      }
      
      // Mark as inactive
      userDevices[deviceIndex].active = false;
      userDevices[deviceIndex].updatedAt = new Date();
      
      // Save updated devices
      deviceTokens.set(userKey, userDevices);
      
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
      
      // Store user preferences in memory
      // In a real implementation, you would save this to a persistent storage
      const preferencesKey = `preferences-${userId}`;
      const existingPreferences = deviceTokens.get(preferencesKey) || {};
      
      deviceTokens.set(preferencesKey, {
        ...existingPreferences,
        ...preferences,
        updatedAt: new Date()
      });
      
      logger.info(`Updated notification preferences for user ${userId}`);
      
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
      
      // Get user's active devices
      const userKey = `user-${userId}`;
      const userDevices = deviceTokens.get(userKey) || [];
      const activeDevices = userDevices.filter(device => device.active);
      
      if (activeDevices.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active devices found for this user'
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
      
      // Group devices by platform
      const androidTokens = activeDevices
        .filter(device => device.platform === 'android')
        .map(device => device.token);
        
      const iosTokens = activeDevices
        .filter(device => device.platform === 'ios')
        .map(device => device.token);
      
      // Send notifications
      const results = {
        android: { success: 0, failure: 0 },
        ios: { success: 0, failure: 0 }
      };
      
      if (androidTokens.length > 0) {
        try {
          // In a real implementation, this would use Firebase
          // For now, just simulate success
          results.android = {
            success: androidTokens.length,
            failure: 0
          };
          
          logger.info(`Sent test notification to ${androidTokens.length} Android devices`);
        } catch (error) {
          logger.error('Error sending Android notifications:', error);
          results.android = { success: 0, failure: androidTokens.length };
        }
      }
      
      if (iosTokens.length > 0) {
        try {
          // In a real implementation, this would use APN
          // For now, just simulate success
          results.ios = {
            success: iosTokens.length,
            failure: 0
          };
          
          logger.info(`Sent test notification to ${iosTokens.length} iOS devices`);
        } catch (error) {
          logger.error('Error sending iOS notifications:', error);
          results.ios = { success: 0, failure: iosTokens.length };
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Test notification sent',
        data: {
          devices: {
            android: androidTokens.length,
            ios: iosTokens.length
          },
          results
        }
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