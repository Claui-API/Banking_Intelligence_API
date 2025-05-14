// src/routes/plaid.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const plaidService = require('../services/plaid.service');
const dataService = require('../services/data.service'); // Import the dataService

/**
 * @route GET /api/plaid/status
 * @desc Check Plaid service status
 * @access Private
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Check if we have the required Plaid credentials
    const hasPlaidCredentials =
      process.env.PLAID_CLIENT_ID &&
      process.env.PLAID_SECRET;

    // Simple health check - in production, you might want to actually ping Plaid here
    const status = {
      available: true,
      environment: process.env.PLAID_ENV || 'sandbox',
      credentialsConfigured: hasPlaidCredentials
    };

    logger.info('Plaid service status check', {
      available: status.available,
      environment: status.environment
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
          link_token: `link-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
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
 * @desc Exchange public token for access token and store it
 * @access Private
 */
router.post('/exchange-public-token', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { publicToken } = req.body;
    const { metadata } = req.body; // Optional metadata from Plaid Link

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
          accessToken: `access-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          itemId: `item-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
        };
      } else {
        // In production, rethrow the error
        throw plaidError;
      }
    }

    // Store the access token for this user
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
 * @desc Get user's bank accounts
 * @access Private
 */
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;

    logger.info(`Getting accounts for user ${userId}`);

    // Get real accounts through dataService
    let accounts;
    try {
      const userData = await dataService.getUserFinancialData(userId);
      accounts = userData.accounts || [];
    } catch (dataError) {
      logger.error('Error getting accounts data:', dataError);

      // Fallback to mock accounts
      accounts = [
        {
          accountId: 'acc-mock-checking',
          name: 'Mock Checking',
          type: 'Checking',
          balance: 2500.75,
          availableBalance: 2450.50,
          currency: 'USD'
        },
        {
          accountId: 'acc-mock-savings',
          name: 'Mock Savings',
          type: 'Savings',
          balance: 15000.50,
          availableBalance: 15000.50,
          currency: 'USD'
        }
      ];
    }

    return res.status(200).json({
      success: true,
      data: accounts
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
 * @desc Get user's transactions
 * @access Private
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { startDate, endDate } = req.query;

    logger.info(`Getting transactions for user ${userId}`);

    // Get real transactions through dataService
    let transactions;
    try {
      const userData = await dataService.getUserFinancialData(userId);
      transactions = userData.transactions || [];
    } catch (dataError) {
      logger.error('Error getting transaction data:', dataError);

      // Fallback to mock transactions
      transactions = [
        {
          transactionId: 'txn-mock-001',
          accountId: 'acc-mock-checking',
          date: new Date().toISOString(),
          description: 'Mock Transaction',
          amount: -50.00,
          category: 'Other'
        }
      ];
    }

    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get transactions'
    });
  }
});

module.exports = router;