// src/routes/health.routes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    let dbStatus = 'disconnected';
    try {
      await sequelize.authenticate();
      dbStatus = 'connected';
    } catch (dbError) {
      logger.error('Health check failed: Database not connected', dbError);
    }
    
    // Return success response with details
    return res.status(200).json({
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      details: {
        database: dbStatus,
        api: 'running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      details: {
        error: error.message
      }
    });
  }
});

module.exports = router;