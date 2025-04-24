// src/routes/insights.mobile.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * @route GET /api/v1/mobile/financial-snapshot
 * @desc Get lightweight financial summary for mobile devices
 * @access Private
 */
router.get('/financial-snapshot', authMiddleware, (req, res) => {
  try {
    const { userId } = req.auth;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    logger.info(`Getting financial snapshot for mobile - user: ${userId}`);
    
    // Here you would implement your financial snapshot logic
    // For now, just return a mock response
    return res.status(200).json({
      success: true,
      data: {
        totalBalance: 15000.25,
        netWorth: 12500.50,
        accountCount: 3,
        accounts: [
          {
            id: 'acc-001',
            name: 'Checking',
            type: 'Checking',
            balance: 5000.25
          },
          {
            id: 'acc-002',
            name: 'Savings',
            type: 'Savings',
            balance: 10000.00
          }
        ],
        recentTransactions: [
          {
            id: 'txn-001',
            date: new Date().toISOString(),
            description: 'Grocery Store',
            amount: -125.50,
            category: 'Food'
          },
          {
            id: 'txn-002',
            date: new Date().toISOString(),
            description: 'Paycheck',
            amount: 3000.00,
            category: 'Income'
          }
        ],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting financial snapshot for mobile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get financial snapshot'
    });
  }
});

/**
 * @route POST /api/v1/mobile/quick-insight
 * @desc Get a short insight for mobile display
 * @access Private
 */
router.post('/quick-insight', authMiddleware, (req, res) => {
  try {
    const { userId } = req.auth;
    const { query } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        message: 'User ID and query are required'
      });
    }
    
    logger.info(`Generating quick insight for user ${userId}, query: ${query}`);
    
    // Here you would implement your quick insight generation logic
    // For now, just return a mock response
    return res.status(200).json({
      success: true,
      data: {
        insight: `Based on your spending patterns, you're doing well with your budgeting this month. Your biggest expense category is Food (25% of spending).`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error generating quick insight for mobile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate quick insight'
    });
  }
});

module.exports = router;