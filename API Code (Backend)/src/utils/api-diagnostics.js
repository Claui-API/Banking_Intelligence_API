// utils/api-diagnostics.js
const logger = require('./logger');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Utility to diagnose API connectivity issues
 */
class ApiDiagnostics {
  /**
   * Run a series of diagnostic tests for the Cohere API
   * @returns {Object} Test results
   */
  static async testCohereApi() {
    logger.info('Running Cohere API diagnostics...');
    const results = {
      apiKeyStatus: 'unknown',
      connectivity: 'unknown',
      rateLimits: 'unknown',
      errors: []
    };

    try {
      // Check if API key is set
      const apiKey = process.env.COHERE_API_KEY;
      if (!apiKey) {
        results.apiKeyStatus = 'missing';
        results.errors.push('COHERE_API_KEY environment variable is not set');
        logger.error('COHERE_API_KEY environment variable is not set');
      } else {
        results.apiKeyStatus = 'set';
        
        // Test connectivity with a simple request
        try {
          const response = await axios.post('https://api.cohere.ai/v1/chat', 
            {
              model: 'command-r-08-2024',
              message: 'Hello, this is a test message.',
              max_tokens: 20
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Cohere-Version': '2023-05-24'
              },
              timeout: 10000 // 10 second timeout
            }
          );
          
          results.connectivity = 'successful';
          
          // Check rate limit headers
          const rateLimit = response.headers['x-ratelimit-limit'];
          const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
          const rateLimitReset = response.headers['x-ratelimit-reset'];
          
          if (rateLimit && rateLimitRemaining) {
            results.rateLimits = {
              limit: rateLimit,
              remaining: rateLimitRemaining,
              reset: rateLimitReset
            };
            
            logger.info('Cohere API rate limits:', results.rateLimits);
            
            if (parseInt(rateLimitRemaining) < 10) {
              results.errors.push(`Low rate limit remaining: ${rateLimitRemaining}/${rateLimit}`);
              logger.warn(`Low rate limit remaining: ${rateLimitRemaining}/${rateLimit}`);
            }
          }
          
          logger.info('Cohere API connectivity test successful');
        } catch (connectError) {
          results.connectivity = 'failed';
          
          // Get detailed error information
          if (connectError.response) {
            // The request was made and the server responded with a non-2xx status
            const status = connectError.response.status;
            const data = connectError.response.data;
            
            results.errors.push(`API responded with status ${status}: ${JSON.stringify(data)}`);
            
            if (status === 401 || status === 403) {
              results.apiKeyStatus = 'invalid';
              logger.error('Cohere API key appears to be invalid or expired');
            } else if (status === 429) {
              results.rateLimits = 'exceeded';
              logger.error('Cohere API rate limit exceeded');
            }
            
            logger.error('Cohere API connectivity test failed with response:', {
              status,
              data
            });
          } else if (connectError.request) {
            // The request was made but no response was received
            results.errors.push('No response received from Cohere API. Possible network issue.');
            logger.error('No response received from Cohere API. Possible network issue.', {
              error: connectError.message
            });
          } else {
            // Something happened in setting up the request
            results.errors.push(`Error setting up request: ${connectError.message}`);
            logger.error('Error setting up Cohere API request:', connectError);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Unexpected error during diagnostics: ${error.message}`);
      logger.error('Unexpected error during Cohere API diagnostics:', error);
    }
    
    return results;
  }
  
  /**
   * Check network connectivity to common external services
   * @returns {Object} Connectivity test results
   */
  static async checkNetworkConnectivity() {
    logger.info('Running network connectivity tests...');
    const results = {
      google: 'unknown',
      cohere: 'unknown',
      errors: []
    };
    
    const testUrls = [
      { name: 'google', url: 'https://www.google.com' },
      { name: 'cohere', url: 'https://api.cohere.ai' }
    ];
    
    for (const test of testUrls) {
      try {
        const response = await axios.get(test.url, { 
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        
        results[test.name] = {
          status: response.status,
          success: response.status >= 200 && response.status < 300
        };
        
        logger.info(`Network connectivity to ${test.url}:`, results[test.name]);
      } catch (error) {
        results[test.name] = { success: false, error: error.message };
        results.errors.push(`Failed to connect to ${test.url}: ${error.message}`);
        logger.error(`Network connectivity test to ${test.url} failed:`, error.message);
      }
    }
    
    return results;
  }
}

module.exports = ApiDiagnostics;