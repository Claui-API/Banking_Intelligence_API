// src/routes/insights.routes.js - Enhanced with Session Management
const express = require('express');
const insightsController = require('../controllers/insights.controller');
const { authMiddleware, authorize } = require('../middleware/auth');
const { sessionMiddleware } = require('../middleware/session.middleware'); // Add session middleware
const logger = require('../utils/logger');
const databaseService = require('../services/data.service');
const llmFactory = require('../services/llm-factory.service');

// In-memory storage for streaming queries (enhanced with session info)
const streamingQueries = new Map();

const router = express.Router();

// Apply session middleware to all routes
router.use(sessionMiddleware);

/**
 * Classify query - this should match your main classification function
 * @param {string} query - The query to classify
 * @returns {string} - Query type
 */
function classifyQuery(query) {
  if (!query) return 'general';

  const normalizedQuery = query.trim().toLowerCase();

  // Check for harmful patterns
  if (/\b(cocaine|heroin|hack|bomb|illegal|drug|weapon)\b/.test(normalizedQuery)) {
    return 'harmful';
  }

  // Basic classification
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
 * @desc Generate personal financial insights
 * @access Private
 */
router.post('/generate', authMiddleware, insightsController.generateInsights);

/**
 * @route GET /api/insights/summary
 * @desc Get financial summary for the user
 * @access Private
 */
router.get('/summary', authMiddleware, insightsController.getFinancialSummary);

/**
 * @route GET /api/insights/metrics/:metric
 * @desc Redirect to metrics routes (for backward compatibility)
 * @access Private (Admin only)
 */
router.get('/metrics/:metric', authMiddleware, authorize('admin'), (req, res) => {
  res.redirect(`/api/insights-metrics/${req.params.metric}`);
});

/**
 * @route POST /api/insights/stream-prepare
 * @desc Prepare for streaming insights with session support
 * @access Private
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

    // Log full integration mode details including session
    logger.info('Stream preparation with session', {
      userId,
      sessionId,
      requestId,
      query: query.substring(0, 30),
      integrationMode,
      dataSourceMode,
      useConnectedData: !!useConnectedData,
      useDirectData: !!useDirectData,
      hasCustomData: !!financialData,
      provider: provider || 'default'
    });

    // Store query for streaming with session info
    streamingQueries.set(requestId, {
      query,
      userId,
      sessionId, // Store session ID
      integrationMode,
      dataSourceMode,
      useConnectedData: !!useConnectedData,
      useDirectData: !!useDirectData,
      financialData,
      provider,
      timestamp: Date.now(),
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
      sessionId // Return session ID to client
    });
  } catch (error) {
    logger.error('Stream preparation error', error);
    return res.status(500).json({
      success: false,
      message: 'Error preparing stream'
    });
  }
});

/**
 * @route GET /api/insights/stream
 * @desc Stream insights via SSE with session context
 * @access Private
 */
router.get('/stream', authMiddleware, (req, res) => {
  try {
    const requestId = req.query.requestId;
    const userId = req.auth.userId;
    const sessionId = req.sessionId || req.headers['x-session-id'] || req.query.sessionId;

    logger.info('Stream request with session', {
      requestId,
      userId,
      sessionId
    });

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID required'
      });
    }

    // Get the query from storage
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

    // Verify session matches if provided
    if (sessionId && queryData.sessionId && sessionId !== queryData.sessionId) {
      logger.warn('Session mismatch in streaming', {
        requestId,
        expectedSession: queryData.sessionId,
        providedSession: sessionId
      });
    }

    // Mark as processed
    queryData.processed = true;
    streamingQueries.set(requestId, queryData);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send a comment to establish connection
    res.write(': connected\n\n');

    // Send session info if available
    if (sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'session',
        sessionId: sessionId
      })}\n\n`);
    }

    // Check for harmful content immediately
    const queryType = classifyQuery(queryData.query);
    if (queryType === 'harmful') {
      const errorMsg = "I cannot provide information about potentially harmful or illegal topics. Please ask about legitimate financial matters instead.";
      res.write(`data: ${JSON.stringify({
        chunk: errorMsg,
        isComplete: true
      })}\n\n`);

      // Clean up
      streamingQueries.delete(requestId);
      res.end();
      return;
    }

    // Process insights in streaming mode with session context
    processStreamingInsight(queryData.query, userId, requestId, sessionId, (chunk, isComplete) => {
      // Send chunk
      res.write(`data: ${JSON.stringify({
        chunk,
        isComplete
      })}\n\n`);

      // End if complete
      if (isComplete) {
        streamingQueries.delete(requestId);
        res.end();
      }
    }).catch(error => {
      logger.error('Error in streaming insights', error);

      res.write(`data: ${JSON.stringify({
        chunk: `I'm sorry, I encountered an error. Please try again.`,
        isComplete: true
      })}\n\n`);

      streamingQueries.delete(requestId);
      res.end();
    });

    // Handle client disconnection
    req.on('close', () => {
      logger.info('Client disconnected', { requestId, sessionId });
      streamingQueries.delete(requestId);
    });
  } catch (error) {
    logger.error('Stream setup error', error);
    return res.status(500).json({
      success: false,
      message: 'Error setting up stream'
    });
  }
});

/**
 * Process streaming insights with session context
 * @param {string} query - User query
 * @param {string} userId - User ID
 * @param {string} requestId - Request ID for tracking
 * @param {string} sessionId - Session ID for conversation context
 * @param {Function} callback - Streaming callback function
 */
async function processStreamingInsight(query, userId, requestId, sessionId, callback) {
  // Get the stored query data
  const queryData = streamingQueries.get(requestId) || {};

  const integrationMode = queryData.integrationMode || 'plaid';
  const useConnectedData = queryData.useConnectedData || false;
  const useDirectData = queryData.useDirectData || false;
  const providedFinancialData = queryData.financialData;
  const provider = queryData.provider || null;

  logger.info('Processing streaming insight with session context', {
    requestId,
    sessionId,
    integrationMode,
    useConnectedData,
    useDirectData,
    hasProvidedData: !!providedFinancialData
  });

  // Get user financial data based on mode
  let userData;
  try {
    if (useDirectData && providedFinancialData) {
      userData = providedFinancialData;
      logger.info('Using PROVIDED financial data for streaming (Direct mode)', {
        requestId,
        userId,
        sessionId,
        dataSource: 'client-provided'
      });
    } else if (useConnectedData) {
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('Using REAL connected financial data for streaming (Plaid mode)', {
        requestId,
        userId,
        sessionId,
        dataSource: 'plaid-connected'
      });

      // Send a special marker to indicate we're using real data
      callback('<using-real-data>', false);
    } else {
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('Using default financial data for streaming', {
        requestId,
        userId,
        sessionId,
        dataSource: 'default-fallback'
      });
    }
  } catch (error) {
    logger.warn('Error getting user data', error);

    if (process.env.NODE_ENV !== 'production') {
      userData = databaseService.getMockUserData(userId);
      logger.info('Using mock data for streaming (after data fetch error)', {
        requestId,
        userId,
        sessionId,
        dataSource: 'mock-fallback'
      });
    } else {
      throw error;
    }
  }

  const queryType = classifyQuery(query);

  try {
    // Add session context to the request
    const insight = await llmFactory.generateInsights({
      ...userData,
      query,
      queryType,
      requestId,
      sessionId, // Include session ID for conversation context
      useConnectedData,
      useDirectData,
      integrationMode,
      userId
    }, provider);

    // Log the LLM provider used
    if (insight.llmProvider) {
      logger.info(`Using ${insight.llmProvider} service for request ${requestId} with session ${sessionId}`);
    }

    if (insight.usingBackupService) {
      logger.info(`Using backup service for request ${requestId} with session ${sessionId}`);
    }

    // Break response into smaller parts for streaming
    const content = insight.insight || '';

    // Handle different streaming strategies based on content length
    if (content.length < 100) {
      callback(content, true);
    } else if (['greeting', 'joke'].includes(queryType)) {
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
      // For longer responses, stream by paragraph or sentence
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
    logger.error('Error generating streaming insight', error);
    throw error;
  }
}

/**
 * @route DELETE /api/insights/session
 * @desc Clear conversation session
 * @access Private
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

    // Delete current session
    sessionManager.deleteSession(sessionId);

    // Create new session
    const newSessionId = sessionManager.createSession(userId);

    logger.info('Session cleared and recreated', {
      userId,
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
    logger.error('Error clearing session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear session'
    });
  }
});

module.exports = router;