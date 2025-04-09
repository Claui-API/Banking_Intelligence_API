// Fixed insights.controller.js with independent greeting detection function
const cohereService = require('../services/cohere.service');
const databaseService = require('../services/data.service');
const logger = require('../utils/logger');

/**
 * Check if a query is just a simple greeting
 * @param {string} query - The user's query
 * @returns {boolean} - True if the query is just a greeting
 */
function isGreeting(query) {
  if (!query) return false;
  
  // Normalize the query (trim and lowercase)
  const normalizedQuery = query.trim().toLowerCase();
  
  // Check for simple one-word greetings
  if (/^(hi|hello|hey|howdy|hola|yo|sup|greetings)$/i.test(normalizedQuery)) {
    return true;
  }
  
  // Check for greetings with CLAU's name or punctuation
  const greetingPatterns = [
    /^(hi|hello|hey|howdy|hola)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(good\s+(morning|afternoon|evening))(\s+clau)?(\s*[!,.?]*)$/i,
    /^(what'?s\s+up|sup|yo)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(greetings|welcome)(\s+clau)?(\s*[!,.?]*)$/i
  ];
  
  return greetingPatterns.some(pattern => pattern.test(normalizedQuery));
}

/**
 * Controller for financial insights endpoints
 */
class InsightsController {
  /**
   * Generate personal financial insights
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async generateInsights(req, res, next) {
    try {
      const { userId } = req.auth;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query is required to generate insights'
        });
      }
      
      // Check if this is just a greeting - using the standalone function
      const isSimpleGreeting = isGreeting(query);
      logger.info(`Query classified as ${isSimpleGreeting ? 'greeting' : 'financial question'}`, {
        query
      });
      
      // Get user data for both greeting and financial queries
      let userData;
      try {
        userData = await databaseService.getUserFinancialData(userId);
        logger.info(`Retrieved financial data for user ${userId}`);
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for user ${userId}: ${error.message}`);
          userData = databaseService._getMockUserData(userId);
          
          // Log the mock data being used
          logger.info('Mock data details:', {
            accountCount: userData.accounts.length,
            transactionCount: userData.transactions.length
          });
        } else {
          return res.status(404).json({
            success: false,
            message: `Could not retrieve financial data: ${error.message}`
          });
        }
      }
      
      // Generate insights using Cohere
      let insights;
      try {
        // Pass the isGreeting flag to the Cohere service to adjust the prompt accordingly
        insights = await cohereService.generateInsights({
          ...userData,
          query,
          isGreeting: isSimpleGreeting // Pass the greeting flag to Cohere service
        });
      } catch (error) {
        logger.error('Error generating insights with Cohere:', error);
        
        // In development mode, provide mock insights if Cohere fails
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Using mock insights due to Cohere service error');
          
          if (isSimpleGreeting) {
            // Mock greeting response
            insights = {
              insight: `Hey ${userData.userProfile?.name || 'there'}! 👋 How can I help with your finances today?`,
              timestamp: new Date().toISOString(),
              isGreeting: true
            };
          } else {
            // Mock financial insight
            insights = {
              insight: `Here's an analysis of your finances based on your query: "${query}"\n\nYour overall financial health is good. Your spending patterns show that you're managing your budget effectively, with approximately **20%** of your income going to savings.\n\nYou could optimize your finances further by reviewing your subscription services, which currently account for about **$75** monthly.`,
              timestamp: new Date().toISOString()
            };
          }
        } else {
          return res.status(500).json({
            success: false,
            message: `Failed to generate insights: ${error.message}`
          });
        }
      }
      
      // Return the insights
      return res.status(200).json({
        success: true,
        data: {
          query,
          insights,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error generating insights:', error);
      
      // If we catch any error in development mode, return mock data
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Returning mock insights due to caught error');
        
        return res.status(200).json({
          success: true,
          data: {
            query: req.body.query || 'financial analysis',
            insights: {
              insight: `Here's a financial analysis based on mock data.\n\nYour spending patterns show a healthy balance with approximately **30%** going to essential expenses. Your savings rate is around **15%**, which is good but could be improved.\n\nConsider reducing discretionary spending on dining and entertainment by **$100** per month to boost your savings rate.`,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          }
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Get financial summary for the user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getFinancialSummary(req, res, next) {
    // This method remains unchanged
    try {
      const { userId } = req.auth; // Extracted from auth middleware
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      logger.info(`Getting financial summary for user: ${userId}`);
      
      // Get user financial data
      let userData;
      try {
        userData = await databaseService.getUserFinancialData(userId);
        logger.info(`Retrieved financial data for financial summary - user ${userId}`);
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for financial summary - user ${userId}: ${error.message}`);
          userData = databaseService._getMockUserData(userId);
          
          // Log the mock data being used
          logger.info('Mock data details for financial summary:', {
            accountCount: userData.accounts.length,
            transactionCount: userData.transactions.length
          });
        } else {
          return res.status(404).json({
            success: false,
            message: `Could not retrieve financial data: ${error.message}`
          });
        }
      }
      
      const { accounts, transactions } = userData;
      
      // Check if we have account and transaction data
      if (!accounts || !transactions) {
        logger.error(`Missing account or transaction data for user ${userId}`);
        
        // In development mode, provide default structure if data is missing
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Creating default account and transaction data in development');
          const mockData = databaseService._getMockUserData(userId);
          return res.status(200).json({
            success: true,
            data: {
              totalBalance: 20000.00,
              netWorth: 18800.00,
              accountCount: mockData.accounts.length,
              accounts: mockData.accounts,
              recentTransactions: mockData.transactions.slice(0, 5),
              timestamp: new Date().toISOString()
            }
          });
        } else {
          return res.status(500).json({
            success: false,
            message: 'Invalid financial data structure'
          });
        }
      }
      
      // Calculate summary metrics
      const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
      const netWorth = accounts.reduce((sum, account) => {
        // Credit card balances are negative, so we adjust for that
        return account.type === 'Credit Card' 
          ? sum - Math.abs(account.balance) 
          : sum + account.balance;
      }, 0);
      
      // Get recent transactions
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      
      // Return the summary
      return res.status(200).json({
        success: true,
        data: {
          totalBalance,
          netWorth,
          accountCount: accounts.length,
          accounts,
          recentTransactions,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error generating financial summary:', error);
      
      // If we catch any error in development mode, return mock data
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Returning mock financial summary due to caught error');
        const mockData = databaseService._getMockUserData(req.auth.userId || 'default-user');
        
        return res.status(200).json({
          success: true,
          data: {
            totalBalance: 18800.00,
            netWorth: 18800.00,
            accountCount: mockData.accounts.length,
            accounts: mockData.accounts,
            recentTransactions: mockData.transactions.slice(0, 5),
            timestamp: new Date().toISOString()
          }
        });
      }
      
      next(error);
    }
  }
}

module.exports = new InsightsController();