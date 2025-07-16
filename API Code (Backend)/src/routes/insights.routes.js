// src/routes/insights.routes.js
const express = require('express');
const insightsController = require('../controllers/insights.controller');
const { authMiddleware, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const databaseService = require('../services/data.service');
const cohereService = require('../services/cohere.service');
const groqService = require('../services/groq.service'); // Add Groq service import
const llmFactory = require('../services/llm-factory.service');

// In-memory storage for streaming queries
const streamingQueries = new Map();

const router = express.Router();

/**
 * Classify query - this should match your main classification function
 * @param {string} query - The query to classify
 * @returns {string} - Query type
 */
function classifyQuery(query) {
  if (!query) return 'general';

  // Simplified version - in production, use your full classifier
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
 * @desc Prepare for streaming insights
 * @access Private
 */
router.post('/stream-prepare', authMiddleware, (req, res) => {
  try {
    const { query, requestId, useConnectedData, provider } = req.body;
    const userId = req.auth.userId;

    if (!query || !requestId) {
      return res.status(400).json({
        success: false,
        message: 'Query and requestId are required'
      });
    }

    logger.info('Stream preparation', {
      userId,
      requestId,
      query: query.substring(0, 30), // Log only the beginning for privacy
      useConnectedData: !!useConnectedData, // Log whether to use connected data
      provider: provider || 'default' // Log the requested provider
    });

    // Store query for streaming
    streamingQueries.set(requestId, {
      query,
      userId,
      useConnectedData: !!useConnectedData,
      provider: provider, // Store the requested provider
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
      message: 'Stream prepared successfully'
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
 * @desc Stream insights via SSE
 * @access Private
 */
router.get('/stream', authMiddleware, (req, res) => {
  try {
    const requestId = req.query.requestId;
    const userId = req.auth.userId;

    logger.info('Stream request', { requestId, userId });

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

    // Mark as processed
    queryData.processed = true;
    streamingQueries.set(requestId, queryData);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // For Nginx

    // Send a comment to establish connection
    res.write(': connected\n\n');

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

    // Process insights in streaming mode
    processStreamingInsight(queryData.query, userId, requestId, (chunk, isComplete) => {
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
      logger.info('Client disconnected', { requestId });
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
 * Process streaming insights with multi-LLM support
 * @param {string} query - User query
 * @param {string} userId - User ID
 * @param {string} requestId - Request ID for tracking
 * @param {Function} callback - Streaming callback function
 */
async function processStreamingInsight(query, userId, requestId, callback) {
  // Get the stored query data to check if we should use connected data
  const queryData = streamingQueries.get(requestId) || {};
  const useConnectedData = queryData.useConnectedData || false;
  const provider = queryData.provider || null; // Get provider from stored query data

  // Get user financial data first
  let userData;
  try {
    if (useConnectedData) {
      // If using connected data, prioritize getting real data
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('Retrieved REAL connected financial data for streaming', { userId });

      // Send a special marker to indicate we're using real data
      // This will be intercepted by the frontend to add the badge
      callback('<using-real-data>', false);
    } else {
      // Standard flow - try to get data, fall back to mock if needed
      userData = await databaseService.getUserFinancialData(userId);
      logger.info('Retrieved financial data for streaming', { userId });
    }
  } catch (error) {
    logger.warn('Error getting user data', error);

    // In development, use mock data
    if (process.env.NODE_ENV !== 'production') {
      userData = databaseService.getMockUserData(userId);
      logger.info('Using mock data for streaming', { userId });
    } else {
      throw error;
    }
  }

  // Determine query type for specialized handling
  const queryType = classifyQuery(query);

  try {
    // Generate insights using the LLM factory with the requested provider
    const insight = await llmFactory.generateInsights({
      ...userData,
      query,
      queryType,
      requestId,
      useConnectedData
    }, provider);

    // Send indicator for which LLM provider was used
    if (insight.llmProvider) {
      callback(`<using-${insight.llmProvider}-service>`, false);
    }

    // Also indicate if using backup service
    if (insight.usingBackupService) {
      callback('<using-backup-service>', false);
    }

    // Break response into smaller parts for streaming
    const content = insight.insight || '';

    // Handle different streaming strategies based on content length
    if (content.length < 100) {
      // For short responses, just send as is
      callback(content, true);
    } else if (['greeting', 'joke'].includes(queryType)) {
      // For simple queries, stream character by character
      const chunkSize = 5; // Characters per chunk

      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, Math.min(i + chunkSize, content.length));
        const isLast = i + chunkSize >= content.length;

        if (i > 0) {
          // Add small delay between chunks (except first chunk)
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        callback(chunk, isLast);
      }
    } else {
      // For longer, more complex responses, stream by paragraph or sentence
      const paragraphs = content.split('\n\n').filter(p => p.trim());

      if (paragraphs.length > 1) {
        // Stream paragraph by paragraph
        for (let i = 0; i < paragraphs.length; i++) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }

          const isLast = i === paragraphs.length - 1;
          callback(paragraphs[i] + (isLast ? '' : '\n\n'), isLast);
        }
      } else {
        // If only one paragraph, stream by sentence
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

module.exports = router;