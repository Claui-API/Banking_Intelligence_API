// src/routes/diagnostics.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

/**
 * @route GET /api/diagnostics/database
 * @desc Check database status
 * @access Private (admin only)
 */
router.get('/database', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }
    
    // Check database connection
    let connectionStatus = 'disconnected';
    try {
      await sequelize.authenticate();
      connectionStatus = 'connected';
    } catch (dbError) {
      logger.error('Database connection test failed:', dbError);
    }
    
    // Get database stats
    const stats = {
      connectionStatus,
      timestamp: new Date().toISOString()
    };
    
    if (connectionStatus === 'connected') {
      try {
        // Get model counts
        const models = sequelize.models;
        const modelCounts = {};
        
        for (const [modelName, model] of Object.entries(models)) {
          try {
            const count = await model.count();
            modelCounts[modelName] = count;
          } catch (countError) {
            modelCounts[modelName] = 'Error';
            logger.error(`Error counting ${modelName}:`, countError);
          }
        }
        
        stats.models = modelCounts;
      } catch (statsError) {
        logger.error('Error getting database stats:', statsError);
        stats.error = statsError.message;
      }
    }
    
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error checking database status:', error);
    return res.status(500).json({
      success: false,
      message: 'Database diagnostics failed',
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
      DB_HOST: process.env.DB_HOST ? '✓ Set' : '✗ Not set',
      DB_NAME: process.env.DB_NAME ? '✓ Set' : '✗ Not set',
      DB_USER: process.env.DB_USER ? '✓ Set' : '✗ Not set',
      DB_PASSWORD: process.env.DB_PASSWORD ? '✓ Set' : '✗ Not set',
      JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Not set',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? '✓ Set' : '✗ Not set',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : '✗ Not set',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Not set'
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

/**
 * @route GET /api/diagnostics/app
 * @desc Get application diagnostics
 * @access Private (admin only)
 */
router.get('/app', authMiddleware, (req, res) => {
  try {
    // Check if user has admin role
    if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }
    
    // Get application diagnostics
    const appInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString()
    };
    
    logger.info('Application diagnostics checked');
    
    return res.status(200).json({
      success: true,
      data: appInfo
    });
  } catch (error) {
    logger.error('Error getting application diagnostics:', error);
    return res.status(500).json({
      success: false,
      message: 'Application diagnostics failed',
      error: error.message
    });
  }
});

module.exports = router;