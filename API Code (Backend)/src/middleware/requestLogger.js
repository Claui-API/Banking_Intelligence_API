//requestLogger.js

/**
 * Middleware to log all incoming requests
 * @param {Object} logger - Winston logger instance
 * @returns {Function} Middleware function
 */
const requestLogger = (logger) => {
    return (req, res, next) => {
      // Generate a unique request ID
      const requestId = Math.random().toString(36).substring(2, 15);
      
      // Add request ID to request object for tracking
      req.requestId = requestId;
      
      // Log request details
      logger.info('Incoming request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Record start time
      const start = Date.now();
      
      // Log response when completed
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[logLevel]('Response sent', {
          requestId,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });
      });
      
      next();
    };
  };
  
  module.exports = requestLogger;