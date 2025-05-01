// src/services/insightsMetrics.service.js
import api from './api';
import logger from '../utils/logger';

// Cache store with expiration
const cache = {
  system: { data: null, timestamp: 0 },
  history: { data: null, timestamp: 0 },
  queryTypes: { data: null, timestamp: 0 },
  users: { data: null, timestamp: 0 },
  // Cache expiration time (30 seconds)
  expirationTime: 30 * 1000
};

// In-flight request trackers to prevent duplicate requests
const pendingRequests = {
  system: null,
  history: null,
  queryTypes: null,
  users: null
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
          const response = await api.get('/insights/metrics/system');
          
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
          const response = await api.get(`/insights/metrics/history?days=${days}`);
          
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
          const response = await api.get('/insights/metrics/query-types');
          
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
      const url = queryString ? `/insights/metrics/users?${queryString}` : '/insights/metrics/users';
      
      // Create a new request promise
      const promise = (async () => {
        try {
          const response = await api.get(url);
          
          if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to fetch insights user metrics');
          }
          
          // Cache the successful response
          cache.users.data = response.data.data;
          cache.users.enhanced = options.enhanced;
          cache.users.timestamp = Date.now();
          
          logger.info(`Insights user metrics retrieved and cached (enhanced: ${!!options.enhanced})`);
          
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
      logger.logError('Insights User Metrics Error', error);
      throw error;
    }
  },
  
  // Method to force refresh all cached data
  refreshAllMetrics: async () => {
    // Clear all cache
    cache.system.data = null;
    cache.history.data = null;
    cache.queryTypes.data = null;
    cache.users.data = null;
    
    // Fetch fresh data in parallel
    try {
      const [system, history, queryTypes, users] = await Promise.all([
        insightsMetricsService.getSystemMetrics(),
        insightsMetricsService.getHistoricalMetrics(),
        insightsMetricsService.getQueryTypeMetrics(),
        insightsMetricsService.getUserMetrics()
      ]);
      
      logger.info('All metrics refreshed successfully');
      
      return { system, history, queryTypes, users };
    } catch (error) {
      logger.logError('Error refreshing all metrics', error);
      throw error;
    }
  }
};

export default insightsMetricsService;