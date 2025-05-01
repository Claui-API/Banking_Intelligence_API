// src/routes/insights-metrics.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const { 
  getSystemInsightMetrics,
  getHistoricalInsightMetrics,
  getUserInsightMetrics,
  getQueryTypeMetrics
} = require('../middleware/insights-metrics.middleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/insights/metrics/system
 * @desc Get system-wide insight metrics
 * @access Private (Admin only)
 */
router.get('/system', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    // Get real metrics data from the database
    const metricsData = await getSystemInsightMetrics();
    
    return res.status(200).json({
      success: true,
      data: metricsData
    });
  } catch (error) {
    logger.error('Error getting system metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get system metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights/metrics/history
 * @desc Get historical insight metrics
 * @access Private (Admin only)
 */
router.get('/history', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    // Get real historical metrics data from the database
    const historicalData = await getHistoricalInsightMetrics(days);
    
    return res.status(200).json({
      success: true,
      data: historicalData
    });
  } catch (error) {
    logger.error('Error getting historical metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get historical metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights/metrics/users
 * @desc Get per-user insight metrics
 * @access Private (Admin only)
 */
router.get('/users', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    // Parse enhanced option from query parameters
    const enhanced = req.query.enhanced === 'true';
    
    // Get real user metrics data from the database
    const userData = await getUserInsightMetrics();
    
    return res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    logger.error('Error getting user metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights/metrics/query-types
 * @desc Get query type distribution metrics
 * @access Private (Admin only)
 */
router.get('/query-types', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    // Get real query type distribution data from the database
    const queryTypeData = await getQueryTypeMetrics();
    
    // Transform into formatted data for frontend visualization
    const formattedData = Object.entries(queryTypeData).map(([type, count]) => {
      const total = Object.values(queryTypeData).reduce((sum, val) => sum + val, 0);
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      
      return {
        type,
        count,
        percentage
      };
    });
    
    return res.status(200).json({
      success: true,
      data: {
        distribution: queryTypeData,
        formattedData
      }
    });
  } catch (error) {
    logger.error('Error getting query type metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get query type metrics',
      error: error.message
    });
  }
});

module.exports = router;