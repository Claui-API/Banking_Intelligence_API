// src/routes/plaid.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

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

    // Here you would implement your Plaid Link token creation logic
    // For now, just return a mock response
    const mockLinkToken = `link-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    logger.info(`Created Plaid Link token for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        link_token: mockLinkToken,
        expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    logger.error('Error creating Plaid link token:', error);
    return res.status(500).json({
      success: false,
      message: error.message
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

    if (!publicToken) {
      return res.status(400).json({
        success: false,
        message: 'Public token is required'
      });
    }

    // Here you would implement your public token exchange logic
    // For now, just return a mock response
    const mockAccessToken = `access-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const mockItemId = `item-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    logger.info(`Exchanged public token for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Bank account connected successfully',
      data: {
        itemId: mockItemId
      }
    });
  } catch (error) {
    logger.error('Error exchanging public token:', error);
    return res.status(500).json({
      success: false,
      message: error.message
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

    // Here you would implement your get accounts logic
    // For now, just return mock accounts
    const mockAccounts = [
      {
        accountId: 'acc-checking-001',
        name: 'Primary Checking',
        type: 'Checking',
        subtype: 'Checking',
        balance: 2500.75,
        availableBalance: 2450.50,
        currency: 'USD'
      },
      {
        accountId: 'acc-savings-001',
        name: 'Savings Account',
        type: 'Savings',
        subtype: 'Savings',
        balance: 15000.50,
        availableBalance: 15000.50,
        currency: 'USD'
      },
      {
        accountId: 'acc-credit-001',
        name: 'Credit Card',
        type: 'Credit Card',
        subtype: 'Credit Card',
        balance: -1250.65,
        availableBalance: 3750.35,
        currency: 'USD'
      }
    ];

    return res.status(200).json({
      success: true,
      data: mockAccounts,
      isMock: true
    });
  } catch (error) {
    logger.error('Error getting accounts:', error);

    // Return mock accounts on error for development
    return res.status(200).json({
      success: true,
      data: [
        {
          accountId: 'acc-mock-001',
          name: 'Mock Checking',
          type: 'Checking',
          balance: 1000.00,
          currency: 'USD'
        }
      ],
      isMock: true,
      error: error.message
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

    // Here you would implement your get transactions logic
    // For now, just return mock transactions
    const mockTransactions = [
      {
        transactionId: 'txn-001',
        accountId: 'acc-checking-001',
        date: new Date().toISOString(),
        description: 'Grocery Store',
        amount: -120.35,
        category: 'Food',
        merchantName: 'Whole Foods'
      },
      {
        transactionId: 'txn-002',
        accountId: 'acc-checking-001',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Monthly Salary',
        amount: 4000.00,
        category: 'Income',
        merchantName: 'COMPANY INC'
      },
      {
        transactionId: 'txn-003',
        accountId: 'acc-credit-001',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Amazon.com',
        amount: -67.99,
        category: 'Shopping',
        merchantName: 'Amazon'
      }
    ];

    return res.status(200).json({
      success: true,
      data: mockTransactions,
      isMock: true
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);

    // Return mock transactions on error for development
    return res.status(200).json({
      success: true,
      data: [
        {
          transactionId: 'txn-mock-001',
          accountId: 'acc-mock-001',
          date: new Date().toISOString(),
          description: 'Mock Transaction',
          amount: -50.00,
          category: 'Other'
        }
      ],
      isMock: true,
      error: error.message
    });
  }
});

module.exports = router;