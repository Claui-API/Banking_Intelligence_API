// src/middleware/auth.js
const authService = require('../services/auth');
const { Client, User } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication middleware to validate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = await authService.verifyToken(token, 'access');

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    // Add user info to request
    req.auth = {
      userId: decoded.userId,
      email: decoded.email,
      clientId: decoded.clientId,
      role: decoded.role || 'user',
      twoFactorEnabled: decoded.twoFactorEnabled || false  // Add 2FA status
    };

    // Admin users bypass client status checks
    if (req.auth.role === 'admin') {
      logger.info(`Admin authenticated: ${req.auth.userId}`);
      return next();
    }

    // For regular users, verify client approval status
    if (req.auth.clientId) {
      const client = await Client.findOne({
        where: {
          clientId: req.auth.clientId
        }
      });

      if (!client) {
        return res.status(401).json({
          success: false,
          message: 'Invalid client credentials.'
        });
      }

      if (client.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Client access is ${client.status}. Please contact the administrator for approval.`
        });
      }

      // Check usage quota
      if (client.usageCount >= client.usageQuota) {
        return res.status(429).json({
          success: false,
          message: 'Usage quota exceeded. Please contact the administrator for an increase.',
          resetDate: client.resetDate
        });
      }

      // Increment usage count
      client.usageCount += 1;
      client.lastUsedAt = new Date();
      await client.save();

      // Add client details to request
      req.client = client;
    }

    logger.info(`Authenticated request for user: ${req.auth.userId}`);

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {Array|String} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient privileges.'
      });
    }

    next();
  };
};

/**
 * Require 2FA to be enabled for certain routes
 * @returns {Function} Middleware function
 */
const require2FA = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin users are exempt from this requirement
    if (req.auth.role === 'admin') {
      return next();
    }

    // Check if user has 2FA enabled
    const user = await User.findByPk(req.auth.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication is required for this operation. Please enable 2FA in your account settings.'
      });
    }

    next();
  } catch (error) {
    logger.error('2FA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify 2FA requirement'
    });
  }
};

module.exports = {
  authMiddleware,
  authorize,
  require2FA
};