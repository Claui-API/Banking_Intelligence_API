// src/middleware/insights-metrics.middleware.js
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// Initialize metrics storage
let InsightMetricsModel;

// Initialize metrics model
const initializeMetricsModel = async () => {
  try {
    if (!InsightMetricsModel) {
      // Define the model
      InsightMetricsModel = sequelize.define('InsightMetrics', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        queryId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        query: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        queryType: {
          type: DataTypes.STRING,
          allowNull: false
        },
        responseTime: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        success: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      });
      
      // Sync the model with the database
      await InsightMetricsModel.sync();
      logger.info('Insight Metrics model synchronized');
    }
    
    return InsightMetricsModel;
  } catch (error) {
    logger.error('Error initializing Insight Metrics model:', error);
    return null;
  }
};

// In-memory storage as fallback when database is not available
const inMemoryMetrics = {
  total: 0,
  success: 0,
  failed: 0,
  byUser: new Map(),
  byQueryType: new Map()
};

/**
 * Middleware to track insight metrics
 */
const insightMetricsMiddleware = async (req, res, next) => {
  // Add logging here - INSIDE the function
  logger.info(`Processing request: ${req.method} ${req.path}`);
  
  // Check if this is an insights generation request
  if (req.path === '/api/insights/generate' && req.method === 'POST') {
    // Log that we're intercepting this request
    const fullPath = `${req.baseUrl || ''}${req.path}`;
    logger.info(`Insight Metrics: Intercepting API call ${req.method} ${fullPath}`);
    
    // Store original write and end methods
    const originalWrite = res.write;
    const originalEnd = res.end;
    
    let buffers = [];
    
    // Override write
    res.write = function(chunk) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return originalWrite.apply(res, arguments);
    };
    
    // Override end
    res.end = function(chunk) {
      if (chunk) {
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      
      // Combine all collected chunks
      const body = Buffer.concat(buffers).toString('utf8');
      logger.info(`Insight Metrics: Captured response body (${body.length} bytes)`);
      
      try {
        const responseBody = JSON.parse(body);
        logger.info('Insight Metrics: Successfully parsed JSON response');
        
        // Now process the metrics with the parsed body
        processInsightMetrics(req, responseBody, res.statusCode);
      } catch (error) {
        logger.error(`Insight Metrics: Error parsing response JSON: ${error.message}`);
      }
      
      // Call the original end without the monkey-patched version to avoid recursion
      return originalEnd.apply(res, arguments);
    };
  }
  
  next();
};

// Function to process metrics from the response
async function processInsightMetrics(req, responseBody, statusCode) {
  try {
    if (responseBody && responseBody.data) {
      const insightData = responseBody.data;
      const userId = req.auth?.userId;
      const query = req.body?.query;
      const queryType = req.body?.queryType || classifyQuery(query);
      const requestId = req.body?.requestId || `req_${Date.now()}`;
      
      logger.info(`Insight Metrics: Processing metrics for userId ${userId}, query "${query}"`);
      
      // Extract the metrics we need
      const success = statusCode >= 200 && statusCode < 300 && responseBody.success === true;
      const responseTime = insightData.processingTime || 
                         (insightData.insights && insightData.insights.processingTime) ||
                         0;
      const errorMessage = !success ? (responseBody.message || 'Unknown error') : null;
      
      // Log detailed information about the extracted metrics
      logger.info(`Insight Metrics: Extracted data - success: ${success}, responseTime: ${responseTime}ms`, {
        statusCode,
        requestId,
        queryType
      });
      
      // Now store in database
      await storeMetricsInDatabase(userId, requestId, query, queryType, success, responseTime, errorMessage);
      
      // Update in-memory stats (fallback)
      inMemoryMetrics.total++;
      if (success) {
        inMemoryMetrics.success++;
      } else {
        inMemoryMetrics.failed++;
      }
      
      // Update by user
      if (userId) {
        if (!inMemoryMetrics.byUser.has(userId)) {
          inMemoryMetrics.byUser.set(userId, { total: 0, success: 0, failed: 0 });
        }
        
        const userStats = inMemoryMetrics.byUser.get(userId);
        userStats.total++;
        if (success) {
          userStats.success++;
        } else {
          userStats.failed++;
        }
      }
      
      // Update by query type
      if (queryType) {
        if (!inMemoryMetrics.byQueryType.has(queryType)) {
          inMemoryMetrics.byQueryType.set(queryType, 0);
        }
        
        inMemoryMetrics.byQueryType.set(
          queryType, 
          inMemoryMetrics.byQueryType.get(queryType) + 1
        );
      }
    } else {
      logger.warn('Insight Metrics: Response not suitable for metrics collection', {
        hasResponseBody: !!responseBody,
        hasSuccess: !!(responseBody && responseBody.success),
        hasData: !!(responseBody && responseBody.data)
      });
    }
  } catch (error) {
    logger.error(`Insight Metrics: Error processing metrics: ${error.message}`, {
      stack: error.stack
    });
  }
}

// Function to store metrics in database
async function storeMetricsInDatabase(userId, requestId, query, queryType, success, responseTime, errorMessage = null) {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (metricsModel) {
      logger.info(`Insight Metrics: Attempting to store metrics with ID ${requestId}`, {
        userId,
        queryId: requestId,
        queryType: queryType || 'unknown',
        success,
        responseTime
      });
      
      // Create the metrics record
      const record = await metricsModel.create({
        id: uuidv4(),
        userId,
        queryId: requestId,
        query: query || 'Unknown query',
        queryType: queryType || 'unknown',
        responseTime,
        success,
        errorMessage
      });
      
      logger.info(`Insight Metrics: Successfully stored metrics with ID ${record.id}`);
    } else {
      logger.warn('Insight Metrics: Metrics model initialization failed, using in-memory storage only');
    }
  } catch (error) {
    logger.error(`Insight Metrics: Database storage error: ${error.message}`, {
      name: error.name,
      stack: error.stack,
      code: error.code
    });
    
    // Try to identify common issues
    if (error.name === 'SequelizeUniqueConstraintError') {
      logger.warn(`Insight Metrics: Duplicate queryId - ${requestId} already exists in database`);
    } else if (error.name === 'SequelizeDatabaseError') {
      logger.error('Insight Metrics: Database error - check connection settings and table schema');
    }
  }
}

// Helper function to classify queries
function classifyQuery(query) {
  if (!query) return 'financial';
  
  const normalizedQuery = query.toString().trim().toLowerCase();
  
  if (/^(hi|hello|hey|howdy)/i.test(normalizedQuery)) {
    return 'greeting';
  }
  
  if (/joke|funny/i.test(normalizedQuery)) {
    return 'joke';
  }
  
  if (/budget/i.test(normalizedQuery)) {
    return 'budgeting';
  }
  
  if (/spend/i.test(normalizedQuery)) {
    return 'spending';
  }
  
  if (/save|saving/i.test(normalizedQuery)) {
    return 'saving';
  }
  
  if (/invest/i.test(normalizedQuery)) {
    return 'investing';
  }
  
  if (/debt|loan|mortgage/i.test(normalizedQuery)) {
    return 'debt';
  }
  
  return 'financial';
}

/**
 * Get system-wide insight metrics
 * @returns {Object} Insight metrics
 */
const getSystemInsightMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      // Fall back to in-memory metrics
      logger.warn('Using in-memory metrics as fallback');
      
      return {
        totalQueries: inMemoryMetrics.total,
        successfulQueries: inMemoryMetrics.success,
        failedQueries: inMemoryMetrics.failed,
        successRate: inMemoryMetrics.total > 0 
          ? `${((inMemoryMetrics.success / inMemoryMetrics.total) * 100).toFixed(1)}%` 
          : '0.0%',
        avgResponseTime: 0,
        timestamp: new Date().toISOString()
      };
    }
    
    // Get total counts
    const totalQueries = await metricsModel.count();
    const successfulQueries = await metricsModel.count({ where: { success: true } });
    const failedQueries = await metricsModel.count({ where: { success: false } });
    
    // Get average response time
    const avgResponse = await metricsModel.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('responseTime')), 'avgTime']
      ]
    });
    const avgResponseTime = avgResponse ? parseInt(avgResponse.getDataValue('avgTime')) || 0 : 0;
    
    // Get today's queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayQueries = await metricsModel.count({
      where: {
        createdAt: {
          [sequelize.Op.gte]: today
        }
      }
    });
    
    // Get min and max response times
    const minResponse = await metricsModel.findOne({
      attributes: [
        [sequelize.fn('MIN', sequelize.col('responseTime')), 'minTime']
      ],
      where: {
        responseTime: {
          [sequelize.Op.gt]: 0
        }
      }
    });
    const minResponseTime = minResponse ? parseInt(minResponse.getDataValue('minTime')) || 0 : 0;
    
    const maxResponse = await metricsModel.findOne({
      attributes: [
        [sequelize.fn('MAX', sequelize.col('responseTime')), 'maxTime']
      ]
    });
    const maxResponseTime = maxResponse ? parseInt(maxResponse.getDataValue('maxTime')) || 0 : 0;
    
    // Get query type distribution
    const queryTypeDistribution = await getQueryTypeMetrics();
    
    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      successRate: totalQueries > 0 
        ? `${((successfulQueries / totalQueries) * 100).toFixed(1)}%` 
        : '0.0%',
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      todayQueries,
      queryTypeDistribution,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting system insight metrics:', error);
    
    // Fall back to in-memory metrics
    return {
      totalQueries: inMemoryMetrics.total,
      successfulQueries: inMemoryMetrics.success,
      failedQueries: inMemoryMetrics.failed,
      successRate: inMemoryMetrics.total > 0 
        ? `${((inMemoryMetrics.success / inMemoryMetrics.total) * 100).toFixed(1)}%` 
        : '0.0%',
      avgResponseTime: 0,
      todayQueries: 0,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get historical insight metrics for admin dashboard
 * @param {number} days - Number of days to look back
 * @returns {Array} Historical metrics
 */
const getHistoricalInsightMetrics = async (days = 7) => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      logger.warn('Using empty array as fallback for historical metrics');
      return [];
    }
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get historical data grouped by day
    const results = await sequelize.query(`
      SELECT 
        DATE_TRUNC('day', "createdAt") as "date",
        COUNT(*) as "totalQueries",
        AVG("responseTime") as "avgResponseTime",
        SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) as "successfulQueries",
        SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) as "failedQueries"
      FROM "InsightMetrics"
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
      const successfulQueries = parseInt(day.successfulQueries);
      const failedQueries = parseInt(day.failedQueries);
      
      return {
        date: new Date(day.date).toISOString().split('T')[0],
        totalQueries,
        successfulQueries,
        failedQueries,
        successRate: totalQueries > 0 
          ? ((successfulQueries / totalQueries) * 100).toFixed(1)
          : '0.0',
        avgResponseTime: parseInt(day.avgResponseTime) || 0,
        responseTime: parseInt(day.avgResponseTime) || 0,
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
            successfulQueries: 0,
            failedQueries: 0,
            successRate: '0.0',
            avgResponseTime: 0,
            responseTime: 0
          });
        }
      }
      
      // Sort by date
      historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    return historicalData;
  } catch (error) {
    logger.error('Error getting historical insight metrics:', error);
    return [];
  }
};

/**
 * Get per-user insight metrics
 * @returns {Array} User metrics
 */
const getUserInsightMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      // Fall back to in-memory metrics
      logger.warn('Using in-memory metrics as fallback for user metrics');
      
      // Convert in-memory map to array
      const userMetricsArray = [];
      
      for (const [userId, metrics] of inMemoryMetrics.byUser.entries()) {
        userMetricsArray.push({
          userId,
          queryCount: metrics.total,
          successCount: metrics.success,
          failedCount: metrics.failed,
          successRate: metrics.total > 0 
            ? `${((metrics.success / metrics.total) * 100).toFixed(1)}` 
            : '0.0',
          avgResponseTime: 0
        });
      }
      
      return userMetricsArray;
    }
    
    // Query for user metrics using sequelize
    const results = await sequelize.query(`
      SELECT 
        "userId",
        COUNT(*) as "queryCount",
        SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) as "successCount",
        SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) as "failedCount",
        AVG("responseTime") as "avgResponseTime",
        MAX("createdAt") as "lastActive"
      FROM "InsightMetrics"
      GROUP BY "userId"
    `, { type: sequelize.QueryTypes.SELECT });
    
    // Calculate additional metrics
    const userMetrics = await Promise.all(results.map(async (record) => {
      const userId = record.userId;
      
      // Get most common query type for this user
      const queryTypes = await sequelize.query(`
        SELECT 
          "queryType",
          COUNT(*) as "count"
        FROM "InsightMetrics"
        WHERE "userId" = :userId
        GROUP BY "queryType"
        ORDER BY "count" DESC
        LIMIT 1
      `, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });
      
      const mostCommonQueryType = queryTypes.length > 0 
        ? queryTypes[0].queryType 
        : 'unknown';
      
      // Get recent queries for this user
      const recentQueries = await metricsModel.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Convert to simple objects
      const recentQueriesData = recentQueries.map(query => query.get({ plain: true }));
      
      // Calculate success rate
      const queryCount = parseInt(record.queryCount);
      const successCount = parseInt(record.successCount);
      const successRate = queryCount > 0 
        ? ((successCount / queryCount) * 100).toFixed(1)
        : '0.0';
      
      return {
        userId,
        queryCount,
        successCount,
        failedCount: parseInt(record.failedCount),
        avgResponseTime: parseInt(record.avgResponseTime) || 0,
        successRate,
        lastActive: record.lastActive,
        mostCommonQueryType,
        recentQueries: recentQueriesData,
        // Add mock data for activity charts (in a real implementation, this would come from the database)
        activityByHour: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
        activityByDay: Array(7).fill(0).map(() => Math.floor(Math.random() * 8))
      };
    }));
    
    return userMetrics;
  } catch (error) {
    logger.error('Error getting user insight metrics:', error);
    
    // Fall back to in-memory metrics
    const userMetricsArray = [];
    
    for (const [userId, metrics] of inMemoryMetrics.byUser.entries()) {
      userMetricsArray.push({
        userId,
        queryCount: metrics.total,
        successCount: metrics.success,
        failedCount: metrics.failed,
        successRate: metrics.total > 0 
          ? `${((metrics.success / metrics.total) * 100).toFixed(1)}` 
          : '0.0',
        avgResponseTime: 0,
        lastActive: new Date(),
        mostCommonQueryType: 'unknown',
        recentQueries: []
      });
    }
    
    return userMetricsArray;
  }
};

/**
 * Get query type distribution metrics
 * @returns {Object} Query type distribution
 */
const getQueryTypeMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      // Fall back to in-memory metrics
      logger.warn('Using in-memory metrics as fallback for query type metrics');
      
      const queryTypeMetrics = {};
      for (const [type, count] of inMemoryMetrics.byQueryType.entries()) {
        queryTypeMetrics[type] = count;
      }
      
      return queryTypeMetrics;
    }
    
    // Query for query type distribution
    const results = await sequelize.query(`
      SELECT 
        "queryType",
        COUNT(*) as "count"
      FROM "InsightMetrics"
      GROUP BY "queryType"
    `, { type: sequelize.QueryTypes.SELECT });
    
    // Format results
    const queryTypeMetrics = {};
    results.forEach(result => {
      queryTypeMetrics[result.queryType] = parseInt(result.count);
    });
    
    return queryTypeMetrics;
  } catch (error) {
    logger.error('Error getting query type metrics:', error);
    
    // Fall back to in-memory metrics
    const queryTypeMetrics = {};
    for (const [type, count] of inMemoryMetrics.byQueryType.entries()) {
      queryTypeMetrics[type] = count;
    }
    
    return queryTypeMetrics;
  }
};

// Export the middleware and utility functions
module.exports = {
  insightMetricsMiddleware,
  getSystemInsightMetrics,
  getUserInsightMetrics,
  getHistoricalInsightMetrics,
  getQueryTypeMetrics,
  initializeMetricsModel
};