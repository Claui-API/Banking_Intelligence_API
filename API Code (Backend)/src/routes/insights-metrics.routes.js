// routes/insights-metrics.routes.js - UPDATED VERSION
const express = require('express');
const { authMiddleware, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const adminOnly = [authMiddleware, authorize('admin')];

/**
 * @route GET /api/insights-metrics/system
 * @desc Get system-wide insight metrics
 * @access Private (Admin only)
 */
router.get('/system', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.getSystemMetrics(req, res);
  } catch (error) {
    logger.error('Error in system metrics route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get system metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights-metrics/history
 * @desc Get historical insight metrics
 * @access Private (Admin only)
 */
router.get('/history', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.getHistoricalMetrics(req, res);
  } catch (error) {
    logger.error('Error in historical metrics route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get historical metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights-metrics/users
 * @desc Get enhanced user metrics (now fast with caching)
 * @access Private (Admin only)
 */
router.get('/users', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.getUserMetrics(req, res);
  } catch (error) {
    logger.error('Error in user metrics route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user metrics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights-metrics/query-types
 * @desc Get query type distribution metrics
 * @access Private (Admin only)
 */
router.get('/query-types', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.getQueryTypeMetrics(req, res);
  } catch (error) {
    logger.error('Error in query type metrics route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get query type metrics',
      error: error.message
    });
  }
});

/**
 * @route POST /api/insights-metrics/trigger-analysis
 * @desc Manually trigger user analysis
 * @access Private (Admin only)
 */
router.post('/trigger-analysis', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.triggerUserAnalysis(req, res);
  } catch (error) {
    logger.error('Error in trigger analysis route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger analysis',
      error: error.message
    });
  }
});

/**
 * @route GET /api/insights-metrics/analysis-status
 * @desc Get background analysis status
 * @access Private (Admin only)
 */
router.get('/analysis-status', adminOnly, async (req, res) => {
  try {
    const insightsMetricsController = require('../controllers/insights-metrics.controller');
    return await insightsMetricsController.getAnalysisStatus(req, res);
  } catch (error) {
    logger.error('Error in analysis status route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get analysis status',
      error: error.message
    });
  }
});

/**
 * Error handling middleware for this router
 */
router.use((error, req, res, next) => {
  logger.error('Insights Metrics Route Error:', error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error in insights metrics',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
  });
});

module.exports = router;