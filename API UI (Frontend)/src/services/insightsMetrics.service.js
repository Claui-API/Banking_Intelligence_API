// src/services/insightsMetrics.service.js - Enhanced with Query Analysis
import api from './api';
import logger from '../utils/logger';

// Enhanced cache store with more detailed tracking
const cache = {
  system: { data: null, timestamp: 0 },
  history: { data: null, timestamp: 0, days: null },
  queryTypes: { data: null, timestamp: 0 },
  users: { data: null, timestamp: 0, enhanced: false },
  userAnalysis: new Map(), // Individual user analysis cache
  // Cache expiration time (30 seconds for most, 5 minutes for analysis)
  expirationTime: 30 * 1000,
  analysisExpirationTime: 5 * 60 * 1000
};

// In-flight request trackers to prevent duplicate requests
const pendingRequests = {
  system: null,
  history: null,
  queryTypes: null,
  users: null,
  userAnalysis: new Map()
};

export const insightsMetricsService = {
  // Get system-wide insights metrics with caching and deduplication
  getSystemMetrics: async () => {
    try {
      // Check cache first
      const now = Date.now();
      if (cache.system.data && (now - cache.system.timestamp) < cache.expirationTime) {
        logger.info('Using cached system metrics data');
        return cache.system.data;
      }

      // Check if there's already a request in progress
      if (pendingRequests.system) {
        logger.info('Reusing in-flight system metrics request');
        return pendingRequests.system;
      }

      // Create a new request promise
      pendingRequests.system = (async () => {
        try {
          const response = await api.get('/insights-metrics/system');

          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch insights system metrics');
          }

          // Cache the successful response
          cache.system.data = response.data.data;
          cache.system.timestamp = Date.now();

          logger.info('Insights system metrics retrieved and cached');

          return response.data.data;
        } finally {
          // Clear the pending request reference
          pendingRequests.system = null;
        }
      })();

      // Return the promise
      return pendingRequests.system;
    } catch (error) {
      logger.logError('Insights System Metrics Error', error);

      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view insights system metrics.');
        }

        const errorMessage = error.response.data?.message || 'Failed to fetch insights system metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up insights metrics request');
      }
    }
  },

  // Get historical insights metrics with caching and deduplication
  getHistoricalMetrics: async (days = 7) => {
    try {
      const cacheKey = `history_${days}`;

      // Check cache first
      const now = Date.now();
      if (cache.history.data && cache.history.days === days &&
        (now - cache.history.timestamp) < cache.expirationTime) {
        logger.info('Using cached historical metrics data');
        return cache.history.data;
      }

      // Check if there's already a request in progress
      if (pendingRequests.history && pendingRequests.history.days === days) {
        logger.info('Reusing in-flight historical metrics request');
        return pendingRequests.history.promise;
      }

      // Create a new request promise
      const promise = (async () => {
        try {
          const response = await api.get(`/insights-metrics/history?days=${days}`);

          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch historical insights metrics');
          }

          // Cache the successful response
          cache.history.data = response.data.data;
          cache.history.days = days;
          cache.history.timestamp = Date.now();

          logger.info('Historical insights metrics retrieved and cached');

          return response.data.data;
        } finally {
          // Clear the pending request reference
          pendingRequests.history = null;
        }
      })();

      // Store the promise and days for deduplication
      pendingRequests.history = {
        promise,
        days
      };

      // Return the promise
      return promise;
    } catch (error) {
      logger.logError('Historical Insights Metrics Error', error);

      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view historical insights metrics.');
        }

        const errorMessage = error.response.data?.message || 'Failed to fetch historical insights metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up historical insights metrics request');
      }
    }
  },

  // Get query type distribution metrics
  getQueryTypeMetrics: async () => {
    try {
      // Check cache first
      const now = Date.now();
      if (cache.queryTypes.data && (now - cache.queryTypes.timestamp) < cache.expirationTime) {
        logger.info('Using cached query type metrics data');
        return cache.queryTypes.data;
      }

      // Check if there's already a request in progress
      if (pendingRequests.queryTypes) {
        logger.info('Reusing in-flight query type metrics request');
        return pendingRequests.queryTypes;
      }

      // Create a new request promise
      pendingRequests.queryTypes = (async () => {
        try {
          const response = await api.get('/insights-metrics/query-types');

          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch insights query type metrics');
          }

          // Cache the successful response
          cache.queryTypes.data = response.data.data;
          cache.queryTypes.timestamp = Date.now();

          logger.info('Insights query type metrics retrieved and cached');

          return response.data.data;
        } finally {
          // Clear the pending request reference
          pendingRequests.queryTypes = null;
        }
      })();

      // Return the promise
      return pendingRequests.queryTypes;
    } catch (error) {
      logger.logError('Insights Query Type Metrics Error', error);
      throw error;
    }
  },

  // Get enhanced user metrics with AI analysis
  getUserMetrics: async (options = {}) => {
    try {
      const cacheKey = options.enhanced ? 'users_enhanced' : 'users';

      // Check cache first
      const now = Date.now();
      if (cache.users.data && cache.users.enhanced === options.enhanced &&
        (now - cache.users.timestamp) < cache.expirationTime) {
        logger.info('Using cached user metrics data');
        return cache.users.data;
      }

      // Check if there's already a request in progress with the same options
      if (pendingRequests.users && pendingRequests.users.enhanced === options.enhanced) {
        logger.info('Reusing in-flight user metrics request');
        return pendingRequests.users.promise;
      }

      // Build query parameters
      const params = {};
      if (options.enhanced) {
        params.enhanced = 'true';
      }

      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/insights-metrics/users?${queryString}` : '/insights-metrics/users';

      // Create a new request promise
      const promise = (async () => {
        try {
          const response = await api.get(url);

          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch user insights metrics');
          }

          // Cache the successful response
          cache.users.data = response.data.data;
          cache.users.enhanced = options.enhanced;
          cache.users.timestamp = Date.now();

          logger.info('User insights metrics retrieved and cached');

          return response.data.data;
        } finally {
          // Clear the pending request reference
          pendingRequests.users = null;
        }
      })();

      // Store the promise and options for deduplication
      pendingRequests.users = {
        promise,
        enhanced: options.enhanced
      };

      // Return the promise
      return promise;
    } catch (error) {
      logger.logError('User Insights Metrics Error', error);
      throw error;
    }
  },

  // Get detailed analysis for a specific user
  getUserAnalysis: async (userId) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check cache first
      const now = Date.now();
      const cachedAnalysis = cache.userAnalysis.get(userId);

      if (cachedAnalysis && (now - cachedAnalysis.timestamp) < cache.analysisExpirationTime) {
        logger.info(`Using cached analysis for user ${userId}`);
        return cachedAnalysis.data;
      }

      // Check if there's already a request in progress
      if (pendingRequests.userAnalysis.has(userId)) {
        logger.info(`Reusing in-flight analysis request for user ${userId}`);
        return pendingRequests.userAnalysis.get(userId);
      }

      // Create a new request promise
      const promise = (async () => {
        try {
          const response = await api.get(`/insights-metrics/users/${userId}/analysis`);

          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch user analysis');
          }

          // Cache the successful response
          cache.userAnalysis.set(userId, {
            data: response.data.data,
            timestamp: Date.now()
          });

          logger.info(`User analysis retrieved and cached for user ${userId}`);

          return response.data.data;
        } finally {
          // Clear the pending request reference
          pendingRequests.userAnalysis.delete(userId);
        }
      })();

      // Store the promise for deduplication
      pendingRequests.userAnalysis.set(userId, promise);

      // Return the promise
      return promise;
    } catch (error) {
      logger.logError(`User Analysis Error for ${userId}`, error);
      throw error;
    }
  },

  // Analyze multiple users in batch
  analyzeBatchUsers: async (userIds) => {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('UserIds array is required');
      }

      if (userIds.length > 20) {
        throw new Error('Maximum 20 users can be analyzed at once');
      }

      const response = await api.post('/insights-metrics/analyze-batch', {
        userIds
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to analyze users');
      }

      logger.info(`Batch analysis completed for ${userIds.length} users`);

      return response.data.data;
    } catch (error) {
      logger.logError('Batch User Analysis Error', error);
      throw error;
    }
  },

  // Get query analysis agent status
  getAgentStatus: async () => {
    try {
      const response = await api.get('/insights-metrics/agent/status');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get agent status');
      }

      return response.data.data;
    } catch (error) {
      logger.logError('Agent Status Error', error);
      throw error;
    }
  },

  // Clean up agent cache
  cleanupAgentCache: async () => {
    try {
      const response = await api.post('/insights-metrics/agent/cleanup');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to cleanup agent cache');
      }

      logger.info('Agent cache cleanup completed');

      return response.data.data;
    } catch (error) {
      logger.logError('Agent Cache Cleanup Error', error);
      throw error;
    }
  },

  // Get comprehensive analytics summary
  getAnalyticsSummary: async () => {
    try {
      // Check cache first - use shorter cache time for summary
      const now = Date.now();
      const cacheKey = 'analytics_summary';
      const shortCacheTime = 15 * 1000; // 15 seconds

      if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < shortCacheTime) {
        logger.info('Using cached analytics summary');
        return cache[cacheKey].data;
      }

      const response = await api.get('/insights-metrics/analytics/summary');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get analytics summary');
      }

      // Cache the response
      cache[cacheKey] = {
        data: response.data.data,
        timestamp: now
      };

      logger.info('Analytics summary retrieved and cached');

      return response.data.data;
    } catch (error) {
      logger.logError('Analytics Summary Error', error);
      throw error;
    }
  },

  // Clear all caches
  clearCache: () => {
    cache.system = { data: null, timestamp: 0 };
    cache.history = { data: null, timestamp: 0, days: null };
    cache.queryTypes = { data: null, timestamp: 0 };
    cache.users = { data: null, timestamp: 0, enhanced: false };
    cache.userAnalysis.clear();

    // Clear any additional cache entries
    Object.keys(cache).forEach(key => {
      if (typeof cache[key] === 'object' && cache[key].timestamp) {
        cache[key] = { data: null, timestamp: 0 };
      }
    });

    logger.info('All insights metrics caches cleared');
  },

  // Get cache statistics
  getCacheStats: () => {
    const now = Date.now();
    return {
      system: {
        cached: cache.system.data !== null,
        age: cache.system.timestamp ? now - cache.system.timestamp : 0
      },
      history: {
        cached: cache.history.data !== null,
        age: cache.history.timestamp ? now - cache.history.timestamp : 0,
        days: cache.history.days
      },
      queryTypes: {
        cached: cache.queryTypes.data !== null,
        age: cache.queryTypes.timestamp ? now - cache.queryTypes.timestamp : 0
      },
      users: {
        cached: cache.users.data !== null,
        age: cache.users.timestamp ? now - cache.users.timestamp : 0,
        enhanced: cache.users.enhanced
      },
      userAnalysis: {
        count: cache.userAnalysis.size,
        entries: Array.from(cache.userAnalysis.keys())
      },
      expirationTimes: {
        standard: cache.expirationTime,
        analysis: cache.analysisExpirationTime
      }
    };
  }
};