// Quick fix for insights.routes.js - Replace trackInsightManually calls
const express = require('express');
const insightsController = require('../controllers/insights.controller');
const { authMiddleware, authorize } = require('../middleware/auth');
const { sessionMiddleware } = require('../middleware/session.middleware');
const { InsightMetrics } = require('../models');
const logger = require('../utils/logger');
const databaseService = require('../services/data.service');
const llmFactory = require('../services/llm-factory.service');

// Add direct database storage function
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Direct metrics storage function
async function storeQueryMetrics(userId, query, queryType, success, responseTime, errorMessage = null) {
  try {
    const requestId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('📊 METRICS: Storing query metrics via model', {
      userId: userId.substring(0, 8) + '...',
      query: query.substring(0, 50) + '...',
      queryType,
      success,
      responseTime,
      requestId
    });

    const record = await InsightMetrics.create({
      userId,
      queryId: requestId,
      query: query || 'Unknown query',
      queryType: queryType || 'unknown',
      responseTime: responseTime || 0,
      success,
      errorMessage
    });

    logger.info('✅ METRICS: Successfully stored metrics with ID', record.id);
    return record;
  } catch (error) {
    logger.error('🚨 METRICS: Model storage error:', error);
    throw error;
  }
}

// In-memory storage for streaming queries
const streamingQueries = new Map();

const router = express.Router();

// Apply session middleware to all routes
router.use(sessionMiddleware);

/**
 * Classify query
 */
function classifyQuery(query) {
  if (!query) return 'general';

  const normalizedQuery = query.trim().toLowerCase();

  if (/\b(cocaine|heroin|hack|bomb|illegal|drug|weapon)\b/.test(normalizedQuery)) {
    return 'harmful';
  }

  if (/^(hi|hello|hey)/.test(normalizedQuery)) return 'greeting';
  if (/joke|funny/.test(normalizedQuery)) return 'joke';
  if (/budget/.test(normalizedQuery)) return 'budgeting';
  if (/spend/.test(normalizedQuery)) return 'spending';
  if (/save|saving/.test(normalizedQuery)) return 'saving';
  if (/invest/.test(normalizedQuery)) return 'investing';

  return 'general';
}

/**
 * @route POST /api/insights/generate
 */
router.post('/generate', authMiddleware, insightsController.generateInsights);

/**
 * @route GET /api/insights/summary
 */
router.get('/summary', authMiddleware, insightsController.getFinancialSummary);

/**
 * @route POST /api/insights/stream-prepare
 */
router.post('/stream-prepare', authMiddleware, (req, res) => {
  try {
    const {
      query,
      requestId,
      useConnectedData,
      useDirectData,
      integrationMode,
      dataSourceMode,
      financialData,
      provider
    } = req.body;

    const userId = req.auth.userId;
    const sessionId = req.sessionId || req.headers['x-session-id'] || req.body.sessionId;

    if (!query || !requestId) {
      return res.status(400).json({
        success: false,
        message: 'Query and requestId are required'
      });
    }

    const queryType = classifyQuery(query);

    logger.info('🎯 STREAM PREP: Preparing streaming request', {
      userId: userId.substring(0, 8) + '...',
      sessionId,
      requestId,
      query: query.substring(0, 50) + '...',
      queryType,
      integrationMode,
      dataSourceMode,
      useConnectedData: !!useConnectedData,
      useDirectData: !!useDirectData,
      hasCustomData: !!financialData,
      provider: provider || 'default'
    });

    streamingQueries.set(requestId, {
      query,
      queryType,
      userId,
      sessionId,
      integrationMode,
      dataSourceMode,
      useConnectedData: !!useConnectedData,
      useDirectData: !!useDirectData,
      financialData,
      provider,
      timestamp: Date.now(),
      startTime: Date.now(),
      processed: false
    });

    // Clean up old entries
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, value] of streamingQueries.entries()) {
      if (value.timestamp < oneHourAgo) {
        streamingQueries.delete(key);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Stream prepared successfully',
      sessionId
    });
  } catch (error) {
    logger.error('🚨 STREAM PREP ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Error preparing stream'
    });
  }
});

/**
 * @route GET /api/insights/stream
 */
router.get('/stream', authMiddleware, (req, res) => {
  try {
    const requestId = req.query.requestId;
    const userId = req.auth.userId;
    const sessionId = req.sessionId || req.headers['x-session-id'] || req.query.sessionId;

    logger.info('🌊 STREAM: Starting streaming response', {
      requestId,
      userId: userId.substring(0, 8) + '...',
      sessionId
    });

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID required'
      });
    }

    const queryData = streamingQueries.get(requestId);

    if (!queryData) {
      return res.status(404).json({
        success: false,
        message: 'Request not found. Please prepare the stream first.'
      });
    }

    if (queryData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: User ID mismatch'
      });
    }

    queryData.processed = true;
    streamingQueries.set(requestId, queryData);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(': connected\n\n');

    if (sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'session',
        sessionId: sessionId
      })}\n\n`);
    }

    // Check for harmful content
    if (queryData.queryType === 'harmful') {
      const errorMsg = "I cannot provide information about potentially harmful or illegal topics. Please ask about legitimate financial matters instead.";

      // FIXED: Use direct storage instead of trackInsightManually
      storeQueryMetrics(
        userId,
        queryData.query,
        queryData.queryType,
        false,
        Date.now() - queryData.startTime,
        'Harmful content blocked'
      ).catch(err => {
        logger.error('🚨 METRICS: Error storing harmful query:', err);
      });

      res.write(`data: ${JSON.stringify({
        chunk: errorMsg,
        isComplete: true
      })}\n\n`);

      streamingQueries.delete(requestId);
      res.end();
      return;
    }

    // Process insights with direct metrics tracking
    processStreamingInsight(queryData, userId, requestId, sessionId, (chunk, isComplete) => {
      res.write(`data: ${JSON.stringify({
        chunk,
        isComplete
      })}\n\n`);

      // FIXED: Store metrics when streaming is complete
      if (isComplete) {
        const responseTime = Date.now() - queryData.startTime;

        storeQueryMetrics(
          userId,
          queryData.query,
          queryData.queryType,
          true,
          responseTime,
          null
        ).then(() => {
          logger.info('✅ METRICS: Successfully tracked streaming query', {
            requestId,
            userId: userId.substring(0, 8) + '...',
            queryType: queryData.queryType,
            responseTime
          });
        }).catch(err => {
          logger.error('🚨 METRICS: Error tracking successful streaming query:', err);
        });

        streamingQueries.delete(requestId);
        res.end();
      }
    }).catch(error => {
      logger.error('🚨 STREAM: Error in streaming insights', error);

      const responseTime = Date.now() - queryData.startTime;

      // FIXED: Store failed query metrics
      storeQueryMetrics(
        userId,
        queryData.query,
        queryData.queryType,
        false,
        responseTime,
        error.message || 'Streaming error'
      ).catch(err => {
        logger.error('🚨 METRICS: Error tracking failed streaming query:', err);
      });

      res.write(`data: ${JSON.stringify({
        chunk: `I'm sorry, I encountered an error. Please try again.`,
        isComplete: true
      })}\n\n`);

      streamingQueries.delete(requestId);
      res.end();
    });

    // Handle client disconnection
    req.on('close', () => {
      logger.info('🔌 STREAM: Client disconnected', { requestId, sessionId });

      if (streamingQueries.has(requestId)) {
        const queryData = streamingQueries.get(requestId);
        const responseTime = Date.now() - queryData.startTime;

        storeQueryMetrics(
          userId,
          queryData.query,
          queryData.queryType,
          false,
          responseTime,
          'Client disconnected'
        ).catch(err => {
          logger.error('🚨 METRICS: Error tracking disconnected query:', err);
        });
      }

      streamingQueries.delete(requestId);
    });
  } catch (error) {
    logger.error('🚨 STREAM: Stream setup error', error);
    return res.status(500).json({
      success: false,
      message: 'Error setting up stream'
    });
  }
});

/**
 * Process streaming insights
 */
async function processStreamingInsight(queryData, userId, requestId, sessionId, callback) {
  const integrationMode = queryData.integrationMode || 'plaid';
  const useConnectedData = queryData.useConnectedData || false;
  const useDirectData = queryData.useDirectData || false;
  const providedFinancialData = queryData.financialData;
  const provider = queryData.provider || null;

  logger.info('🔮 PROCESSING: Processing streaming insight', {
    requestId,
    sessionId,
    integrationMode,
    useConnectedData,
    useDirectData,
    hasProvidedData: !!providedFinancialData,
    queryType: queryData.queryType
  });

  let userData;
  try {
    if (useDirectData && providedFinancialData) {
      userData = providedFinancialData;
      logger.info('📊 DATA: Using PROVIDED financial data for streaming (Direct mode)', {
        requestId,
        userId: userId.substring(0, 8) + '...',
        sessionId,
        dataSource: 'client-provided'
      });
    } else if (useConnectedData) {
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('🏦 DATA: Using REAL connected financial data for streaming (Plaid mode)', {
        requestId,
        userId: userId.substring(0, 8) + '...',
        sessionId,
        dataSource: 'plaid-connected'
      });

      callback('<using-real-data>', false);
    } else {
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('📈 DATA: Using default financial data for streaming', {
        requestId,
        userId: userId.substring(0, 8) + '...',
        sessionId,
        dataSource: 'default-fallback'
      });
    }
  } catch (error) {
    logger.warn('⚠️ DATA: Error getting user data', error);

    if (process.env.NODE_ENV !== 'production') {
      userData = databaseService.getMockUserData(userId);
      logger.info('🎭 DATA: Using mock data for streaming (after data fetch error)', {
        requestId,
        userId: userId.substring(0, 8) + '...',
        sessionId,
        dataSource: 'mock-fallback'
      });
    } else {
      throw error;
    }
  }

  try {
    const insight = await llmFactory.generateInsights({
      ...userData,
      query: queryData.query,
      queryType: queryData.queryType,
      requestId,
      sessionId,
      useConnectedData,
      useDirectData,
      integrationMode,
      userId
    }, provider);

    if (insight.llmProvider) {
      logger.info(`🤖 LLM: Using ${insight.llmProvider} service for request ${requestId} with session ${sessionId}`);
    }

    if (insight.usingBackupService) {
      logger.info(`🔄 LLM: Using backup service for request ${requestId} with session ${sessionId}`);
    }

    const content = insight.insight || '';

    if (content.length < 100) {
      callback(content, true);
    } else if (['greeting', 'joke'].includes(queryData.queryType)) {
      const chunkSize = 5;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, Math.min(i + chunkSize, content.length));
        const isLast = i + chunkSize >= content.length;

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        callback(chunk, isLast);
      }
    } else {
      const paragraphs = content.split('\n\n').filter(p => p.trim());

      if (paragraphs.length > 1) {
        for (let i = 0; i < paragraphs.length; i++) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }

          const isLast = i === paragraphs.length - 1;
          callback(paragraphs[i] + (isLast ? '' : '\n\n'), isLast);
        }
      } else {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];

        for (let i = 0; i < sentences.length; i++) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const isLast = i === sentences.length - 1;
          callback(sentences[i], isLast);
        }
      }
    }
  } catch (error) {
    logger.error('🚨 PROCESSING: Error generating streaming insight', error);
    throw error;
  }
}

/**
 * @route DELETE /api/insights/session
 */
router.delete('/session', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.sessionId ||
      req.headers['x-session-id'] ||
      req.body.sessionId;
    const userId = req.auth?.userId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session to clear'
      });
    }

    const sessionManager = require('../services/session.service');

    sessionManager.deleteSession(sessionId);
    const newSessionId = sessionManager.createSession(userId);

    logger.info('🔄 SESSION: Session cleared and recreated', {
      userId: userId ? userId.substring(0, 8) + '...' : 'unknown',
      oldSessionId: sessionId,
      newSessionId
    });

    return res.json({
      success: true,
      message: 'Session cleared successfully',
      data: {
        sessionId: newSessionId
      }
    });
  } catch (error) {
    logger.error('🚨 SESSION: Error clearing session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear session'
    });
  }
});

module.exports = router;