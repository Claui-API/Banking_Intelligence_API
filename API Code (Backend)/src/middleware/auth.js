// auth.js
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication middleware to validate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authMiddleware = (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
    
    // Add user info to request
    req.auth = {
      userId: decoded.clientId || decoded.userId, // Handle both client ID and user ID
      role: decoded.role
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

module.exports = authMiddleware;