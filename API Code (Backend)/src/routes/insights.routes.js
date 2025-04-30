// src/routes/insights.routes.js
const express = require('express');
const insightsController = require('../controllers/insights.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/insights/generate
 * @desc Generate personal financial insights
 * @access Private
 */
router.post('/generate', authMiddleware, insightsController.generateInsights);

/**
 * @route GET /api/insights/summary
 * @desc Get financial summary for the user
 * @access Private
 */
router.get('/summary', authMiddleware, insightsController.getFinancialSummary);

/**
 * @route GET /api/insights/rag-metrics
 * @desc Get RAG system performance metrics
 * @access Private (Admin only)
 */
router.get('/rag-metrics', authMiddleware, authorize('admin'), insightsController.getRagMetrics);

module.exports = router;