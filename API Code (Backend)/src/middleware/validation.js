// src/middleware/validation.js
const logger = require('../utils/logger');

/**
 * Validate insights generation request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateInsightsRequest = (req, res, next) => {
  try {
    // Log the entire request body to see what's coming in
    console.log('Request Body:', JSON.stringify(req.body));
    
    // Log the specific query value
    console.log('Query value:', req.body.query);
    
    // Log the type of req.body to ensure it's an object
    console.log('Request body type:', typeof req.body);
    
    // Log the Content-Type header to verify proper JSON parsing
    console.log('Content-Type header:', req.headers['content-type']);
    
    const { query } = req.body;
    
    console.log('Extracted query:', query);
    console.log('Query type:', typeof query);
    
    if (!query) {
      console.log('Query validation failed: query is falsy');
      return res.status(400).json({
        success: false,
        message: 'Query is required to generate insights'
      });
    }
    
    // Optional: validate query length
    if (query.length < 5 || query.length > 500) {
      console.log(`Query length validation failed: ${query.length} characters`);
      return res.status(400).json({
        success: false,
        message: 'Query must be between 5 and 500 characters'
      });
    }
    
    console.log('Query validation passed successfully');
    next();
  } catch (error) {
    console.error('Validation error:', error);
    logger.error('Validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

/**
 * Validate login request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateLogin = (req, res, next) => {
  try {
    const { clientId, clientSecret, email, password } = req.body;
    
    // Allow either clientId/clientSecret or email/password
    if (email && password) {
      // Email/password login
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters'
        });
      }
    } else if (clientId && clientSecret) {
      // API credentials login - no additional validation needed
    } else {
      // Neither credential set is complete
      return res.status(400).json({
        success: false,
        message: 'Please provide either Client ID and Client Secret, or Email and Password'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Login validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

/**
 * Validate registration request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateRegister = (req, res, next) => {
  try {
    const { clientName, email, password, confirmPassword, description } = req.body;
    
    if (!clientName) {
      return res.status(400).json({
        success: false,
        message: 'Client Name is required'
      });
    }
    
    // Validate email if provided
    if (email) {
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }
    
    // Validate password if provided
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }
      
      // Confirm password match if both provided
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Registration validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  validateInsightsRequest,
  validateLogin,
  validateRegister
};