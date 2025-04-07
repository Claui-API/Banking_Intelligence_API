// health.routes.js
const express = require('express');
const router = express.Router();
const dbConnection = require('../utils/db-connection');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      logger.error('Health check failed: Database not connected');
      return res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        details: {
          database: 'disconnected',
          api: 'running'
        }
      });
    }
    
    // Try a simple database operation (read-only)
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    // Return success response with details
    return res.status(200).json({
      status: 'healthy',
      details: {
        database: 'connected',
        api: 'running',
        collections: collections.length,
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