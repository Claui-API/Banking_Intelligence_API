// src/services/twoFactor.service.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { User } = require('../models/User');

class TwoFactorService {
  /**
   * Generate a new secret key for 2FA
   * @param {Object} user - User object with email
   * @returns {Object} - Generated secret and QR code URL
   */
  async generateSecret(user) {
    try {
      // Generate a secret using speakeasy
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `Banking Intelligence API (${user.email})`
      });
      
      // Generate QR code URL for the secret
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
      
      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeUrl
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }
  
  /**
   * Verify a 2FA token
   * @param {string} token - Token to verify
   * @param {string} secret - User's secret key
   * @returns {boolean} - Whether the token is valid
   */
  verifyToken(token, secret) {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 1 period before and after current time for clock drift
      });
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }
  
  /**
   * Generate backup codes for 2FA
   * @returns {Array<string>} - Array of backup codes
   */
  generateBackupCodes() {
    try {
      const backupCodes = [];
      
      // Generate 10 backup codes
      for (let i = 0; i < 10; i++) {
        // Generate a random 8-character code
        const code = crypto.randomBytes(4).toString('hex');
        backupCodes.push(code);
      }
      
      return backupCodes;
    } catch (error) {
      logger.error('Error generating backup codes:', error);
      throw new Error('Failed to generate backup codes');
    }
  }
  
  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} secret - 2FA secret
   * @returns {boolean} - Success status
   */
  async enable2FA(userId, secret) {
    try {
      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      
      // Update user record
      const updated = await User.update(
        {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          backupCodes
        },
        { where: { id: userId } }
      );
      
      return updated[0] > 0;
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw new Error('Failed to enable 2FA');
    }
  }
  
  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @returns {boolean} - Success status
   */
  async disable2FA(userId) {
    try {
      // Update user record
      const updated = await User.update(
        {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: null
        },
        { where: { id: userId } }
      );
      
      return updated[0] > 0;
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw new Error('Failed to disable 2FA');
    }
  }
  
  /**
   * Verify a backup code and consume it if valid
   * @param {string} userId - User ID
   * @param {string} backupCode - Backup code to verify
   * @returns {boolean} - Whether the backup code is valid
   */
  async verifyBackupCode(userId, backupCode) {
    try {
      // Get user with backup codes
      const user = await User.findByPk(userId);
      
      if (!user || !user.backupCodes || !Array.isArray(user.backupCodes)) {
        return false;
      }
      
      // Check if the backup code exists
      const codeIndex = user.backupCodes.indexOf(backupCode);
      
      if (codeIndex === -1) {
        return false;
      }
      
      // Remove the used backup code
      const updatedBackupCodes = [...user.backupCodes];
      updatedBackupCodes.splice(codeIndex, 1);
      
      // Update user
      await User.update(
        { backupCodes: updatedBackupCodes },
        { where: { id: userId } }
      );
      
      return true;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  }
}

module.exports = new TwoFactorService();
