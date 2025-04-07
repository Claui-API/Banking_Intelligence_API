// routes/plaid.routes.js
const express = require('express');
const router = express.Router();
const plaidService = require('../services/plaid.service');
const authMiddleware = require('../middleware/auth');
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
    const linkTokenResponse = await plaidService.createLinkToken(userId, products);
    
    return res.status(200).json({
      success: true,
      data: linkTokenResponse
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
 * @desc Exchange public token for access token and save to database
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
    
    // Exchange public token for access token
    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
    
    // Here you would typically save the access token to the user's record in the database
    // For this example, we'll just return it (in a real app, never return this to frontend)
    
    return res.status(200).json({
      success: true,
      message: 'Bank account connected successfully',
      data: {
        itemId
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
    
    // In a real application, you would retrieve the user's Plaid access token from your database
    // For this example, we're getting it from the request
    const { accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    const accounts = await plaidService.getAccounts(accessToken);
    
    return res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (error) {
    logger.error('Error getting accounts:', error);
    return res.status(500).json({
      success: false,
      message: error.message
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
    
    // In a real application, you would retrieve the user's Plaid access token from your database
    // For this example, we're getting it from the request
    const { accessToken, startDate, endDate } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end);
    start.setDate(end.getDate() - 30);
    
    const transactions = await plaidService.getTransactions(accessToken, start, end);
    
    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;