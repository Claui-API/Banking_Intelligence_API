// validation.js

/**
 * Validation middleware for API requests
 */

/**
 * Validate login request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateLogin = (req, res, next) => {
  const { clientId, clientSecret } = req.body;
  
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      message: 'Client ID and Client Secret are required'
    });
  }
  
  next();
};

/**
 * Validate registration request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateRegister = (req, res, next) => {
  const { clientName, description } = req.body;
  
  if (!clientName) {
    return res.status(400).json({
      success: false,
      message: 'Client Name is required'
    });
  }
  
  next();
};

/**
 * Validate insights generation request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateInsightsRequest = (req, res, next) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      message: 'Query is required to generate insights'
    });
  }
  
  // Optional: validate query length
  if (query.length < 5 || query.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Query must be between 5 and 200 characters'
    });
  }
  
  next();
};

module.exports = {
  validateLogin,
  validateRegister,
  validateInsightsRequest
};