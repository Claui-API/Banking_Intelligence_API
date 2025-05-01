// src/routes/insights-metrics.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');

// DO NOT use the router.use() middleware pattern for auth
// This is causing the 401 errors - each route needs its own middleware

/**
 * @route GET /api/insights/metrics/system
 * @desc Get system-wide insight metrics
 * @access Private (Admin only)
 */
router.get('/system', authMiddleware, authorize('admin'), (req, res) => {
  try {
    // Return appropriate mock data
    const responseData = {
      totalQueries: 1432,
      successfulQueries: 1398,
      failedQueries: 34,
      successRate: '97.6%',
      avgResponseTime: 456,
      minResponseTime: 250,
      maxResponseTime: 1750,
      todayQueries: Math.floor(Math.random() * 100) + 50,
      queryTypeDistribution: {
        financial: 487,
        budgeting: 302,
        saving: 276,
        spending: 201,
        investing: 89,
        debt: 77
      },
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get system metrics'
    });
  }
});

/**
 * @route GET /api/insights/metrics/history
 * @desc Get historical insight metrics
 * @access Private (Admin only)
 */
router.get('/history', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const responseData = Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      
      return {
        date: date.toISOString().split('T')[0],
        totalQueries: Math.floor(Math.random() * 100) + 50,
        successfulQueries: Math.floor(Math.random() * 90) + 45,
        failedQueries: Math.floor(Math.random() * 10),
        successRate: '95.0',
        avgResponseTime: Math.floor(Math.random() * 200) + 350,
        responseTime: Math.floor(Math.random() * 200) + 350
      };
    });
    
    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting historical metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get historical metrics'
    });
  }
});

/**
 * @route GET /api/insights/metrics/users
 * @desc Get per-user insight metrics
 * @access Private (Admin only)
 */
router.get('/users', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const responseData = Array.from({ length: 8 }).map((_, i) => ({
      userId: `user-${i + 1}`,
      name: `Test User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      queryCount: Math.floor(Math.random() * 200) + 50,
      successCount: Math.floor(Math.random() * 180) + 40,
      failedCount: Math.floor(Math.random() * 10),
      avgResponseTime: Math.floor(Math.random() * 300) + 300,
      successRate: '94.5',
      lastActive: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
      mostCommonQueryType: ['financial', 'budgeting', 'saving', 'spending'][Math.floor(Math.random() * 4)],
      recentQueries: Array.from({ length: 5 }).map((_, j) => ({
        queryId: `query-${i + 1}-${j + 1}`,
        query: ['How can I save money?', 'What are my spending patterns?', 'How to budget better?'][Math.floor(Math.random() * 3)],
        queryType: ['financial', 'budgeting', 'saving', 'spending'][Math.floor(Math.random() * 4)],
        processingTime: Math.floor(Math.random() * 500) + 300,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)).toISOString()
      })),
      activityByHour: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
      activityByDay: Array(7).fill(0).map(() => Math.floor(Math.random() * 8))
    }));
    
    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting user metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user metrics'
    });
  }
});

/**
 * @route GET /api/insights/metrics/query-types
 * @desc Get query type distribution metrics
 * @access Private (Admin only)
 */
router.get('/query-types', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const responseData = {
      distribution: {
        financial: 487,
        budgeting: 302,
        saving: 276,
        spending: 201,
        investing: 89,
        debt: 77
      },
      formattedData: [
        { type: 'financial', count: 487, percentage: '34.0' },
        { type: 'budgeting', count: 302, percentage: '21.1' },
        { type: 'saving', count: 276, percentage: '19.3' },
        { type: 'spending', count: 201, percentage: '14.0' },
        { type: 'investing', count: 89, percentage: '6.2' },
        { type: 'debt', count: 77, percentage: '5.4' }
      ]
    };
    
    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting query type metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get query type metrics'
    });
  }
});

module.exports = router;