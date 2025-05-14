// src/services/data.service.js
const logger = require('../utils/logger');
const PlaidItem = require('../models/PlaidItem');
const plaidService = require('./plaid.service');
const { sequelize } = require('../config/database');

class DataService {
  /**
   * Store a Plaid item for a user
   * @param {string} userId - User ID
   * @param {Object} tokenData - Token data (accessToken, itemId)
   * @param {Object} metadata - Additional metadata (institution, etc.)
   */
  async storeToken(userId, tokenData, metadata = {}) {
    const transaction = await sequelize.transaction();

    try {
      if (!userId || !tokenData || !tokenData.accessToken || !tokenData.itemId) {
        throw new Error('User ID, access token, and item ID are required');
      }

      logger.info(`Storing Plaid token for user ${userId}`);

      // Check if this item already exists
      let plaidItem = await PlaidItem.findOne({
        where: { itemId: tokenData.itemId },
        transaction
      });

      if (plaidItem) {
        // Update existing item
        plaidItem.accessToken = tokenData.accessToken;
        plaidItem.status = 'active';

        if (metadata.institution) {
          plaidItem.institutionId = metadata.institution.institution_id;
          plaidItem.institutionName = metadata.institution.name;
        }

        plaidItem.lastSyncedAt = new Date();
        plaidItem.error = null; // Clear any previous errors

        await plaidItem.save({ transaction });
        logger.info(`Updated existing Plaid item for user ${userId}`);
      } else {
        // Create new item
        plaidItem = await PlaidItem.create({
          userId,
          itemId: tokenData.itemId,
          accessToken: tokenData.accessToken,
          institutionId: metadata.institution?.institution_id,
          institutionName: metadata.institution?.name,
          status: 'active',
          lastSyncedAt: new Date()
        }, { transaction });

        logger.info(`Created new Plaid item for user ${userId}`);
      }

      await transaction.commit();
      return plaidItem;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error storing Plaid token:', error);
      throw error;
    }
  }

  /**
   * Get Plaid tokens for a user
   * @param {string} userId - User ID
   * @returns {Array} - Array of Plaid items
   */
  async getPlaidTokens(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const plaidItems = await PlaidItem.findAll({
        where: {
          userId,
          status: 'active'
        }
      });

      return plaidItems.map(item => ({
        accessToken: item.accessToken,
        itemId: item.itemId,
        institutionName: item.institutionName
      }));
    } catch (error) {
      logger.error('Error getting Plaid tokens:', error);
      return [];
    }
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
        try {
          const plaidAccounts = await plaidService.getAccounts(accessToken);
          accounts.push(...plaidAccounts);
          logger.info(`Retrieved ${plaidAccounts.length} accounts from Plaid`);
        } catch (accountError) {
          logger.error(`Error getting accounts for token: ${accessToken.substring(0, 10)}...`, accountError);
        }

        // Get transactions (last 30 days)
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - 30);

          const plaidTransactions = await plaidService.getTransactions(
            accessToken,
            startDate,
            endDate
          );
          transactions.push(...plaidTransactions);
          logger.info(`Retrieved ${plaidTransactions.length} transactions from Plaid`);
        } catch (transactionError) {
          logger.error(`Error getting transactions for token: ${accessToken.substring(0, 10)}...`, transactionError);
        }
      }

      // Generate some summary data
      const userProfile = {
        userId,
        name: "Plaid User",
        email: `${userId.substring(0, 8)}@example.com`,
        hasPlaidConnections: true
      };

      // Create combined dataset
      return {
        userId,
        userProfile,
        accounts,
        transactions
      };
    } catch (error) {
      logger.error(`Error getting Plaid data: ${error.message}`, { userId });
      // Fall back to mock data
      return this.getMockUserData(userId);
    }
  }

  /**
   * Generate mock user data for development purposes
   * @param {string} userId - User's ID
   * @returns {Object} - Mock user financial data
   */
  getMockUserData(userId) {
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

    const userProfile = {
      userId,
      name: "Mock User",
      email: `${userId.substring(0, 8)}@example.com`,
    };

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
      ]
    };

    return mockData;
  }
}

module.exports = new DataService();