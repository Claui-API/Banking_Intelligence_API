// routes/plaid.routes.js - Updated for no MongoDB
const express = require('express');
const router = express.Router();
const plaidService = require('../services/plaid.service');
const dataService = require('../services/data.service'); // Updated service
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
    
    // Exchange public token for access token
    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
    
    // Store token using data service (no database needed)
    await dataService.storeToken(userId, {
      accessToken,
      itemId,
      createdAt: new Date()
    });
    
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
    
    // Get all of the user's Plaid tokens
    const tokens = await dataService.getPlaidTokens(userId);
    
    if (!tokens || tokens.length === 0) {
      // Return mock accounts if no tokens available
      const mockData = dataService.getMockUserData(userId);
      
      return res.status(200).json({
        success: true,
        data: mockData.accounts,
        isMock: true
      });
    }
    
    // Get accounts from all connections
    const allAccounts = [];
    
    for (const token of tokens) {
      const accounts = await plaidService.getAccounts(token.accessToken);
      allAccounts.push(...accounts);
    }
    
    return res.status(200).json({
      success: true,
      data: allAccounts
    });
  } catch (error) {
    logger.error('Error getting accounts:', error);
    
    // Return mock accounts on error
    const { userId } = req.auth;
    const mockData = dataService.getMockUserData(userId);
    
    return res.status(200).json({
      success: true,
      data: mockData.accounts,
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
    
    // Get all of the user's Plaid tokens
    const tokens = await dataService.getPlaidTokens(userId);
    
    if (!tokens || tokens.length === 0) {
      // Return mock transactions if no tokens available
      const mockData = dataService.getMockUserData(userId);
      
      return res.status(200).json({
        success: true,
        data: mockData.transactions,
        isMock: true
      });
    }
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end);
    start.setDate(end.getDate() - 30);
    
    // Get transactions from all connections
    const allTransactions = [];
    
    for (const token of tokens) {
      const transactions = await plaidService.getTransactions(
        token.accessToken, 
        start, 
        end
      );
      allTransactions.push(...transactions);
    }
    
    return res.status(200).json({
      success: true,
      data: allTransactions
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    
    // Return mock transactions on error
    const { userId } = req.auth;
    const mockData = dataService.getMockUserData(userId);
    
    return res.status(200).json({
      success: true,
      data: mockData.transactions,
      isMock: true,
      error: error.message
    });
  }
});

module.exports = router;