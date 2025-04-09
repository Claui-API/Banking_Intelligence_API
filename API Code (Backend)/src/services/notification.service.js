// services/notification.service.js
const admin = require('firebase-admin');
const apn = require('apn'); // Apple Push Notification
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.initialized = false;
    this.initializeServices();
  }
  
  async initializeServices() {
    try {
      // Initialize Firebase for Android
      if (process.env.FIREBASE_CREDENTIALS) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        
        logger.info('Firebase Admin SDK initialized for push notifications');
      }
      
      // Initialize APN for iOS
      if (process.env.APN_KEY_PATH && process.env.APN_KEY_ID && process.env.APN_TEAM_ID) {
        this.apnProvider = new apn.Provider({
          token: {
            key: process.env.APN_KEY_PATH,
            keyId: process.env.APN_KEY_ID,
            teamId: process.env.APN_TEAM_ID
          },
          production: process.env.NODE_ENV === 'production'
        });
        
        logger.info('APN provider initialized for iOS push notifications');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize notification services:', error);
      this.initialized = false;
    }
  }
  
  /**
   * Register a device token for push notifications
   * @param {string} userId - User ID
   * @param {string} token - Device token
   * @param {string} platform - 'ios' or 'android'
   * @param {Object} deviceInfo - Additional device information
   * @returns {Promise<Object>} - Saved device token record
   */
  async registerDevice(userId, token, platform, deviceInfo = {}) {
    try {
      // Find existing token or create new one
      let deviceToken = await DeviceToken.findOne({ userId, token });
      
      if (deviceToken) {
        // Update existing token
        deviceToken.lastSeen = new Date();
        deviceToken.deviceInfo = { ...deviceToken.deviceInfo, ...deviceInfo };
        await deviceToken.save();
        
        logger.info(`Updated existing device token for user ${userId}`);
        return deviceToken;
      } else {
        // Create new token
        deviceToken = new DeviceToken({
          userId,
          token,
          platform,
          deviceInfo,
          active: true,
          lastSeen: new Date()
        });
        
        await deviceToken.save();
        logger.info(`Registered new device token for user ${userId}`);
        return deviceToken;
      }
    } catch (error) {
      logger.error(`Error registering device token for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Send a push notification to a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - Notification results
   */
  async sendNotification(userId, notification) {
    try {
      if (!this.initialized) {
        await this.initializeServices();
        if (!this.initialized) {
          throw new Error('Notification services not initialized');
        }
      }
      
      // Get user's device tokens
      const deviceTokens = await DeviceToken.find({ userId, active: true });
      
      if (!deviceTokens || deviceTokens.length === 0) {
        logger.warn(`No active device tokens found for user ${userId}`);
        return { success: false, message: 'No active devices' };
      }
      
      const results = {
        android: { success: 0, failure: 0 },
        ios: { success: 0, failure: 0 }
      };
      
      // Process device tokens by platform
      const androidTokens = deviceTokens
        .filter(device => device.platform === 'android')
        .map(device => device.token);
        
      const iosTokens = deviceTokens
        .filter(device => device.platform === 'ios')
        .map(device => device.token);
      
      // Send to Android devices
      if (androidTokens.length > 0) {
        const androidResults = await this.sendToAndroid(androidTokens, notification);
        results.android = androidResults;
      }
      
      // Send to iOS devices
      if (iosTokens.length > 0) {
        const iosResults = await this.sendToIOS(iosTokens, notification);
        results.ios = iosResults;
      }
      
      logger.info(`Push notification results for user ${userId}:`, results);
      return {
        success: true,
        results
      };
    } catch (error) {
      logger.error(`Error sending push notification to user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Send notification to Android devices
   * @param {Array<string>} tokens - FCM tokens
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - FCM results
   */
  async sendToAndroid(tokens, notification) {
    try {
      if (!admin.messaging) {
        throw new Error('Firebase Admin SDK not initialized');
      }
      
      // Convert to FCM message format
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens: tokens
      };
      
      const response = await admin.messaging().sendMulticast(message);
      
      return {
        success: response.successCount,
        failure: response.failureCount
      };
    } catch (error) {
      logger.error('Error sending Android push notification:', error);
      return { success: 0, failure: tokens.length };
    }
  }
  
  /**
   * Send notification to iOS devices
   * @param {Array<string>} tokens - APN tokens
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - APN results
   */
  async sendToIOS(tokens, notification) {
    try {
      if (!this.apnProvider) {
        throw new Error('APN Provider not initialized');
      }
      
      // Convert to APN format
      const apnNotification = new apn.Notification();
      apnNotification.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      apnNotification.badge = notification.badge || 1;
      apnNotification.sound = "ping.aiff";
      apnNotification.alert = {
        title: notification.title,
        body: notification.body
      };
      apnNotification.payload = notification.data || {};
      
      const response = await this.apnProvider.send(apnNotification, tokens);
      
      return {
        success: response.sent.length,
        failure: response.failed.length
      };
    } catch (error) {
      logger.error('Error sending iOS push notification:', error);
      return { success: 0, failure: tokens.length };
    }
  }
  
  /**
   * Send a transaction alert notification
   * @param {string} userId - User ID
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} - Notification results
   */
  async sendTransactionAlert(userId, transaction) {
    const notification = {
      title: 'New Transaction',
      body: `${transaction.amount < 0 ? 'Spent' : 'Received'} $${Math.abs(transaction.amount).toFixed(2)} at ${transaction.description}`,
      data: {
        type: 'transaction',
        transactionId: transaction.transactionId,
        amount: transaction.amount.toString(),
        description: transaction.description
      }
    };
    
    return this.sendNotification(userId, notification);
  }
  
  /**
   * Send a low balance alert notification
   * @param {string} userId - User ID
   * @param {Object} account - Account data
   * @returns {Promise<Object>} - Notification results
   */
  async sendLowBalanceAlert(userId, account) {
    const notification = {
      title: 'Low Balance Alert',
      body: `Your ${account.name} account balance is below $${account.lowBalanceThreshold.toFixed(2)}`,
      data: {
        type: 'low_balance',
        accountId: account.accountId,
        balance: account.balance.toString(),
        accountName: account.name
      }
    };
    
    return this.sendNotification(userId, notification);
  }
}

module.exports = new NotificationService();