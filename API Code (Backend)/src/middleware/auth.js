// src/middleware/auth.js
const authService = require('../services/auth');
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