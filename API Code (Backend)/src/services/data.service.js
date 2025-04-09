// services/data.service.js
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const plaidService = require('./plaid.service');

dotenv.config();

/**
 * Service for accessing and managing financial data
 * Uses Plaid when available, falls back to mock data
 * No database models or MongoDB required
 */
class DataService {
  constructor() {
    this.mockDataStore = new Map(); // In-memory store for mock/cached data
    
    // Tokens cache - in production, use a secure storage solution
    // This is just for development purposes
    this.plaidTokensCache = new Map();
  }
  
  /**
   * Get user's financial data - either from Plaid or mock data
   * @param {string} userId - User ID
   * @returns {Object} - User financial data
   */
  async getUserFinancialData(userId) {
    logger.info(`Getting financial data for user: ${userId}`);
    
    try {
      // Check if we have Plaid access tokens for this user
      const plaidTokens = await this.getPlaidTokens(userId);
      
      if (plaidTokens && plaidTokens.length > 0) {
        logger.info(`Using Plaid data for user ${userId}`);
        return this.getPlaidData(userId, plaidTokens);
      } else {
        logger.info(`Using mock data for user ${userId} (no Plaid tokens)`);
        return this.getMockUserData(userId);
      }
    } catch (error) {
      logger.error(`Error getting user financial data: ${error.message}`, { userId });
      return this.getMockUserData(userId);
    }
  }
  
  /**
   * Get or store Plaid tokens for a user
   * In production, this would use a secure database
   * @param {string} userId - User ID
   * @returns {Array} - Array of Plaid tokens
   */
  async getPlaidTokens(userId) {
    return this.plaidTokensCache.get(userId) || [];
  }
  
  /**
   * Store a Plaid token for a user
   * @param {string} userId - User ID
   * @param {Object} tokenData - Token data with accessToken and itemId
   */
  async storeToken(userId, tokenData) {
    const currentTokens = this.plaidTokensCache.get(userId) || [];
    currentTokens.push(tokenData);
    this.plaidTokensCache.set(userId, currentTokens);
    
    logger.info(`Stored Plaid token for user ${userId}`);
    return true;
  }
  
  /**
   * Get financial data from Plaid APIs
   * @param {string} userId - User ID
   * @param {Array} plaidTokens - Plaid access tokens
   * @returns {Object} - User financial data from Plaid
   */
  async getPlaidData(userId, plaidTokens) {
    try {
      const accounts = [];
      const transactions = [];
      
      // Get data from each Plaid connection
      for (const tokenInfo of plaidTokens) {
        const { accessToken } = tokenInfo;
        
        // Get accounts
        const plaidAccounts = await plaidService.getAccounts(accessToken);
        accounts.push(...plaidAccounts);
        
        // Get transactions (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        
        const plaidTransactions = await plaidService.getTransactions(
          accessToken, 
          startDate, 
          endDate
        );
        transactions.push(...plaidTransactions);
      }
      
      // Get profile info
      const userProfile = await this.getUserProfile(userId);
      
      // Create combined dataset
      return {
        userId,
        userProfile,
        accounts,
        transactions,
        spendingPatterns: this.generateSpendingPatterns(transactions)
      };
    } catch (error) {
      logger.error(`Error getting Plaid data: ${error.message}`, { userId });
      // Fall back to mock data
      return this.getMockUserData(userId);
    }
  }
  
  /**
   * Get user profile information
   * @param {string} userId - User ID
   * @returns {Object} - User profile data
   */
  async getUserProfile(userId) {
    // Check if we have a stored profile
    const storedProfile = this.mockDataStore.get(`profile-${userId}`);
    if (storedProfile) {
      return storedProfile;
    }
    
    // Generate a default profile
    const defaultProfile = {
      userId,
      name: "Default User",
      email: `${userId}@example.com`,
      age: 35,
      riskTolerance: "medium"
    };
    
    // Store it for future use
    this.mockDataStore.set(`profile-${userId}`, defaultProfile);
    
    return defaultProfile;
  }
  
  /**
   * Generate spending patterns analysis based on transactions
   * @param {Array} transactions - Transaction data
   * @returns {Array} - Spending patterns
   */
  generateSpendingPatterns(transactions) {
    // Group transactions by category
    const categories = {};
    
    for (const transaction of transactions) {
      if (transaction.amount < 0) { // Only consider expenses
        const category = transaction.category || 'Uncategorized';
        
        if (!categories[category]) {
          categories[category] = {
            transactions: [],
            total: 0
          };
        }
        
        categories[category].transactions.push(transaction);
        categories[category].total += Math.abs(transaction.amount);
      }
    }
    
    // Generate patterns
    const patterns = [];
    
    for (const [category, data] of Object.entries(categories)) {
      if (data.transactions.length >= 2) { // Need at least 2 transactions to detect a pattern
        patterns.push({
          patternId: `pattern-${category}`,
          patternName: `${category} Spending`,
          category,
          transactions: data.transactions.map(t => t.transactionId),
          averageAmount: data.total / data.transactions.length,
          frequency: this.detectFrequency(data.transactions),
          lastOccurrence: new Date(Math.max(...data.transactions.map(t => new Date(t.date)))),
          confidence: data.transactions.length > 5 ? 0.9 : 0.7,
          patternType: 'variable_expense'
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Detect frequency pattern in transactions
   * @param {Array} transactions - Transactions to analyze
   * @returns {string} - Detected frequency
   */
  detectFrequency(transactions) {
    // Simple implementation - could be enhanced with more sophisticated analysis
    if (transactions.length < 2) return 'unknown';
    
    // Sort by date
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // Calculate average days between transactions
    let totalDays = 0;
    for (let i = 1; i < sortedTransactions.length; i++) {
      const daysDiff = (new Date(sortedTransactions[i].date) - new Date(sortedTransactions[i-1].date)) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
    }
    
    const avgDays = totalDays / (sortedTransactions.length - 1);
    
    // Determine frequency
    if (avgDays <= 3) return 'daily';
    if (avgDays <= 10) return 'weekly';
    if (avgDays <= 20) return 'biweekly';
    if (avgDays <= 35) return 'monthly';
    if (avgDays <= 100) return 'quarterly';
    return 'irregular';
  }
  
  /**
   * Generate mock user data for development purposes
   * @param {string} userId - User's ID
   * @returns {Object} - Mock user financial data
   */
  getMockUserData(userId) {
    // Check if we already have mock data for this user
    const cachedData = this.mockDataStore.get(`mockData-${userId}`);
    if (cachedData) {
      return cachedData;
    }
    
    // Generate current date and some past dates for transactions
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    
    // Get or create a user profile
    const userProfile = this.getUserProfile(userId);
    
    const mockData = {
      userId,
      userProfile,
      accounts: [
        {
          accountId: "acc-1234",
          name: "Primary Checking",
          type: "Checking",
          balance: 5000.75,
          currency: "USD"
        },
        {
          accountId: "acc-5678",
          name: "Savings Account",
          type: "Savings",
          balance: 15000.50,
          currency: "USD"
        },
        {
          accountId: "acc-9012",
          name: "Credit Card",
          type: "Credit Card",
          balance: -1200.25,
          currency: "USD",
          creditLimit: 5000,
          dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15),
          minimumPayment: 35
        }
      ],
      transactions: [
        {
          transactionId: "txn-001",
          accountId: "acc-1234",
          date: today.toISOString(),
          description: "Coffee Shop",
          category: "Food",
          amount: -4.50
        },
        {
          transactionId: "txn-002",
          accountId: "acc-1234",
          date: yesterday.toISOString(),
          description: "Grocery Store",
          category: "Food",
          amount: -65.30
        },
        {
          transactionId: "txn-003",
          accountId: "acc-9012",
          date: twoDaysAgo.toISOString(),
          description: "Amazon Subscription",
          category: "Entertainment",
          amount: -15.99
        },
        {
          transactionId: "txn-004",
          accountId: "acc-1234",
          date: threeDaysAgo.toISOString(),
          description: "Gas Station",
          category: "Transportation",
          amount: -45.50
        },
        {
          transactionId: "txn-005",
          accountId: "acc-1234",
          date: lastWeek.toISOString(),
          description: "Salary Deposit",
          category: "Income",
          amount: 3000.00
        },
        {
          transactionId: "txn-006",
          accountId: "acc-5678",
          date: lastWeek.toISOString(),
          description: "Transfer to Savings",
          category: "Transfer",
          amount: 500.00
        },
        {
          transactionId: "txn-007",
          accountId: "acc-1234",
          date: twoWeeksAgo.toISOString(),
          description: "Restaurant",
          category: "Dining",
          amount: -85.20
        },
        {
          transactionId: "txn-008",
          accountId: "acc-9012",
          date: twoWeeksAgo.toISOString(),
          description: "Amazon Purchase",
          category: "Shopping",
          amount: -65.99
        }
      ],
      spendingPatterns: [
        {
          patternId: "pattern-001",
          patternName: "Monthly Netflix",
          category: "Entertainment",
          frequency: "monthly",
          averageAmount: 15.99,
          lastOccurrence: twoDaysAgo.toISOString(),
          confidence: 0.95,
          patternType: "fixed_expense"
        },
        {
          patternId: "pattern-002",
          patternName: "Bi-weekly Grocery Shopping",
          category: "Food",
          frequency: "biweekly",
          averageAmount: 75.50,
          lastOccurrence: yesterday.toISOString(),
          confidence: 0.85,
          patternType: "variable_expense"
        }
      ]
    };
    
    // Store the mock data for future use
    this.mockDataStore.set(`mockData-${userId}`, mockData);
    
    return mockData;
  }
}

module.exports = new DataService();