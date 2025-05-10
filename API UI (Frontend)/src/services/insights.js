// src/services/insights.js with improved API data handling
import api from './api';
import logger from '../utils/logger';

export const insightsService = {
  // Get financial summary
  getFinancialSummary: async () => {
    try {
      logger.info('Attempting to fetch financial summary');
      const response = await api.get('/insights/summary');

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
        return {
          totalBalance: 20000.25,
          netWorth: 35000.50,
          accountCount: 3,
          accounts: [
            {
              accountId: "acc-mock-1",
              name: "Mock Checking",
              type: "Checking",
              balance: 5000.75,
              currency: "USD"
            },
            {
              accountId: "acc-mock-2",
              name: "Mock Savings",
              type: "Savings",
              balance: 15000.50,
              currency: "USD"
            },
            {
              accountId: "acc-mock-3",
              name: "Mock Credit Card",
              type: "Credit Card",
              balance: -1200.25,
              currency: "USD"
            }
          ],
          recentTransactions: [
            {
              transactionId: "txn-mock-1",
              date: new Date().toISOString(),
              description: "Grocery Store",
              category: "Food",
              amount: -125.50
            },
            {
              transactionId: "txn-mock-2",
              date: new Date().toISOString(),
              description: "Salary Deposit",
              category: "Income",
              amount: 3000.00
            },
            {
              transactionId: "txn-mock-3",
              date: new Date().toISOString(),
              description: "Netflix",
              category: "Entertainment",
              amount: -15.99
            },
            {
              transactionId: "txn-mock-4",
              date: new Date().toISOString(),
              description: "Gas Station",
              category: "Transportation",
              amount: -45.50
            },
            {
              transactionId: "txn-mock-5",
              date: new Date().toISOString(),
              description: "Amazon",
              category: "Shopping",
              amount: -67.99
            }
          ],
          timestamp: new Date().toISOString()
        };
      }

      throw error;
    }
  },

  // Generate personalized insights with request ID tracking and improved error handling
  generateInsights: async (query, requestId) => {
    try {
      logger.info('Generating insights', {
        query,
        requestId
      });

      // Include the requestId in the request body
      const response = await api.post('/insights/generate', {
        query,
        requestId // Pass the requestId to the backend
      });

      logger.info('Insights generated', {
        status: response.status,
        success: response.data?.success,
        requestId
      });

      // Less strict validation - don't throw errors, just log warnings
      if (!response.data) {
        logger.warn('Empty response from insights API');
      } else if (!response.data.success && response.data.success !== undefined) {
        logger.warn('API returned error status for insights');
      } else if (!response.data.data && response.data.success) {
        logger.warn('Invalid insights response structure: missing data property');
      }

      // If response has data.data, use it, otherwise try to use response.data directly
      const resultData = response.data?.data || response.data;

      // Return the data with the requestId
      return {
        ...resultData,
        requestId // Ensure the requestId is in the response
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
  }
};

export default insightsService;