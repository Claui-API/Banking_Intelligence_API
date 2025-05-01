// src/middleware/rag-metrics.middleware.js
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Initialize metrics storage
let RagMetricsModel;

// Initialize metrics model
const initializeMetricsModel = async () => {
  try {
    if (!RagMetricsModel) {
      // Define the model
      RagMetricsModel = sequelize.define('RagMetrics', {
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
        usedRag: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        cachedResponse: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        processingTime: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        documentCount: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        documentIds: {
          type: DataTypes.ARRAY(DataTypes.UUID),
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      });
      
      // Sync the model with the database
      await RagMetricsModel.sync();
      logger.info('RAG Metrics model synchronized');
    }
    
    return RagMetricsModel;
  } catch (error) {
    logger.error('Error initializing RAG Metrics model:', error);
    return null;
  }
};

// In-memory storage as fallback when database is not available
const inMemoryMetrics = {
  total: 0,
  cached: 0,
  direct: 0,
  byUser: new Map(),
  byQueryType: new Map()
};

/**
 * Middleware to track RAG metrics
 */
const ragMetricsMiddleware = async (req, res, next) => {
  // Add logging here - INSIDE the function
  logger.info(`Processing request: ${req.method} ${req.path}`);
  
  // Check if this is an insights generation request
  if (req.path === '/api/insights/generate' && req.method === 'POST') {
    // Log that we're intercepting this request
    const fullPath = `${req.baseUrl || ''}${req.path}`;
    logger.info(`RAG Metrics: Intercepting API call ${req.method} ${fullPath}`);
    
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
      logger.info(`RAG Metrics: Captured response body (${body.length} bytes)`);
      
      try {
        const responseBody = JSON.parse(body);
        logger.info('RAG Metrics: Successfully parsed JSON response');
        
        // Now process the metrics with the parsed body
        processMetrics(req, responseBody);
      } catch (error) {
        logger.error(`RAG Metrics: Error parsing response JSON: ${error.message}`);
      }
      
      // Call the original end without the monkey-patched version to avoid recursion
      return originalEnd.apply(res, arguments);
    };
  }
  
  next();
};

// Function to process metrics from the response
async function processMetrics(req, responseBody) {
  try {
    if (responseBody && responseBody.success && responseBody.data) {
      const ragData = responseBody.data;
      const userId = req.auth?.userId;
      const query = req.body?.query;
      const queryType = req.body?.queryType || classifyQuery(query);
      const requestId = req.body?.requestId || `req_${Date.now()}`;
      
      logger.info(`RAG Metrics: Processing metrics for userId ${userId}, query "${query}"`);
      
      // Extract the metrics we need
      const usedRag = ragData.ragEnabled !== false;
      
      // Check multiple places for fromCache flag
      const cachedResponse = 
        ragData.fromCache === true || 
        (ragData.insights && ragData.insights.fromCache === true) ||
        (ragData.insights && typeof ragData.insights.insight === 'string' && 
         ragData.insights.insight.includes("Cache hit"));
      
      // Log detailed information about the extracted flags
      logger.info(`RAG Metrics: Extracted flags - usedRag: ${usedRag}, cachedResponse: ${cachedResponse}`, {
        ragDataKeys: Object.keys(ragData),
        insightsKeys: ragData.insights ? Object.keys(ragData.insights) : [],
        hasFromCacheTopLevel: 'fromCache' in ragData,
        hasFromCacheInsights: ragData.insights && 'fromCache' in ragData.insights,
        fromCacheTopValue: ragData.fromCache,
        fromCacheInsightsValue: ragData.insights?.fromCache,
        insightText: typeof ragData.insights?.insight === 'string' ? 
          `${ragData.insights.insight.substring(0, 50)}...` : 'not a string'
      });
      
      // Now store in database
      await storeMetricsInDatabase(userId, requestId, query, queryType, usedRag, cachedResponse, ragData);
      
      // Update in-memory stats (fallback)
      inMemoryMetrics.total++;
      if (cachedResponse) {
        inMemoryMetrics.cached++;
      } else if (usedRag) {
        inMemoryMetrics.direct++;
      }
      
      // Update by user
      if (userId) {
        if (!inMemoryMetrics.byUser.has(userId)) {
          inMemoryMetrics.byUser.set(userId, { total: 0, cached: 0, direct: 0 });
        }
        
        const userStats = inMemoryMetrics.byUser.get(userId);
        userStats.total++;
        if (cachedResponse) {
          userStats.cached++;
        } else if (usedRag) {
          userStats.direct++;
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
      logger.warn('RAG Metrics: Response not suitable for metrics collection', {
        hasResponseBody: !!responseBody,
        hasSuccess: !!(responseBody && responseBody.success),
        hasData: !!(responseBody && responseBody.data)
      });
    }
  } catch (error) {
    logger.error(`RAG Metrics: Error processing metrics: ${error.message}`, {
      stack: error.stack
    });
  }
}

// Function to store metrics in database
async function storeMetricsInDatabase(userId, requestId, query, queryType, usedRag, cachedResponse, ragData) {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (metricsModel) {
      const processingTime = ragData.processingTime || null;
      const documentCount = 
        ragData.documentsUsed || 
        (ragData.insights && ragData.insights.documentsUsed) || null;
        
      const documentIds = 
        ragData.documentIds || 
        (ragData.insights && ragData.insights.documentIds) || null;
      
      logger.info(`RAG Metrics: Attempting to store metrics with ID ${requestId}`, {
        userId,
        queryId: requestId,
        queryType: queryType || 'unknown',
        usedRag,
        cachedResponse,
        processingTime,
        documentCount: documentCount || 0
      });
      
      // Create the metrics record
      const record = await metricsModel.create({
        userId,
        queryId: requestId,
        query: query || 'Unknown query',
        queryType: queryType || 'unknown',
        usedRag,
        cachedResponse,
        processingTime,
        documentCount,
        documentIds
      });
      
      logger.info(`RAG Metrics: Successfully stored metrics with ID ${record.id}`);
    } else {
      logger.warn('RAG Metrics: Metrics model initialization failed, using in-memory storage only');
    }
  } catch (error) {
    logger.error(`RAG Metrics: Database storage error: ${error.message}`, {
      name: error.name,
      stack: error.stack,
      code: error.code
    });
    
    // Try to identify common issues
    if (error.name === 'SequelizeUniqueConstraintError') {
      logger.warn(`RAG Metrics: Duplicate queryId - ${requestId} already exists in database`);
    } else if (error.name === 'SequelizeDatabaseError') {
      logger.error('RAG Metrics: Database error - check connection settings and table schema');
    }
  }
}

// Helper function to classify queries (simplified version)
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
 * Get RAG metrics for system dashboard
 * @returns {Object} RAG metrics
 */
const getSystemRagMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      // Fall back to in-memory metrics
      logger.warn('Using in-memory metrics as fallback');
      
      return {
        totalQueries: inMemoryMetrics.total,
        cachedQueries: inMemoryMetrics.cached,
        directApiCalls: inMemoryMetrics.direct,
        cacheHitRate: inMemoryMetrics.total > 0 
          ? `${((inMemoryMetrics.cached / inMemoryMetrics.total) * 100).toFixed(1)}%` 
          : '0.0%',
        apiCallRate: inMemoryMetrics.total > 0 
          ? `${((inMemoryMetrics.direct / inMemoryMetrics.total) * 100).toFixed(1)}%` 
          : '0.0%',
        estimatedApiSavings: inMemoryMetrics.cached * 0.02,
        timestamp: new Date().toISOString()
      };
    }
    
    // Get total counts
    const totalQueries = await metricsModel.count();
    const cachedQueries = await metricsModel.count({ where: { cachedResponse: true } });
    const directApiCalls = await metricsModel.count({ 
      where: { 
        cachedResponse: false,
        usedRag: true 
      } 
    });
    
    return {
      totalQueries,
      cachedQueries,
      directApiCalls,
      cacheHitRate: totalQueries > 0 
        ? `${((cachedQueries / totalQueries) * 100).toFixed(1)}%` 
        : '0.0%',
      apiCallRate: totalQueries > 0 
        ? `${((directApiCalls / totalQueries) * 100).toFixed(1)}%` 
        : '0.0%',
      estimatedApiSavings: cachedQueries * 0.02,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting system RAG metrics:', error);
    
    // Fall back to in-memory metrics
    return {
      totalQueries: inMemoryMetrics.total,
      cachedQueries: inMemoryMetrics.cached,
      directApiCalls: inMemoryMetrics.direct,
      cacheHitRate: inMemoryMetrics.total > 0 
        ? `${((inMemoryMetrics.cached / inMemoryMetrics.total) * 100).toFixed(1)}%` 
        : '0.0%',
      apiCallRate: inMemoryMetrics.total > 0 
        ? `${((inMemoryMetrics.direct / inMemoryMetrics.total) * 100).toFixed(1)}%` 
        : '0.0%',
      estimatedApiSavings: inMemoryMetrics.cached * 0.02,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get per-user RAG metrics for admin dashboard
 * @returns {Array} User metrics
 */
const getUserRagMetrics = async () => {
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
          cachedCount: metrics.cached,
          directApiCount: metrics.direct,
          cacheHitRate: metrics.total > 0 
            ? `${((metrics.cached / metrics.total) * 100).toFixed(1)}` 
            : '0.0',
          costSavings: (metrics.cached * 0.02).toFixed(2)
        });
      }
      
      return userMetricsArray;
    }
    
    // Query for user metrics using sequelize
    const results = await sequelize.query(`
      SELECT 
        "userId",
        COUNT(*) as "queryCount",
        SUM(CASE WHEN "cachedResponse" = true THEN 1 ELSE 0 END) as "cachedCount",
        SUM(CASE WHEN "cachedResponse" = false AND "usedRag" = true THEN 1 ELSE 0 END) as "directApiCount"
      FROM "RagMetrics"
      GROUP BY "userId"
    `, { type: sequelize.QueryTypes.SELECT });
    
    // Calculate additional metrics
    return results.map(record => ({
      userId: record.userId,
      queryCount: parseInt(record.queryCount),
      cachedCount: parseInt(record.cachedCount),
      directApiCount: parseInt(record.directApiCount),
      cacheHitRate: parseInt(record.queryCount) > 0 
        ? ((parseInt(record.cachedCount) / parseInt(record.queryCount)) * 100).toFixed(1) 
        : '0.0',
      costSavings: (parseInt(record.cachedCount) * 0.02).toFixed(2)
    }));
  } catch (error) {
    logger.error('Error getting user RAG metrics:', error);
    
    // Fall back to in-memory metrics
    const userMetricsArray = [];
    
    for (const [userId, metrics] of inMemoryMetrics.byUser.entries()) {
      userMetricsArray.push({
        userId,
        queryCount: metrics.total,
        cachedCount: metrics.cached,
        directApiCount: metrics.direct,
        cacheHitRate: metrics.total > 0 
          ? `${((metrics.cached / metrics.total) * 100).toFixed(1)}` 
          : '0.0',
        costSavings: (metrics.cached * 0.02).toFixed(2)
      });
    }
    
    return userMetricsArray;
  }
};

/**
 * Get enhanced per-user RAG metrics with detailed analytics
 * @returns {Array} Detailed user metrics
 */
const getEnhancedUserRagMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    
    if (!metricsModel) {
      logger.warn('Using in-memory metrics as fallback for enhanced user metrics');
      return convertInMemoryUserMetrics();
    }
    
    // Get all queries with detailed information
    const queries = await metricsModel.findAll({
      attributes: [
        'userId', 
        'queryType', 
        'usedRag', 
        'cachedResponse', 
        'processingTime',
        'createdAt',
        'query'
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Group queries by user
    const userMetricsMap = new Map();
    
    queries.forEach(query => {
      const userId = query.userId;
      
      if (!userMetricsMap.has(userId)) {
        userMetricsMap.set(userId, {
          userId,
          queryCount: 0,
          cachedCount: 0,
          directApiCount: 0,
          avgProcessingTime: 0,
          totalProcessingTime: 0,
          lastActive: null,
          queryTypes: {},
          recentQueries: [],
          activityByHour: Array(24).fill(0),
          activityByDay: Array(7).fill(0)
        });
      }
      
      const userStats = userMetricsMap.get(userId);
      
      // Update basic counts
      userStats.queryCount++;
      if (query.cachedResponse) {
        userStats.cachedCount++;
      } else if (query.usedRag) {
        userStats.directApiCount++;
      }
      
      // Update processing time metrics
      if (query.processingTime) {
        userStats.totalProcessingTime += query.processingTime;
        userStats.avgProcessingTime = userStats.totalProcessingTime / userStats.queryCount;
      }
      
      // Update query type distribution
      const queryType = query.queryType || 'unknown';
      userStats.queryTypes[queryType] = (userStats.queryTypes[queryType] || 0) + 1;
      
      // Track recent activity
      const createdAt = new Date(query.createdAt);
      if (!userStats.lastActive || createdAt > userStats.lastActive) {
        userStats.lastActive = createdAt;
      }
      
      // Add to recent queries (keep only 10 most recent)
      if (userStats.recentQueries.length < 10) {
        userStats.recentQueries.push({
          queryType,
          query: query.query,
          usedRag: query.usedRag,
          cachedResponse: query.cachedResponse,
          processingTime: query.processingTime,
          createdAt: query.createdAt
        });
      }
      
      // Track activity by hour and day
      const hour = createdAt.getHours();
      const day = createdAt.getDay();
      userStats.activityByHour[hour]++;
      userStats.activityByDay[day]++;
    });
    
    // Convert map to array and calculate additional metrics
    const enhancedUserMetrics = Array.from(userMetricsMap.values()).map(userStats => {
      // Calculate cache hit rate
      const cacheHitRate = userStats.queryCount > 0 
        ? ((userStats.cachedCount / userStats.queryCount) * 100).toFixed(1)
        : '0.0';
      
      // Calculate cost savings (assumed $0.02 per API call saved)
      const costSavings = (userStats.cachedCount * 0.02).toFixed(2);
      
      // Find most common query type
      let mostCommonQueryType = 'none';
      let maxCount = 0;
      
      Object.entries(userStats.queryTypes).forEach(([type, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonQueryType = type;
        }
      });
      
      // Sort recent queries by date (newest first)
      userStats.recentQueries.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      // Find peak activity times
      const mostActiveHour = userStats.activityByHour.indexOf(Math.max(...userStats.activityByHour));
      const mostActiveDay = userStats.activityByDay.indexOf(Math.max(...userStats.activityByDay));
      
      // Format day names
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      return {
        ...userStats,
        cacheHitRate,
        costSavings,
        mostCommonQueryType,
        mostActiveHour,
        mostActiveHourFormatted: `${mostActiveHour}:00`,
        mostActiveDay,
        mostActiveDayFormatted: dayNames[mostActiveDay]
      };
    });
    
    return enhancedUserMetrics;
  } catch (error) {
    logger.error('Error getting enhanced user RAG metrics:', error);
    return convertInMemoryUserMetrics();
  }
};

// Helper function to convert in-memory metrics to enhanced format
const convertInMemoryUserMetrics = () => {
  const userMetricsArray = [];
  
  for (const [userId, metrics] of inMemoryMetrics.byUser.entries()) {
    userMetricsArray.push({
      userId,
      queryCount: metrics.total,
      cachedCount: metrics.cached,
      directApiCount: metrics.direct,
      cacheHitRate: metrics.total > 0 
        ? `${((metrics.cached / metrics.total) * 100).toFixed(1)}`
        : '0.0',
      costSavings: (metrics.cached * 0.02).toFixed(2),
      avgProcessingTime: 0,
      lastActive: new Date(),
      queryTypes: {},
      recentQueries: [],
      activityByHour: Array(24).fill(0),
      activityByDay: Array(7).fill(0),
      mostCommonQueryType: 'unknown',
      mostActiveHour: 12, // Default to noon
      mostActiveDay: 1,    // Default to Monday
      mostActiveHourFormatted: '12:00',
      mostActiveDayFormatted: 'Monday'
    });
  }
  
  return userMetricsArray;
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
      FROM "RagMetrics"
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
  ragMetricsMiddleware,
  getSystemRagMetrics,
  getUserRagMetrics,
  getEnhancedUserRagMetrics,
  getQueryTypeMetrics,
  initializeMetricsModel
};