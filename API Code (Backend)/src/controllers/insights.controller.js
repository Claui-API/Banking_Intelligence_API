// src/controllers/insights.controller.js - Updated to use only standard Cohere service
const cohereService = require('../services/cohere.service');
const databaseService = require('../services/data.service');
// Remove RAG service: const cohereRagService = require('../services/cohere-rag.service');
const logger = require('../utils/logger');

/**
 * Determine the type of query
 * @param {string} query - The user's query
 * @returns {string} - The query type: 'greeting', 'joke', 'budgeting', 'spending', 'financial'
 */
function classifyQuery(query) {
  if (!query) return 'financial'; // Default to financial if empty
  
  // Normalize the query (trim and lowercase)
  const normalizedQuery = query.trim().toLowerCase();
  
  // Check for greetings
  if (/^(hi|hello|hey|howdy|hola|yo|sup|greetings)$/i.test(normalizedQuery)) {
    return 'greeting';
  }
  
  // Check for extended greetings with CLAU's name or punctuation
  const greetingPatterns = [
    /^(hi|hello|hey|howdy|hola)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(good\s+(morning|afternoon|evening))(\s+clau)?(\s*[!,.?]*)$/i,
    /^(what'?s\s+up|sup|yo)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(greetings|welcome)(\s+clau)?(\s*[!,.?]*)$/i
  ];
  
  if (greetingPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return 'greeting';
  }
  
  // Check for joke requests
  if (/tell\s+me\s+a\s+joke|got\s+any\s+jokes|joke|make\s+me\s+laugh|something\s+funny/i.test(normalizedQuery)) {
    return 'joke';
  }
  
  // Check for budgeting queries
  if (/budget|how\s+to\s+budget|budgeting|create\s+a\s+budget|manage\s+budget|budget\s+plan|monthly\s+budget/i.test(normalizedQuery)) {
    return 'budgeting';
  }
  
  // Check for spending queries
  if (/spend|spending|how\s+much\s+did\s+i\s+spend|spent|where\s+is\s+my\s+money\s+going|expenses|expense|track\s+spending|spending\s+habits/i.test(normalizedQuery)) {
    return 'spending';
  }
  
  // Check for saving queries
  if (/save|saving|savings|how\s+to\s+save|save\s+money|save\s+more|increase\s+savings/i.test(normalizedQuery)) {
    return 'saving';
  }
  
  // Check for investment queries
  if (/invest|investing|investment|stock|stocks|etf|mutual\s+fund|portfolio|retirement/i.test(normalizedQuery)) {
    return 'investing';
  }
  
  // Check for debt queries
  if (/debt|loan|credit\s+card|mortgage|pay\s+off|interest\s+rate|refinance/i.test(normalizedQuery)) {
    return 'debt';
  }
  
  // Default to financial for any other queries
  return 'financial';
}

/**
 * Controller for financial insights endpoints
 */
class InsightsController {
  constructor() {
    // Add any controller initialization here
  }

  /**
   * Generate personal financial insights
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async generateInsights(req, res, next) {
    try {
      const startTime = Date.now(); // Track performance
      const { userId } = req.auth;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      const { query, requestId = `req_${Date.now()}` } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query is required to generate insights'
        });
      }
      
      // Classify the query using our enhanced classifier
      const queryType = classifyQuery(query);
      logger.info(`Query classified as: ${queryType}`, { query, requestId });
      
      // Store query type in req.body for middleware
      req.body.queryType = queryType;
      
      // Get user data
      let userData;
      try {
        userData = await databaseService.getUserFinancialData(userId);
        logger.info(`Retrieved financial data for user ${userId}`, { requestId });
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for user ${userId}: ${error.message}`, { requestId });
          userData = databaseService.getMockUserData(userId);
        } else {
          return res.status(404).json({
            success: false,
            message: `Could not retrieve financial data: ${error.message}`
          });
        }
      }
      
      // Generate insights using standard Cohere service
      let insights;
      
      try {
        // Direct call to Cohere service
        logger.info(`Generating insights with standard Cohere service for user ${userId}`, { requestId });
        
        insights = await cohereService.generateInsights({
          ...userData,
          query,
          queryType,
          requestId
        });
        
        const generateDuration = Date.now() - startTime;
        logger.info(`Generated insights in ${generateDuration}ms`, { 
          requestId,
          generateDuration 
        });

        // Add compatibility flags for metrics and frontend
        insights = {
          ...insights,
          processingTime: Date.now() - startTime,
          fromCache: false,
          usedRag: false,
          documentsUsed: 0,
          documentIds: []
        };
        
      } catch (error) {
        logger.error('Error generating insights with Cohere service:', error, { requestId });
        
        // In development mode, provide mock insights if all else fails
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Using mock insights as last resort', { requestId });
          
          // Generate mock response based on query type
          insights = this._generateMockInsight(queryType, userData, query);
          
          // Add compatibility flags
          insights = {
            ...insights,
            processingTime: Date.now() - startTime,
            fromCache: false,
            usedRag: false,
            documentsUsed: 0,
            documentIds: []
          };
        } else {
          return res.status(500).json({
            success: false,
            message: `Failed to generate insights: ${error.message}`
          });
        }
      }
      
      // Return the insights with metrics flags
      return res.status(200).json({
        success: true,
        data: {
          query,
          insights: {
            ...insights,
            fromCache: false,           // Explicitly include in insights
            usedRag: false,             // Explicitly include in insights
            documentsUsed: 0,           // Explicitly include in insights
            documentIds: []             // Explicitly include in insights
          },
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          ragEnabled: false,            // For backwards compatibility
          fromCache: false,             // For backwards compatibility
          documentsUsed: 0,             // For backwards compatibility
          documentIds: []               // For backwards compatibility
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
              insight: `Here's a financial analysis based on mock data.\n\nYour spending patterns show a healthy balance with approximately 30% going to essential expenses. Your savings rate is around 15%, which is good but could be improved.\n\nConsider reducing discretionary spending on dining and entertainment by $100 per month to boost your savings rate.`,
              timestamp: new Date().toISOString(),
              queryType: 'financial',
              fromCache: false,
              usedRag: false,
              documentsUsed: 0,
              documentIds: []
            },
            timestamp: new Date().toISOString(),
            error: true,
            ragEnabled: false,
            fromCache: false,
            documentsUsed: 0,
            documentIds: []
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
        
        // No need to process data for RAG anymore
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for financial summary - user ${userId}: ${error.message}`);
          userData = databaseService.getMockUserData(userId);
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
          const mockData = databaseService.getMockUserData(userId);
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
        const mockData = databaseService.getMockUserData(req.auth.userId || 'default-user');
        
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
  
  /**
   * Generate mock insights as a last resort
   * @param {string} queryType - Query type
   * @param {Object} userData - User's financial data
   * @param {string} query - User's query
   * @returns {Object} - Mock insight
   */
  _generateMockInsight(queryType, userData, query) {
    switch(queryType) {
      case 'greeting':
        return {
          insight: `Hey ${userData.userProfile?.name || 'there'}! 👋 How can I help with your finances today?`,
          timestamp: new Date().toISOString(),
          queryType
        };
      case 'joke':
        return {
          insight: `Why don't scientists trust atoms? Because they make up everything! 😂 Need any financial help today?`,
          timestamp: new Date().toISOString(),
          queryType
        };
      case 'budgeting':
        const income = this._calculateMonthlyIncome(userData);
        return {
          insight: `Looking at your finances, I'd recommend a 50/30/20 budget: 50% on necessities, 30% on wants, and 20% on savings. Based on your monthly income of $${income.toFixed(2)}, you should aim to save about $${(income * 0.2).toFixed(2)} each month. 💰`,
          timestamp: new Date().toISOString(),
          queryType
        };
      case 'spending':
        const expenses = this._calculateMonthlyExpenses(userData);
        const topCategories = this._getTopExpenseCategories(userData);
        return {
          insight: `In the past month, you've spent $${expenses.toFixed(2)}, mostly on ${topCategories[0] || 'groceries'} ($${(expenses * 0.25).toFixed(2)}), ${topCategories[1] || 'dining'} ($${(expenses * 0.15).toFixed(2)}), and ${topCategories[2] || 'entertainment'} ($${(expenses * 0.1).toFixed(2)}). 📊`,
          timestamp: new Date().toISOString(),
          queryType
        };
      default:
        return {
          insight: `Here's an analysis of your finances based on your query: "${query}"\n\nYour overall financial health is good. Your spending patterns show that you're managing your budget effectively, with approximately 20% of your income going to savings.\n\nYou could optimize your finances further by reviewing your subscription services, which currently account for about $75 monthly.`,
          timestamp: new Date().toISOString(),
          queryType
        };
    }
  }
  
  // Helper methods for calculating financial metrics
  _calculateMonthlyIncome(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return 0;
    }
    
    // Filter for income transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    
    return userData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }
  
  _calculateMonthlyExpenses(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return 0;
    }
    
    // Filter for expense transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    
    return userData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }
  
  _getTopExpenseCategories(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return [];
    }
    
    // Count categories for expense transactions
    const categoryCounts = {};
    userData.transactions
      .filter(t => t.amount < 0)
      .forEach(transaction => {
        if (transaction.category) {
          categoryCounts[transaction.category] = 
            (categoryCounts[transaction.category] || 0) + 1;
        }
      });
    
    // Sort by count
    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
  }
  
  /**
   * Get API metrics for admin dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getApiMetrics(req, res) {
    try {
      // Check if user has admin role
      if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required for metrics'
        });
      }
      
      // If insights-metrics middleware is available, use it
      if (req.app.get('insightMetricsAvailable')) {
        const { getSystemInsightMetrics } = require('../middleware/insights-metrics.middleware');
        const metrics = await getSystemInsightMetrics();
        return res.status(200).json({
          success: true,
          data: metrics
        });
      }
      
      // Otherwise, return mock metrics
      return res.status(200).json({
        success: true,
        data: {
          totalQueries: 1432,
          successfulQueries: 1398,
          failedQueries: 34,
          successRate: '97.6%',
          avgResponseTime: 456,
          minResponseTime: 250,
          maxResponseTime: 1750,
          todayQueries: Math.floor(Math.random() * 100 + 50),
          queryTypeDistribution: {
            financial: 487,
            budgeting: 302,
            saving: 276,
            spending: 201,
            investing: 89,
            debt: 77
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error retrieving API metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve API metrics'
      });
    }
  }
}

module.exports = new InsightsController();