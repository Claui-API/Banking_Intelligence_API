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
    res.write = function (chunk) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return originalWrite.apply(res, arguments);
    };

    // Override end
    res.end = function (chunk) {
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
  if (!query) return 'general';

  const normalizedQuery = query.toString().trim().toLowerCase();

  // Check for harmful patterns first
  const harmfulPatterns = [
    /\b(cocaine|heroin|meth|methamphetamine|fentanyl|drug dealer|drug price|buy drugs|sell drugs|marijuana|cannabis|weed)\b/i,
    /\b(hack|hacking|ddos|phishing|steal|stealing|launder|laundering|money laundering|illegal)\b/i,
    /\b(make bomb|bomb making|gun dealer|illegal weapon|mass shooting|kill|murder)\b/i,
    /\b(child porn|cp|csam|underage|minor sex|pedophilia)\b/i,
    /\b(credit card fraud|identity theft|steal identity|fake id|counterfeit|pyramid scheme)\b/i,
    /\b(terrorism|terrorist|radicalize|jihad|extremist)\b/i
  ];

  if (normalizedQuery && harmfulPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return 'harmful';
  }

  // Existing classifications for greeting/joke
  if (/^(hi|hello|hey|howdy|hola|yo|sup|greetings)$/i.test(normalizedQuery) ||
    /^(good\s+(morning|afternoon|evening))(\s+clau)?(\s*[!,.?]*)$/i.test(normalizedQuery)) {
    return 'greeting';
  }

  if (/joke|funny|make me laugh|tell me a joke/i.test(normalizedQuery)) {
    return 'joke';
  }

  // Financial categories
  if (/budget|how\s+to\s+budget|budgeting|create\s+a\s+budget|manage\s+budget|budget\s+plan|monthly\s+budget/i.test(normalizedQuery)) {
    return 'budgeting';
  }

  if (/spend|spending|how\s+much\s+did\s+i\s+spend|spent|where\s+is\s+my\s+money\s+going|expenses|expense|track\s+spending|spending\s+habits/i.test(normalizedQuery)) {
    return 'spending';
  }

  if (/save|saving|savings|how\s+to\s+save|save\s+money|save\s+more|increase\s+savings/i.test(normalizedQuery)) {
    return 'saving';
  }

  if (/invest|investing|investment|stock|stocks|etf|mutual\s+fund|portfolio|retirement/i.test(normalizedQuery)) {
    return 'investing';
  }

  if (/debt|loan|credit\s+card|mortgage|pay\s+off|interest\s+rate|refinance/i.test(normalizedQuery)) {
    return 'debt';
  }

  if (/tax|taxes|tax\s+return|tax\s+refund|tax\s+deduction|tax\s+credit|irs|filing\s+taxes/i.test(normalizedQuery)) {
    return 'tax';
  }

  if (/insurance|insure|policy|coverage|premium|deductible|life\s+insurance|health\s+insurance|auto\s+insurance/i.test(normalizedQuery)) {
    return 'insurance';
  }

  if (/retirement|retire|401k|ira|pension|social\s+security|retirement\s+planning/i.test(normalizedQuery)) {
    return 'retirement';
  }

  if (/bank\s+account|checking|savings\s+account|deposit|withdraw|atm|transfer\s+money|bank\s+fee|overdraft/i.test(normalizedQuery)) {
    return 'banking';
  }

  if (/credit\s+score|credit\s+report|fico|credit\s+history|credit\s+bureau|improve\s+credit|bad\s+credit/i.test(normalizedQuery)) {
    return 'credit';
  }

  if (/financial\s+plan|financial\s+goal|financial\s+advisor|finance\s+management|wealth\s+management/i.test(normalizedQuery)) {
    return 'planning';
  }

  if (/real\s+estate|housing|home\s+buying|mortgage|rent|property|down\s+payment/i.test(normalizedQuery)) {
    return 'real_estate';
  }

  if (/crypto|cryptocurrency|bitcoin|ethereum|blockchain|nft|token|defi/i.test(normalizedQuery)) {
    return 'crypto';
  }

  if (/market\s+trend|stock\s+market|bear\s+market|bull\s+market|market\s+analysis|forecast/i.test(normalizedQuery)) {
    return 'market_analysis';
  }

  if (/learn|explain|how\s+does|what\s+is|define|financial\s+literacy|basics\s+of/i.test(normalizedQuery)) {
    return 'education';
  }

  if (/income|salary|wage|earn|earning|paycheck|side\s+hustle|passive\s+income/i.test(normalizedQuery)) {
    return 'income';
  }

  if (/transaction|purchase|payment|receipt|invoice|refund|charge|statement|bill/i.test(normalizedQuery)) {
    return 'transactions';
  }

  if (/fraud|scam|security|protect|identity|phishing|suspicious|fraud\s+alert|unauthorized/i.test(normalizedQuery)) {
    return 'security';
  }

  if (/currency|foreign\s+exchange|forex|exchange\s+rate|conversion|dollar|euro|yuan|yen|pound/i.test(normalizedQuery)) {
    return 'forex';
  }

  // Default to general for any other financial queries
  return 'general';
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

    // Ensure Op is properly defined
    const Op = sequelize.Op || {};

    // Get total counts with no date filtering
    const totalQueries = await metricsModel.count();
    logger.info(`Total queries found: ${totalQueries}`);

    const successfulQueries = await metricsModel.count({
      where: { success: true }
    });

    const failedQueries = await metricsModel.count({
      where: { success: false }
    });

    // Get average response time - adjust the query to avoid the Op.gt error
    let avgResponseTime = 0;
    try {
      const avgResponse = await sequelize.query(`
        SELECT AVG("responseTime") as "avgTime"
        FROM "InsightMetrics"
        WHERE "responseTime" > 100
      `, { type: sequelize.QueryTypes.SELECT });

      avgResponseTime = avgResponse && avgResponse[0]
        ? parseInt(avgResponse[0].avgTime) || 0
        : 0;
    } catch (avgError) {
      logger.error('Error calculating average response time:', avgError);
    }

    // Get today's queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayQueries = 0;

    try {
      todayQueries = await sequelize.query(`
        SELECT COUNT(*) as "count"
        FROM "InsightMetrics"
        WHERE "createdAt" >= :today
      `, {
        replacements: { today: today.toISOString() },
        type: sequelize.QueryTypes.SELECT
      }).then(result => parseInt(result[0]?.count || 0));
    } catch (todayError) {
      logger.error('Error calculating today\'s queries:', todayError);
    }

    // Get min and max response times using plain SQL
    let minResponseTime = 250;
    let maxResponseTime = 1250;

    try {
      const minResult = await sequelize.query(`
        SELECT MIN("responseTime") as "minTime"
        FROM "InsightMetrics"
        WHERE "responseTime" > 100
      `, { type: sequelize.QueryTypes.SELECT });

      minResponseTime = minResult && minResult[0]
        ? parseInt(minResult[0].minTime) || 250
        : 250;

      const maxResult = await sequelize.query(`
        SELECT MAX("responseTime") as "maxTime"
        FROM "InsightMetrics"
        WHERE "responseTime" > 100
      `, { type: sequelize.QueryTypes.SELECT });

      maxResponseTime = maxResult && maxResult[0]
        ? parseInt(maxResult[0].maxTime) || 1250
        : 1250;
    } catch (minMaxError) {
      logger.error('Error calculating min/max response times:', minMaxError);
    }

    // Get query type distribution
    const queryTypeDistribution = await getQueryTypeMetrics();

    // Calculate success rate
    const successRate = totalQueries > 0
      ? `${((successfulQueries / totalQueries) * 100).toFixed(1)}%`
      : '0.0%';

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      successRate,
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

    // Log the raw results for debugging
    logger.info(`Historical data query returned ${results.length} days of data`);

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
    // Include full error details
    logger.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return [];
  }
};

/**
 * Get per-user insight metrics
 * @returns {Array} User metrics
 */
// In your insights-metrics.middleware.js, modify the getUserInsightMetrics function:

const getUserInsightMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();

    if (!metricsModel) {
      return []; // Return empty array if model initialization fails
    }

    // Get metrics data grouped by userId
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

    // Now join with Users table to get names and emails
    const enhancedUserMetrics = [];

    for (const record of results) {
      try {
        // Find the user in the Users table
        const user = await sequelize.query(`
          SELECT "id", "clientName", "email", "status", "role" 
          FROM "Users" 
          WHERE "id" = :userId
        `, {
          replacements: { userId: record.userId },
          type: sequelize.QueryTypes.SELECT,
          plain: true // Get a single result object instead of an array
        });

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
          replacements: { userId: record.userId },
          type: sequelize.QueryTypes.SELECT
        });

        const mostCommonQueryType = queryTypes.length > 0
          ? queryTypes[0].queryType
          : 'unknown';

        // Get recent queries for this user
        const recentQueries = await sequelize.query(`
          SELECT 
            "queryId", 
            "query", 
            "queryType", 
            "responseTime" as "processingTime",
            "success",
            "createdAt"
          FROM "InsightMetrics"
          WHERE "userId" = :userId
          ORDER BY "createdAt" DESC
          LIMIT 10
        `, {
          replacements: { userId: record.userId },
          type: sequelize.QueryTypes.SELECT
        });

        // Create activity by hour data
        const activityByHour = Array(24).fill(0);
        // Create activity by day data
        const activityByDay = Array(7).fill(0);

        // Calculate activity distribution
        if (recentQueries.length > 0) {
          await sequelize.query(`
            SELECT 
              EXTRACT(HOUR FROM "createdAt") AS hour,
              COUNT(*) as "count"
            FROM "InsightMetrics"
            WHERE "userId" = :userId
            GROUP BY EXTRACT(HOUR FROM "createdAt")
          `, {
            replacements: { userId: record.userId },
            type: sequelize.QueryTypes.SELECT
          }).then(hourlyResults => {
            hourlyResults.forEach(hourData => {
              const hour = parseInt(hourData.hour);
              if (hour >= 0 && hour < 24) {
                activityByHour[hour] = parseInt(hourData.count);
              }
            });
          });

          await sequelize.query(`
            SELECT 
              EXTRACT(DOW FROM "createdAt") AS day,
              COUNT(*) as "count"
            FROM "InsightMetrics"
            WHERE "userId" = :userId
            GROUP BY EXTRACT(DOW FROM "createdAt")
          `, {
            replacements: { userId: record.userId },
            type: sequelize.QueryTypes.SELECT
          }).then(dailyResults => {
            dailyResults.forEach(dayData => {
              const day = parseInt(dayData.day);
              if (day >= 0 && day < 7) {
                activityByDay[day] = parseInt(dayData.count);
              }
            });
          });
        }

        // Add user details to the metrics record
        enhancedUserMetrics.push({
          userId: record.userId,
          queryCount: parseInt(record.queryCount),
          successCount: parseInt(record.successCount),
          failedCount: parseInt(record.failedCount),
          avgResponseTime: parseInt(record.avgResponseTime) || 0,
          successRate: (parseInt(record.queryCount) > 0)
            ? ((parseInt(record.successCount) / parseInt(record.queryCount)) * 100).toFixed(1)
            : '0.0',
          lastActive: record.lastActive,
          // Add user details if found
          name: user ? user.clientName : 'Unknown',
          email: user ? user.email : `${record.userId.substring(0, 8)}...`,
          mostCommonQueryType,
          recentQueries,
          activityByHour,
          activityByDay
        });
      } catch (userError) {
        logger.error(`Error enhancing user metrics for ${record.userId}:`, userError);
        // Add the record even if user lookup fails with basic data
        enhancedUserMetrics.push({
          userId: record.userId,
          queryCount: parseInt(record.queryCount),
          successCount: parseInt(record.successCount),
          failedCount: parseInt(record.failedCount),
          avgResponseTime: parseInt(record.avgResponseTime) || 0,
          successRate: (parseInt(record.queryCount) > 0)
            ? ((parseInt(record.successCount) / parseInt(record.queryCount)) * 100).toFixed(1)
            : '0.0',
          lastActive: record.lastActive,
          name: 'Unknown',
          email: `${record.userId.substring(0, 8)}...`,
          mostCommonQueryType: 'unknown',
          recentQueries: [],
          activityByHour: Array(24).fill(0),
          activityByDay: Array(7).fill(0)
        });
      }
    }

    return enhancedUserMetrics;
  } catch (error) {
    logger.error('Error getting user insight metrics:', error);
    return [];
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
      ORDER BY "count" DESC
    `, { type: sequelize.QueryTypes.SELECT });

    // Format results
    const queryTypeMetrics = {};
    results.forEach(result => {
      queryTypeMetrics[result.queryType] = parseInt(result.count);
    });

    // Make sure all categories are represented in the metrics
    const allQueryTypes = [
      'general', 'budgeting', 'spending', 'saving', 'investing', 'debt',
      'tax', 'insurance', 'retirement', 'banking', 'credit', 'planning',
      'real_estate', 'crypto', 'market_analysis', 'education', 'income',
      'transactions', 'security', 'forex', 'greeting', 'joke', 'harmful'
    ];

    allQueryTypes.forEach(type => {
      if (!queryTypeMetrics[type]) {
        queryTypeMetrics[type] = 0;
      }
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