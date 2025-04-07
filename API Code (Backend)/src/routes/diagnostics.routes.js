// routes/diagnostics.routes.js
const express = require('express');
const router = express.Router();
const ApiDiagnostics = require('../utils/api-diagnostics');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

/**
 * @route GET /api/diagnostics/cohere
 * @desc Run diagnostics for Cohere API
 * @access Private (admin only)
 */
router.get('/cohere', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }
    
    logger.info('Running Cohere API diagnostics');
    const results = await ApiDiagnostics.testCohereApi();
    
    return res.status(200).json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running Cohere API diagnostics:', error);
    return res.status(500).json({
      success: false,
      message: 'Diagnostics failed',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagnostics/network
 * @desc Check network connectivity to external services
 * @access Private (admin only)
 */
router.get('/network', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }
    
    logger.info('Running network connectivity tests');
    const results = await ApiDiagnostics.checkNetworkConnectivity();
    
    return res.status(200).json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running network diagnostics:', error);
    return res.status(500).json({
      success: false,
      message: 'Network diagnostics failed',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagnostics/env
 * @desc Check environment configuration (safe values only)
 * @access Private (admin only)
 */
router.get('/env', authMiddleware, (req, res) => {
  try {
    // Check if user has admin role
    if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }
    
    // Only include safe environment variables (no secrets or keys)
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || 3000,
      DB_TYPE: process.env.DB_TYPE || 'local',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      // Include flags for whether important variables are set or not
      COHERE_API_KEY: process.env.COHERE_API_KEY ? '✓ Set' : '✗ Not set',
      JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Not set',
      MONGODB_URI: process.env.MONGODB_URI ? '✓ Set' : '✗ Not set',
      PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID ? '✓ Set' : '✗ Not set',
      PLAID_SECRET: process.env.PLAID_SECRET ? '✓ Set' : '✗ Not set'
    };
    
    logger.info('Environment variables checked');
    
    return res.status(200).json({
      success: true,
      data: safeEnv,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking environment variables:', error);
    return res.status(500).json({
      success: false,
      message: 'Environment check failed',
      error: error.message
    });
  }
});

module.exports = router;