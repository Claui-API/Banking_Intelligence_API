// insights.routes.js
const express = require('express');
const insightsController = require('../controllers/insights.controller');

const router = express.Router();

/**
 * @route POST /api/insights/generate
 * @desc Generate personal financial insights
 * @access Private
 */
router.post('/generate', insightsController.generateInsights);

/**
 * @route GET /api/insights/summary
 * @desc Get financial summary for the user
 * @access Private
 */
router.get('/summary', insightsController.getFinancialSummary);

module.exports = router;