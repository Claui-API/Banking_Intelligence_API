// src/middleware/auth.js
const authService = require('../services/auth');
const { Client } = require('../models/User');
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
      role: decoded.role || 'user'
    };
    
    // If this is not an admin, verify client approval status
    if (req.auth.role !== 'admin' && req.auth.clientId) {
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
 * API token middleware to validate API tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const apiTokenMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No API token provided.'
      });
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = await authService.verifyToken(token, 'api');
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired API token.'
      });
    }
    
    // Add user info to request
    req.auth = {
      userId: decoded.userId,
      clientId: decoded.clientId,
      isApiRequest: true
    };
    
    // Verify client approval status
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
    
    logger.info(`API request authenticated for client: ${req.auth.clientId}`);
    
    next();
  } catch (error) {
    logger.error('API authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid API token.'
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

module.exports = {
  authMiddleware,
  apiTokenMiddleware,
  authorize
};