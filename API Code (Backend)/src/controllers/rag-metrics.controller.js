// src/controllers/rag-metrics.controller.js
const logger = require('../utils/logger');
const { 
  getSystemRagMetrics, 
  getUserRagMetrics, 
  getQueryTypeMetrics,
  initializeMetricsModel,
  getEnhancedUserRagMetrics
} = require('../middleware/rag-metrics.middleware');
const { User } = require('../models/User');
const { sequelize } = require('../config/database');

/**
 * Controller for RAG metrics endpoints
 */
class RagMetricsController {
  /**
   * Get system-wide RAG metrics
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
      const metrics = await getSystemRagMetrics();
      
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting system RAG metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve system RAG metrics',
        error: error.message
      });
    }
  }
  
  /**
   * Get per-user RAG metrics
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
      const metrics = await getUserRagMetrics();
      
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
      logger.error('Error getting user RAG metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user RAG metrics',
        error: error.message
      });
    }
  }
  
  /**
   * Get historical RAG metrics for system dashboard
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
      
      // Since we're working with a relative new table, we need to calculate
      // historical points based on the data we have
      const metricsModel = await initializeMetricsModel();
      
      if (!metricsModel) {
        return res.status(500).json({
          success: false,
          message: 'Metrics database not available'
        });
      }
      
      // Calculate start date
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get historical data grouped by day
      const results = await sequelize.query(`
        SELECT 
          DATE_TRUNC('day', "createdAt") as "date",
          COUNT(*) as "totalQueries",
          SUM(CASE WHEN "cachedResponse" = true THEN 1 ELSE 0 END) as "cachedQueries",
          SUM(CASE WHEN "cachedResponse" = false AND "usedRag" = true THEN 1 ELSE 0 END) as "directApiCalls"
        FROM "RagMetrics"
        WHERE "createdAt" >= :startDate
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY DATE_TRUNC('day', "createdAt") ASC
      `, { 
        replacements: { startDate: startDate.toISOString() },
        type: sequelize.QueryTypes.SELECT 
      });
      
      // Transform the results
      const historicalData = results.map(day => {
        const totalQueries = parseInt(day.totalQueries);
        const cachedQueries = parseInt(day.cachedQueries);
        const directApiCalls = parseInt(day.directApiCalls);
        
        const cacheHitRate = totalQueries > 0 
          ? ((cachedQueries / totalQueries) * 100).toFixed(1)
          : '0.0';
          
        const apiCallRate = totalQueries > 0 
          ? ((directApiCalls / totalQueries) * 100).toFixed(1)
          : '0.0';
          
        return {
          date: new Date(day.date).toISOString().split('T')[0],
          totalQueries,
          cachedQueries,
          directApiCalls,
          cacheHitRate,
          apiCallRate,
          estimatedApiSavings: (cachedQueries * 0.02).toFixed(2)
        };
      });
      
      // If we don't have enough data points, pad with empty days
      if (historicalData.length < days) {
        const existingDates = new Set(historicalData.map(day => day.date));
        
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateString = date.toISOString().split('T')[0];
          
          if (!existingDates.has(dateString)) {
            historicalData.push({
              date: dateString,
              totalQueries: 0,
              cachedQueries: 0,
              directApiCalls: 0,
              cacheHitRate: '0.0',
              apiCallRate: '0.0',
              estimatedApiSavings: '0.00'
            });
          }
        }
        
        // Sort by date
        historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
      }
      
      return res.status(200).json({
        success: true,
        data: historicalData
      });
    } catch (error) {
      logger.error('Error getting historical RAG metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve historical RAG metrics',
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

  /**
   * Get per-user RAG metrics
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
      
      // Check if enhanced metrics are requested
      const useEnhancedMetrics = req.query.enhanced === 'true';
      
      // Get user metrics using the appropriate function
      const metrics = useEnhancedMetrics ? 
        await getEnhancedUserRagMetrics() : 
        await getUserRagMetrics();
      
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
        data: enrichedMetrics,
        enhanced: useEnhancedMetrics
      });
    } catch (error) {
      logger.error('Error getting user RAG metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user RAG metrics',
        error: error.message
      });
    }
  }
}

module.exports = new RagMetricsController();