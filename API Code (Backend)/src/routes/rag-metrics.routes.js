// src/routes/rag-metrics.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const ragMetricsController = require('../controllers/rag-metrics.controller');

/**
 * All routes require admin authentication
 */
router.use(authMiddleware, authorize('admin'));

/**
 * @route GET /api/rag-metrics/system
 * @desc Get system-wide RAG metrics
 * @access Private (Admin only)
 */
router.get('/system', ragMetricsController.getSystemMetrics);

/**
 * @route GET /api/rag-metrics/system/history
 * @desc Get historical RAG metrics
 * @access Private (Admin only)
 */
router.get('/system/history', ragMetricsController.getHistoricalMetrics);

/**
 * @route GET /api/rag-metrics/users
 * @desc Get per-user RAG metrics
 * @access Private (Admin only)
 */
router.get('/users', ragMetricsController.getUserMetrics);

/**
 * @route GET /api/rag-metrics/query-types
 * @desc Get query type distribution metrics
 * @access Private (Admin only)
 */
router.get('/query-types', ragMetricsController.getQueryTypeMetrics);

module.exports = router;