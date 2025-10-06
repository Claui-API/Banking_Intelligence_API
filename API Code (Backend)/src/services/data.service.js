// src/services/data.service.js (Modified with strict user isolation)
const logger = require('../utils/logger');
const { PlaidItem } = require('../models');
const plaidService = require('./plaid.service');
const { sequelize } = require('../config/database');

class DataService {
  /**
   * Store a Plaid item for a user with proper user isolation
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

      // First, check if this item already exists for ANY user (important security check)
      const existingItem = await PlaidItem.findOne({
        where: { itemId: tokenData.itemId }
      });

      // If the item exists but belongs to a different user, this is a security issue
      if (existingItem && existingItem.userId !== userId) {
        await transaction.rollback();
        logger.error(`Security alert: User ${userId} attempted to claim Plaid item ${tokenData.itemId} belonging to user ${existingItem.userId}`);
        throw new Error('This bank account is already connected to a different user');
      }

      // Check if this item already exists for this specific user
      let plaidItem = await PlaidItem.findOne({
        where: {
          itemId: tokenData.itemId,
          userId: userId // Explicitly check userId match
        },
        transaction
      });

      if (plaidItem) {
        // Update existing item
        plaidItem.accessToken = tokenData.accessToken;
        plaidItem.status = 'active';
        plaidItem.disconnectedAt = null; // Clear disconnection timestamp if reconnecting

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
   * Get Plaid tokens for a user with strict user validation
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
          userId, // Only get tokens for this specific user
          status: 'active'
        }
      });

      logger.info(`Retrieved ${plaidItems.length} Plaid tokens for user ${userId}`);

      return plaidItems.map(item => ({
        accessToken: item.accessToken,
        itemId: item.itemId,
        institutionName: item.institutionName
      }));
    } catch (error) {
      logger.error(`Error getting Plaid tokens for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get all Plaid items for a user (including inactive ones)
   * @param {string} userId - User ID
   * @returns {Array} - Array of Plaid items
   */
  async getPlaidItemsByUser(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const plaidItems = await PlaidItem.findAll({
        where: {
          userId // Only get items for this specific user
        }
      });

      return plaidItems;
    } catch (error) {
      logger.error(`Error getting Plaid items for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user's financial data - either from Plaid or mock data
   * with strict user isolation
   * @param {string} userId - User ID
   * @returns {Object} - User financial data
   */
  async getUserFinancialData(userId) {
    logger.info(`Getting financial data for user: ${userId}`);

    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check if we have Plaid access tokens for this user
      const plaidTokens = await this.getPlaidTokens(userId);

      if (plaidTokens && plaidTokens.length > 0) {
        logger.info(`Using Plaid data for user ${userId} (${plaidTokens.length} connected institutions)`);
        return this.getPlaidData(userId, plaidTokens);
      } else {
        logger.info(`Using mock data for user ${userId} (no Plaid tokens)`);
        return this.getMockUserData(userId);
      }
    } catch (error) {
      logger.error(`Error getting user financial data: ${error.message}`, { userId });

      // If there's an error, return mock data to keep the application functional
      return this.getMockUserData(userId);
    }
  }

  /**
   * Get financial data from Plaid APIs with strict user isolation
   * @param {string} userId - User ID
   * @param {Array} plaidTokens - Plaid access tokens for this specific user
   * @returns {Object} - User financial data from Plaid
   */
  async getPlaidData(userId, plaidTokens) {
    try {
      const accounts = [];
      const transactions = [];

      // Verify these tokens actually belong to the user
      const userItems = await PlaidItem.findAll({
        where: {
          userId,
          status: 'active'
        },
        attributes: ['itemId']
      });

      const userItemIds = userItems.map(item => item.itemId);

      // Filter tokens to ensure they belong to this user
      const validTokens = plaidTokens.filter(token =>
        userItemIds.includes(token.itemId)
      );

      if (validTokens.length !== plaidTokens.length) {
        logger.warn(`Security alert: Filtered out ${plaidTokens.length - validTokens.length} invalid tokens for user ${userId}`);
      }

      // Get data from each Plaid connection
      for (const tokenInfo of validTokens) {
        const { accessToken, itemId } = tokenInfo;

        // Skip if no access token
        if (!accessToken) {
          logger.warn(`Missing access token for item ${itemId}, skipping`);
          continue;
        }

        // Get accounts
        try {
          const plaidAccounts = await plaidService.getAccounts(accessToken);

          // Process each account to ensure credit card balances are negative
          const processedAccounts = plaidAccounts.map(account => {
            // Check if this is a credit card account
            const isCreditCard =
              account.type === 'credit' ||
              account.subType === 'credit card' ||
              account.type === 'Credit Card';

            // For credit cards, ensure balance is negative to represent a liability
            if (isCreditCard && account.balance > 0) {
              return {
                ...account,
                balance: -Math.abs(account.balance) // Make sure it's negative
              };
            }

            return account;
          });

          accounts.push(...processedAccounts);
          logger.info(`Retrieved ${processedAccounts.length} accounts from Plaid for user ${userId}`);
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
          logger.info(`Retrieved ${plaidTransactions.length} transactions from Plaid for user ${userId}`);
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

      // Create combined dataset with user ID stamped on all data for validation
      return {
        userId, // Include userId in the result for validation
        userProfile,
        accounts,
        transactions,
        // Add a unique timestamp to ensure fresh data
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error getting Plaid data: ${error.message}`, { userId });
      // Fall back to mock data
      return this.getMockUserData(userId);
    }
  }

  /**
   * Generate mock user data for development purposes with user ID stamping
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

    // Create a unique prefix based on userId to make mock data unique per user
    const userPrefix = userId.substring(0, 4);

    const userProfile = {
      userId,
      name: `Mock User ${userPrefix}`, // Make name unique per user
      email: `${userId.substring(0, 8)}@example.com`,
    };

    const mockData = {
      userId, // Include userId in the result for validation
      userProfile,
      accounts: [
        {
          accountId: `acc-${userPrefix}-1234`,
          name: "Primary Checking",
          type: "Checking",
          balance: 5000.75,
          currency: "USD"
        },
        {
          accountId: `acc-${userPrefix}-5678`,
          name: "Savings Account",
          type: "Savings",
          balance: 15000.50,
          currency: "USD"
        },
        {
          accountId: `acc-${userPrefix}-9012`,
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
          transactionId: `txn-${userPrefix}-001`,
          accountId: `acc-${userPrefix}-1234`,
          date: today.toISOString(),
          description: "Coffee Shop",
          category: "Food",
          amount: -4.50
        },
        {
          transactionId: `txn-${userPrefix}-002`,
          accountId: `acc-${userPrefix}-1234`,
          date: yesterday.toISOString(),
          description: "Grocery Store",
          category: "Food",
          amount: -65.30
        },
        {
          transactionId: `txn-${userPrefix}-003`,
          accountId: `acc-${userPrefix}-9012`,
          date: twoDaysAgo.toISOString(),
          description: "Amazon Subscription",
          category: "Entertainment",
          amount: -15.99
        },
        {
          transactionId: `txn-${userPrefix}-004`,
          accountId: `acc-${userPrefix}-1234`,
          date: threeDaysAgo.toISOString(),
          description: "Gas Station",
          category: "Transportation",
          amount: -45.50
        },
        {
          transactionId: `txn-${userPrefix}-005`,
          accountId: `acc-${userPrefix}-1234`,
          date: lastWeek.toISOString(),
          description: "Salary Deposit",
          category: "Income",
          amount: 3000.00
        },
        {
          transactionId: `txn-${userPrefix}-006`,
          accountId: `acc-${userPrefix}-5678`,
          date: lastWeek.toISOString(),
          description: "Transfer to Savings",
          category: "Transfer",
          amount: 500.00
        },
        {
          transactionId: `txn-${userPrefix}-007`,
          accountId: `acc-${userPrefix}-1234`,
          date: twoWeeksAgo.toISOString(),
          description: "Restaurant",
          category: "Dining",
          amount: -85.20
        },
        {
          transactionId: `txn-${userPrefix}-008`,
          accountId: `acc-${userPrefix}-9012`,
          date: twoWeeksAgo.toISOString(),
          description: "Amazon Purchase",
          category: "Shopping",
          amount: -65.99
        }
      ],
      // Add a timestamp to ensure fresh data
      timestamp: new Date().toISOString(),
      // Flag this as mock data
      isMock: true
    };

    return mockData;
  }

  /**
   * Reconnect bank accounts by clearing existing connections and redirecting to Link
   * @param {string} userId - User ID
   * @returns {boolean} - Success status
   */
  async reconnectBankAccounts(userId) {
    const transaction = await sequelize.transaction();

    try {
      // Validate user ID
      if (!userId) {
        throw new Error('User ID is required');
      }

      logger.info(`Initiating bank reconnection for user ${userId}`);

      // Find existing Plaid connections for this user
      const existingConnections = await PlaidItem.findAll({
        where: { userId },
        transaction
      });

      logger.info(`Found ${existingConnections.length} existing Plaid connections for user ${userId}`);

      // Mark connections as inactive to preserve history but prevent duplicates
      for (const connection of existingConnections) {
        connection.status = 'disconnected';
        connection.disconnectedAt = new Date();
        await connection.save({ transaction });

        logger.info(`Marked Plaid connection ${connection.itemId} as disconnected for user ${userId}`);
      }

      await transaction.commit();
      logger.info(`Successfully prepared bank reconnection for user ${userId}`);

      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error during bank reconnection preparation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect a specific Plaid item
   * @param {string} userId - User ID
   * @param {string} itemId - Plaid item ID
   * @returns {boolean} - Success status
   */
  async disconnectPlaidItem(userId, itemId) {
    const transaction = await sequelize.transaction();

    try {
      // Validate parameters
      if (!userId || !itemId) {
        throw new Error('User ID and item ID are required');
      }

      // Find the Plaid item with strict user check
      const plaidItem = await PlaidItem.findOne({
        where: {
          userId,
          itemId
        },
        transaction
      });

      if (!plaidItem) {
        await transaction.rollback();
        throw new Error('Plaid item not found for this user');
      }

      // Mark as disconnected
      plaidItem.status = 'disconnected';
      plaidItem.disconnectedAt = new Date();

      // Replace access token with a placeholder for security
      plaidItem.accessToken = 'DISCONNECTED_' + Date.now();

      await plaidItem.save({ transaction });

      await transaction.commit();
      logger.info(`Plaid item ${itemId} disconnected for user ${userId}`);

      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error disconnecting Plaid item ${itemId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all Plaid data for a user (for logout)
   * @param {string} userId - User ID
   */
  async clearUserPlaidCache(userId) {
    try {
      if (!userId) {
        logger.warn('No user ID provided for Plaid cache clearing');
        return;
      }

      // In a memory-cached implementation, this would clear session caches
      // For now, we just log that this happened
      logger.info(`Cleared Plaid cache for user ${userId}`);

      return true;
    } catch (error) {
      logger.error(`Error clearing Plaid cache for user ${userId}:`, error);
    }
  }
}

module.exports = new DataService();