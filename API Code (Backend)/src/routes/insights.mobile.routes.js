// insights.mobile.routes.js
const express = require('express');
const insightsController = require('../controllers/insights.controller');
const mobileOptimizer = require('../middleware/mobile-optimizer');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/v1/mobile/financial-snapshot
 * @desc Get lightweight financial summary for mobile devices
 * @access Private
 */
router.get('/financial-snapshot', authMiddleware, mobileOptimizer, async (req, res, next) => {
  try {
    const { userId } = req.auth;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    logger.info(`Getting financial snapshot for mobile - user: ${userId}`);
    
    // Get the full data first
    const fullData = await insightsController.getFinancialSummaryData(userId);
    
    // Create a lightweight version for mobile
    const mobileData = {
      totalBalance: fullData.totalBalance,
      netWorth: fullData.netWorth,
      accountCount: fullData.accounts.length,
      // Simplify account data
      accounts: fullData.accounts.map(account => ({
        id: account.accountId,
        name: account.name,
        type: account.type,
        balance: account.balance
      })),
      // Only include last 3 transactions
      recentTransactions: fullData.recentTransactions.slice(0, 3).map(tx => ({
        id: tx.transactionId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category
      })),
      // Add a timestamp for caching purposes
      timestamp: new Date().toISOString()
    };
    
    // Set appropriate cache headers
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
    
    return res.status(200).json({
      success: true,
      data: mobileData
    });
  } catch (error) {
    logger.error(`Error getting financial snapshot for mobile: ${error.message}`, {
      error: error.stack,
      userId: req.auth?.userId
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/mobile/quick-insight
 * @desc Get a short insight for mobile display
 * @access Private
 */
router.post('/quick-insight', authMiddleware, mobileOptimizer, async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { query } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        message: 'User ID and query are required'
      });
    }
    
    // Get a shortened insight for mobile display
    const insight = await insightsController.generateQuickInsight(userId, query);
    
    return res.status(200).json({
      success: true,
      data: {
        insight,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error generating quick insight for mobile: ${error.message}`, {
      error: error.stack,
      userId: req.auth?.userId,
      query: req.body?.query
    });
    next(error);
  }
});

module.exports = router;