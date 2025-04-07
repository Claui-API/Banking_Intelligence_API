// Updated database.service.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dbConnection = require('../utils/db-connection');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const UserProfile = require('../models/UserProfile');
const SpendingPattern = require('../models/SpendingPattern');
const logger = require('../utils/logger');

dotenv.config();

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }
  
  async initialize() {
    try {
      if (this.isConnected) {
        return;
      }
      
      // Use the db-connection utility you already have
      await dbConnection.connect();
      this.isConnected = true;
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }
  
  async getMeasuredQuery(description, queryFn) {
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      if (duration > 500) { // Log slow queries (over 500ms)
        logger.warn(`Slow query: ${description} took ${duration}ms`);
      } else {
        logger.debug(`Query: ${description} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Query failed: ${description} after ${duration}ms`, error);
      throw error;
    }
  }

  async getUserFinancialData(userId) {
    const startTime = Date.now();
    try {
      // Ensure connection is established
      if (!this.isConnected) {
        await this.initialize();
      }

      logger.info(`Fetching financial data for user: ${userId}`);
      
      // Get user profile
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) {
        throw new Error(`User profile not found for userId: ${userId}`);
      }
      
      // Get accounts
      const accounts = await this.getMeasuredQuery(
        `Get accounts for user ${userId}`,
        () => Account.find({ userId })
      );
      
      // Get recent transactions (e.g., last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const transactions = await Transaction.find({
        userId,
        date: { $gte: threeMonthsAgo }
      }).sort({ date: -1 });
      
      // Get spending patterns
      const spendingPatterns = await SpendingPattern.find({ userId });
      
      const userData = {
        userId,
        userProfile: userProfile.toObject(),
        accounts: accounts.map(acc => acc.toObject()),
        transactions: transactions.map(txn => txn.toObject()),
        spendingPatterns: spendingPatterns.map(pattern => pattern.toObject())
      };
      
      const duration = Date.now() - startTime;
      logger.info(`Retrieved user data for ${userId} (${duration}ms)`);
      return userData;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error fetching data for user ${userId} (${duration}ms):`, error);
      throw error;
    }
  }
  
  async getUserProfile(userId) {
    try {
      // Ensure connection is established
      if (!this.isConnected) {
        await this.initialize();
      }
      
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) {
        throw new Error(`User profile not found for userId: ${userId}`);
      }
      
      return userProfile.toObject();
    } catch (error) {
      logger.error(`Error fetching profile for user ${userId}:`, error);
      throw new Error('Failed to retrieve user profile');
    }
  }
  
  /**
   * Generate mock user data for development purposes
   * @param {string} userId - User's ID
   * @returns {Object} - Mock user financial data
   */
  _getMockUserData(userId) {
    logger.info(`Generating mock data for user: ${userId}`);
    
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
    
    return {
      userId,
      userProfile: {
        name: "Shreyas Sreenivas",
        age: 35,
        email: "test@example.com",
        riskTolerance: "medium"
      },
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
          description: "Netflix Subscription",
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
  }
}

module.exports = new DatabaseService();