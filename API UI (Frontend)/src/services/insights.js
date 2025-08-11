// src/services/insights.js with added mode tracking and data source management
import api from './api';
import logger from '../utils/logger';

export const insightsService = {
  // Get financial summary with user validation
  getFinancialSummary: async () => {
    try {
      logger.info('Attempting to fetch financial summary');
      // Add a unique timestamp to prevent caching
      const timestamp = Date.now();
      const response = await api.get(`/users/financial-data?_t=${timestamp}`);

      logger.info('Financial summary retrieved', {
        status: response.status,
        dataAvailable: !!response.data,
        success: response.data?.success
      });

      // Check if the response has data property - but don't throw an error if missing
      // Instead, log a warning and try to handle the data as is
      if (!response.data) {
        logger.warn('Empty response received from API');
      } else if (!response.data.success && response.data.success !== undefined) {
        logger.warn('API returned error status');
      } else if (!response.data.data && response.data.success) {
        logger.warn('Invalid response structure: missing data property');
      }

      // If response.data.data exists, use it, otherwise try to use response.data directly
      const resultData = response.data?.data || response.data;

      // Get user ID from local storage for validation
      const userId = localStorage.getItem('userId');

      // Validate that the response contains the expected userId if present
      if (resultData?.userId && userId && resultData.userId !== userId) {
        logger.error('User ID mismatch in financial summary response', {
          expected: userId,
          received: resultData.userId
        });
        throw new Error('Data ownership validation failed');
      }

      // Log the structure of what we're returning
      logger.info('Financial summary data structure', {
        isDirectResponseData: !response.data?.data,
        keys: Object.keys(resultData),
        accountCount: resultData.accounts?.length,
        transactionCount: resultData.recentTransactions?.length
      });

      return resultData;
    } catch (error) {
      logger.logError('Financial Summary Fetch', error);

      // More detailed error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        logger.error('Server responded with error', {
          status: error.response.status,
          data: error.response.data
        });

        // If we got a 404 with mock data in development, we can try to extract and use it
        if (process.env.NODE_ENV === 'development' &&
          error.response.status === 404 &&
          error.response.data?.mockData) {
          logger.info('Using mock data from error response');
          return error.response.data.mockData;
        }
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('No response received', {
          request: error.request
        });
      } else {
        // Something happened in setting up the request
        logger.error('Error setting up request', {
          message: error.message
        });
      }

      // In development mode, return hard-coded mock data as last resort
      if (process.env.NODE_ENV === 'development') {
        logger.info('Falling back to hard-coded mock data in frontend');

        // Get user ID from local storage
        const userId = localStorage.getItem('userId') || 'anonymous';

        // Create a unique prefix based on userId to make mock data unique per user
        const userPrefix = userId.substring(0, 4);

        return {
          totalBalance: 20000.25,
          netWorth: 35000.50,
          accountCount: 3,
          accounts: [
            {
              accountId: `acc-mock-${userPrefix}-1`,
              name: "Mock Checking",
              type: "Checking",
              balance: 5000.75,
              currency: "USD"
            },
            {
              accountId: `acc-mock-${userPrefix}-2`,
              name: "Mock Savings",
              type: "Savings",
              balance: 15000.50,
              currency: "USD"
            },
            {
              accountId: `acc-mock-${userPrefix}-3`,
              name: "Mock Credit Card",
              type: "Credit Card",
              balance: -1200.25,
              currency: "USD"
            }
          ],
          recentTransactions: [
            {
              transactionId: `txn-mock-${userPrefix}-1`,
              date: new Date().toISOString(),
              description: "Grocery Store",
              category: "Food",
              amount: -125.50
            },
            {
              transactionId: `txn-mock-${userPrefix}-2`,
              date: new Date().toISOString(),
              description: "Salary Deposit",
              category: "Income",
              amount: 3000.00
            },
            {
              transactionId: `txn-mock-${userPrefix}-3`,
              date: new Date().toISOString(),
              description: "Netflix",
              category: "Entertainment",
              amount: -15.99
            },
            {
              transactionId: `txn-mock-${userPrefix}-4`,
              date: new Date().toISOString(),
              description: "Gas Station",
              category: "Transportation",
              amount: -45.50
            },
            {
              transactionId: `txn-mock-${userPrefix}-5`,
              date: new Date().toISOString(),
              description: "Amazon",
              category: "Shopping",
              amount: -67.99
            }
          ],
          timestamp: new Date().toISOString(),
          userId: userId // Include userId for validation
        };
      }

      throw error;
    }
  },

  // Generate personalized insights with request ID tracking, user validation, and improved error handling
  // ENHANCED: Added customOptions parameter and mode tracking
  generateInsights: async (query, requestId, customOptions = {}) => {
    try {
      // Get integration mode from localStorage or default to 'plaid'
      const currentMode = localStorage.getItem('integrationMode') || 'plaid';
      const isConnected = localStorage.getItem('plaidConnected') === 'true';

      // Log request with mode information
      logger.info('Generating insights', {
        query,
        requestId,
        mode: customOptions.integrationMode || currentMode,
        isUsingConnectedData: customOptions.useConnectedData !== undefined
          ? customOptions.useConnectedData
          : (currentMode === 'plaid' && isConnected),
        isUsingDirectData: customOptions.useDirectData !== undefined
          ? customOptions.useDirectData
          : currentMode === 'direct'
      });

      // Get user ID from local storage for validation
      const userId = localStorage.getItem('userId');

      // Prepare request payload with explicit mode flags
      const payload = {
        query,
        requestId, // Pass the requestId to the backend
        userId, // Pass the userId for validation
        // Add mode flags with defaults if not provided in customOptions
        integrationMode: customOptions.integrationMode || currentMode,
        useConnectedData: customOptions.useConnectedData !== undefined
          ? customOptions.useConnectedData
          : (currentMode === 'plaid' && isConnected),
        useDirectData: customOptions.useDirectData !== undefined
          ? customOptions.useDirectData
          : currentMode === 'direct',
        // Add an explicit data source marker that the backend can check
        dataSourceMode: customOptions.integrationMode || currentMode,
        // Include any financial data passed in customOptions
        financialData: customOptions.financialData
      };

      // Include the requestId, userId, and mode flags in the request body
      const response = await api.post('/insights/generate', payload);

      logger.info('Insights generated', {
        status: response.status,
        success: response.data?.success,
        requestId,
        mode: customOptions.integrationMode || currentMode
      });

      // Less strict validation - don't throw errors, just log warnings
      if (!response.data) {
        logger.warn('Empty response from insights API');
      } else if (!response.data.success && response.data.success !== undefined) {
        logger.warn('API returned error status for insights');
      } else if (!response.data.data && response.data.success) {
        logger.warn('Invalid insights response structure: missing data property');
      }

      // Validate that the response contains the expected userId if present
      if (response.data?.data?.userId && userId && response.data.data.userId !== userId) {
        logger.error('User ID mismatch in insights response', {
          expected: userId,
          received: response.data.data.userId
        });
        throw new Error('Data ownership validation failed');
      }

      // If response has data.data, use it, otherwise try to use response.data directly
      const resultData = response.data?.data || response.data;

      // Return the data with the requestId and add security checks
      return {
        ...resultData,
        requestId, // Ensure the requestId is in the response
        validated: true, // Flag to indicate data has been validated
        timestamp: resultData.timestamp || new Date().toISOString(),
        // Add mode information to the response for frontend validation
        integrationMode: customOptions.integrationMode || currentMode,
        usingConnectedData: payload.useConnectedData,
        usingDirectData: payload.useDirectData
      };
    } catch (error) {
      logger.logError('Insights Generation', error);

      // Create enhanced error object with status and message
      const enhancedError = new Error(
        // Extract message from response if available
        error.response?.data?.message ||
        "Failed to generate insights"
      );

      // Add status code to error object
      enhancedError.status = error.response?.status || 500;

      // More detailed error logging
      if (error.response) {
        logger.error('Server responded with error', {
          status: error.response.status,
          data: error.response.data,
          requestId
        });
      } else if (error.request) {
        logger.error('No response received', {
          request: error.request,
          requestId
        });
      } else {
        logger.error('Error setting up request', {
          message: error.message,
          requestId
        });
      }

      // Throw the enhanced error
      throw enhancedError;
    }
  },

  // ADDED: Set the current integration mode in localStorage
  setIntegrationMode: (mode) => {
    if (mode !== 'plaid' && mode !== 'direct') {
      logger.warn(`Invalid integration mode: ${mode}`);
      return false;
    }

    try {
      localStorage.setItem('integrationMode', mode);
      logger.info(`Integration mode set to ${mode}`);
      return true;
    } catch (error) {
      logger.error('Error setting integration mode:', error);
      return false;
    }
  },

  // ADDED: Set the Plaid connection status in localStorage
  setPlaidConnected: (isConnected) => {
    try {
      localStorage.setItem('plaidConnected', isConnected ? 'true' : 'false');
      logger.info(`Plaid connection status set to ${isConnected}`);
      return true;
    } catch (error) {
      logger.error('Error setting Plaid connection status:', error);
      return false;
    }
  },

  // New method to clear cached user data for better security
  clearUserCache: async () => {
    try {
      // Clear any locally cached data
      logger.info('Clearing user data cache');

      // Clear all user-specific data from localStorage except auth tokens
      const keysToPreserve = ['token', 'refreshToken'];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      }

      // Clear all sessionStorage data
      sessionStorage.clear();

      // Try to call the server-side cache clearing endpoint
      try {
        await api.post('/users/session/clear');
      } catch (clearError) {
        logger.warn('Error clearing server-side cache:', clearError);
        // Continue even if server-side clearing fails
      }

      return true;
    } catch (error) {
      logger.error('Error clearing user cache:', error);
      // Return true anyway to allow logout to proceed
      return true;
    }
  }
};

export default insightsService;