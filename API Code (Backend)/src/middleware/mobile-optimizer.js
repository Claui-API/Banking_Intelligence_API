// middleware/mobile-optimizer.js
const logger = require('../utils/logger');

/**
 * Middleware to optimize API responses for mobile clients
 * - Detects mobile clients
 * - Applies compression
 * - Handles battery-saving optimizations
 */
const mobileOptimizer = (req, res, next) => {
  // Check if client is mobile based on user agent
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  
  // Add mobile flag to request object
  req.isMobile = isMobile;
  
  // Get client's battery status if provided (modern browsers can send this)
  const batteryStatus = req.headers['x-battery-status'];
  const lowBattery = batteryStatus === 'low';
  
  // Add optimization info to the request
  req.mobileOptimization = {
    isMobile,
    lowBattery,
    // Track bandwidth preference if client sends it
    lowBandwidth: req.headers['x-prefer-reduced-data'] === 'true',
    // Track client's cache settings
    clientCacheTime: parseInt(req.headers['x-cache-time'] || '0')
  };
  
  // Log mobile optimization settings
  logger.debug('Mobile optimization', req.mobileOptimization);
  
  // If it's a mobile client in low battery mode, adjust response strategy
  if (isMobile && lowBattery) {
    logger.info('Applying low battery optimizations for mobile client');
    
    // Override functions to provide more efficient responses
    res.sendOptimized = (data) => {
      // Simplify data for low battery situations
      const optimized = mobileOptimizationService.simplifyForLowBattery(data);
      return res.json(optimized);
    };
  } else if (isMobile) {
    // Standard mobile optimizations
    logger.debug('Applying standard mobile optimizations');
    
    // Add cache headers suitable for mobile
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  }
  
  // Continue with the request
  next();
};

// Simple service to optimize data
const mobileOptimizationService = {
  simplifyForLowBattery: (data) => {
    // Remove unnecessary nested objects
    // Remove detailed descriptions
    // Limit array lengths
    
    // This is a simplified example - you'd implement more comprehensive logic
    if (typeof data !== 'object' || data === null) return data;
    
    const result = Array.isArray(data) ? [] : {};
    
    // For arrays, limit length in low battery mode
    if (Array.isArray(data)) {
      return data.slice(0, 5); // Just take first 5 items
    }
    
    // For objects, simplify nested structures
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        
        // Skip large text fields to save battery on rendering
        if (typeof value === 'string' && value.length > 200) {
          result[key] = value.substring(0, 200) + '...';
        }
        // Limit nested arrays
        else if (Array.isArray(value)) {
          result[key] = value.slice(0, 3); // Just take first 3 items
        }
        // Keep primitive values as is
        else if (typeof value !== 'object' || value === null) {
          result[key] = value;
        }
        // Recursively simplify nested objects
        else {
          result[key] = mobileOptimizationService.simplifyForLowBattery(value);
        }
      }
    }
    
    return result;
  }
};

module.exports = mobileOptimizer;