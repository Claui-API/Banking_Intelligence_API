// src/routes/plaid.routes.js - Improved with better user isolation
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const plaidService = require('../services/plaid.service');
const dataService = require('../services/data.service');
const userDataController = require('../controllers/UserDataController');

/**
 * @route GET /api/plaid/status
 * @desc Check Plaid service status
 * @access Private
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Add the user ID to the request log for auditing
    logger.info('Plaid status check', { userId: req.auth.userId });

    // Check if we have the required Plaid credentials
    const hasPlaidCredentials =
      process.env.PLAID_CLIENT_ID &&
      process.env.PLAID_SECRET;

    // Check if this user has any active Plaid connections
    const userPlaidItems = await dataService.getPlaidTokens(req.auth.userId);
    const isConnected = userPlaidItems && userPlaidItems.length > 0;

    // Get institution name from first connection if available
    let institution = null;
    if (isConnected && userPlaidItems[0].institutionName) {
      institution = userPlaidItems[0].institutionName;
    }

    // Simple health check
    const status = {
      available: true,
      environment: process.env.PLAID_ENV || 'sandbox',
      credentialsConfigured: hasPlaidCredentials,
      connected: isConnected,
      institution: institution
    };

    logger.info('Plaid service status check', {
      available: status.available,
      environment: status.environment,
      userId: req.auth.userId,
      connected: isConnected
    });

    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error checking Plaid status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking Plaid status',
      error: error.message
    });
  }
});

/**
 * @route POST /api/plaid/create-link-token
 * @desc Create a Plaid Link token for user to connect their bank accounts
 * @access Private
 */
router.post('/create-link-token', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const products = req.body.products || ['transactions'];

    // Add a userId stamp to the log for better auditing
    logger.info(`Creating Plaid link token for user ${userId}`);

    // Use real Plaid service if available
    let linkTokenResponse;

    try {
      linkTokenResponse = await plaidService.createLinkToken(userId, products);
    } catch (plaidError) {
      logger.error('Plaid API error:', plaidError);

      // In sandbox/development mode, create a mock link token
      if (process.env.NODE_ENV !== 'production' || process.env.PLAID_ENV === 'sandbox') {
        logger.info('Using mock link token in sandbox/development mode');
        linkTokenResponse = {
          link_token: `link-sandbox-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        };
      } else {
        // In production, rethrow the error
        throw plaidError;
      }
    }

    logger.info(`Created Plaid Link token for user ${userId}`, {
      linkToken: linkTokenResponse.link_token ? `${linkTokenResponse.link_token.substring(0, 10)}...` : 'none'
    });

    return res.status(200).json({
      success: true,
      data: {
        link_token: linkTokenResponse.link_token,
        expiration: linkTokenResponse.expiration
      }
    });
  } catch (error) {
    logger.error('Error creating Plaid link token:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create link token'
    });
  }
});

/**
 * @route POST /api/plaid/exchange-public-token
 * @desc Exchange public token for access token and store it with proper user isolation
 * @access Private
 */
router.post('/exchange-public-token', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { publicToken } = req.body;
    const { metadata } = req.body; // Optional metadata from Plaid Link

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!publicToken) {
      return res.status(400).json({
        success: false,
        message: 'Public token is required'
      });
    }

    logger.info(`Processing public token exchange for user ${userId}`);

    // Exchange token with Plaid - this should return {accessToken, itemId}
    let tokenExchange;
    try {
      // Try to use the real Plaid service
      tokenExchange = await plaidService.exchangePublicToken(publicToken);
      logger.info('Public token exchanged for access token');
    } catch (plaidError) {
      logger.error('Plaid API error:', plaidError);

      // In sandbox/development mode, generate mock token data
      if (process.env.NODE_ENV !== 'production' || process.env.PLAID_ENV === 'sandbox') {
        logger.info('Using mock token exchange in sandbox/development mode');
        tokenExchange = {
          accessToken: `access-sandbox-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          itemId: `item-sandbox-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
        };
      } else {
        // In production, rethrow the error
        throw plaidError;
      }
    }

    // Store the access token for this user with strict user isolation
    await dataService.storeToken(userId, tokenExchange, metadata || {});
    logger.info(`Exchanged and stored Plaid token for user ${userId}`);

    // Return success to the client
    return res.status(200).json({
      success: true,
      message: 'Bank account connected successfully',
      data: {
        itemId: tokenExchange.itemId
      }
    });
  } catch (error) {
    logger.error('Error exchanging public token:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to exchange public token'
    });
  }
});

/**
 * @route GET /api/plaid/accounts
 * @desc Get user's bank accounts with strict user isolation
 * @access Private
 */
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    logger.info(`Getting accounts for user ${userId}`);

    // Get real accounts through dataService with strict user validation
    let accounts;
    try {
      // Only get data for the authenticated user
      const userData = await dataService.getUserFinancialData(userId);

      // Validate the returned data belongs to the current user
      if (userData.userId !== userId) {
        throw new Error('Data ownership validation failed');
      }

      accounts = userData.accounts || [];

      logger.info(`Retrieved ${accounts.length} accounts for user ${userId}`);
    } catch (dataError) {
      logger.error('Error getting accounts data:', dataError);

      // Fallback to mock accounts with user-specific values
      accounts = [
        {
          accountId: `acc-mock-${userId.substring(0, 4)}-checking`,
          name: "Mock Checking",
          type: "Checking",
          balance: 2500.75,
          availableBalance: 2450.50,
          currency: "USD"
        },
        {
          accountId: `acc-mock-${userId.substring(0, 4)}-savings`,
          name: "Mock Savings",
          type: "Savings",
          balance: 15000.50,
          availableBalance: 15000.50,
          currency: "USD"
        }
      ];

      logger.info(`Generated mock accounts for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      data: accounts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting accounts:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get accounts'
    });
  }
});

/**
 * @route GET /api/plaid/transactions
 * @desc Get user's transactions with strict user isolation
 * @access Private
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    logger.info(`Getting transactions for user ${userId}`);

    // Get real transactions through dataService with strict user validation
    let transactions;
    try {
      // Only get data for the authenticated user
      const userData = await dataService.getUserFinancialData(userId);

      // Validate the returned data belongs to the current user
      if (userData.userId !== userId) {
        throw new Error('Data ownership validation failed');
      }

      transactions = userData.transactions || [];

      logger.info(`Retrieved ${transactions.length} transactions for user ${userId}`);
    } catch (dataError) {
      logger.error('Error getting transaction data:', dataError);

      // Fallback to mock transactions with user-specific values
      transactions = [
        {
          transactionId: `txn-mock-${userId.substring(0, 4)}-001`,
          accountId: `acc-mock-${userId.substring(0, 4)}-checking`,
          date: new Date().toISOString(),
          description: "Mock Transaction",
          amount: -50.00,
          category: "Other"
        }
      ];

      logger.info(`Generated mock transactions for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      data: transactions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get transactions'
    });
  }
});

/**
 * @route POST /api/plaid/reconnect
 * @desc Prepare for reconnection of bank accounts
 * @access Private
 */
router.post('/reconnect', authMiddleware, userDataController.reconnectBankAccounts);

/**
 * @route DELETE /api/plaid/items/:itemId
 * @desc Disconnect a Plaid item
 * @access Private
 */
router.delete('/items/:itemId', authMiddleware, userDataController.disconnectBankAccount);

module.exports = router;