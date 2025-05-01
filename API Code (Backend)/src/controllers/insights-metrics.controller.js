// src/controllers/insights-metrics.controller.js
const logger = require('../utils/logger');
const { 
  getSystemInsightMetrics, 
  getUserInsightMetrics, 
  getQueryTypeMetrics,
  getHistoricalInsightMetrics,
  initializeMetricsModel
} = require('../middleware/insights-metrics.middleware');
const { User } = require('../models/User');
const { sequelize } = require('../config/database');

/**
 * Controller for Insights metrics endpoints
 */
class InsightsMetricsController {
  /**
   * Get system-wide metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSystemMetrics(req, res) {
    try {
      // Check if user has admin role
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      
      // Get system metrics
      const metrics = await getSystemInsightMetrics();
      
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting system insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve system insight metrics',
        error: error.message
      });
    }
  }
  
  /**
   * Get historical metrics for system dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getHistoricalMetrics(req, res) {
    try {
      // Check if user has admin role
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      
      // Get days parameter from query, default to 7 days
      const days = parseInt(req.query.days) || 7;
      
      // Get historical metrics
      const historicalData = await getHistoricalInsightMetrics(days);
      
      return res.status(200).json({
        success: true,
        data: historicalData
      });
    } catch (error) {
      logger.error('Error getting historical insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve historical insight metrics',
        error: error.message
      });
    }
  }

  /**
   * Get per-user metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserMetrics(req, res) {
    try {
      // Check if user has admin role
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      
      // Get user metrics
      const metrics = await getUserInsightMetrics();
      
      // Enrich with user details
      const enrichedMetrics = [];
      
      for (const metric of metrics) {
        try {
          // Find user details
          const user = await User.findByPk(metric.userId);
          
          if (user) {
            enrichedMetrics.push({
              ...metric,
              name: user.clientName,
              email: user.email
            });
          } else {
            // Include metrics even if user details not found
            enrichedMetrics.push({
              ...metric,
              name: 'Unknown User',
              email: `${metric.userId.substring(0, 8)}...`
            });
          }
        } catch (userError) {
          logger.warn(`Error retrieving user details for ${metric.userId}:`, userError);
          
          // Include metrics even if user details not found
          enrichedMetrics.push({
            ...metric,
            name: 'Unknown User',
            email: `${metric.userId.substring(0, 8)}...`
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        data: enrichedMetrics
      });
    } catch (error) {
      logger.error('Error getting user insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user insight metrics',
        error: error.message
      });
    }
  }

  /**
   * Get query type distribution metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getQueryTypeMetrics(req, res) {
    try {
      // Check if user has admin role
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      
      // Get query type metrics
      const metrics = await getQueryTypeMetrics();
      
      // Transform into array format for easier front-end charting
      const formattedMetrics = Object.entries(metrics).map(([type, count]) => ({
        type,
        count,
        percentage: (count / Object.values(metrics).reduce((sum, val) => sum + val, 0) * 100).toFixed(1)
      }));
      
      return res.status(200).json({
        success: true,
        data: {
          distribution: metrics,
          formattedData: formattedMetrics
        }
      });
    } catch (error) {
      logger.error('Error getting query type metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve query type metrics',
        error: error.message
      });
    }
  }
}

module.exports = new InsightsMetricsController();