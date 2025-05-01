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
  // Store the original end method
  const originalEnd = res.end;
  
  // Replace the end method
  res.end = async function(...args) {
    try {
      // Only track metrics for insights generation endpoint
      if (req.path === '/api/insights/generate' && req.method === 'POST') {
        // Extract relevant data
        const userId = req.auth?.userId;
        const query = req.body?.query;
        const queryType = req.body?.queryType;
        const requestId = req.body?.requestId || `req_${Date.now()}`;
        
        // Check if response is successful and contains RAG data
        let responseBody;
        try {
          // Get the response data
          const responseData = Buffer.isBuffer(args[0]) ? args[0].toString() : args[0];
          responseBody = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        } catch (parseError) {
          logger.warn('Error parsing response for RAG metrics:', parseError);
        }
        
        if (responseBody && responseBody.success && responseBody.data) {
          const ragData = responseBody.data;
          
          // Extract metrics from response
          const usedRag = ragData.ragEnabled !== false;
          const cachedResponse = ragData.insights && ragData.insights.fromCache === true;
          const processingTime = ragData.processingTime || null;
          const documentCount = ragData.insights && ragData.insights.documentsUsed ? 
            ragData.insights.documentsUsed : null;
          const documentIds = ragData.insights && ragData.insights.documentIds ?
            ragData.insights.documentIds : null;
          
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
          
          // Store in database if possible
          try {
            const metricsModel = await initializeMetricsModel();
            
            if (metricsModel) {
              await metricsModel.create({
                userId,
                queryId: requestId,
                query,
                queryType: queryType || 'unknown',
                usedRag,
                cachedResponse,
                processingTime,
                documentCount,
                documentIds
              });
              
              logger.info(`Stored RAG metrics for query ID: ${requestId}`);
            }
          } catch (dbError) {
            logger.error('Error storing RAG metrics in database:', dbError);
          }
        }
      }
    } catch (error) {
      logger.error('Error in RAG metrics middleware:', error);
      // Don't block the response if metrics tracking fails
    }
    
    // Call the original end method
    return originalEnd.apply(this, args);
  };
  
  next();
};

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
  getQueryTypeMetrics,
  initializeMetricsModel
};