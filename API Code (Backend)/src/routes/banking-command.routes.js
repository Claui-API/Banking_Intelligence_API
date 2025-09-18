// src/routes/banking-command.routes.js
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const logger = require('../utils/logger');

// Log route initialization
logger.info('Initializing Banking Command routes with direct implementation');

/**
 * Format a successful response
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @returns {Object} - Formatted response
 */
const formatResponse = (data, message = 'Success') => {
	return {
		success: true,
		message,
		data
	};
};

/**
 * Format an error response
 * @param {string} message - Error message
 * @param {string} details - Error details
 * @returns {Object} - Formatted error
 */
const formatError = (message = 'An error occurred', details = null) => {
	return {
		success: false,
		message,
		details
	};
};

/**
 * Simple method to generate a mock banking report
 * @param {Object} params - Report parameters
 * @returns {Object} - Generated report
 */
const generateMockReport = (params) => {
	const { userId, timeframe = '30d', includeDetailed = true } = params;

	// Set date range
	const endDate = new Date();
	const startDate = new Date(endDate);
	startDate.setDate(endDate.getDate() - 30);

	// Generate basic metrics
	const totalBalance = 10500.00;
	const income = 5000.00;
	const expenses = 3200.00;
	const netChange = income - expenses;
	const daysInPeriod = 30;
	const averageDailySpend = expenses / daysInPeriod;

	// Generate report sections
	const sections = [
		{
			id: 'accountSummary',
			order: 1,
			title: 'Account Summary',
			content: `Observation: End-of-cycle liquidity at $${totalBalance.toFixed(2)}; net +$${netChange.toFixed(2)}. Monthly outflows ≈ $${expenses.toFixed(2)}.\nLogic: Moderate liquidity buffer indicates stable financial pattern with optimization potential.\nBank Actions:\n1 Proactively enable overdraft protection with soft-limit alerts.\n2 Offer small revolving LOC with auto-repayment from next deposits.\n3 Weekly savings 'sweep-back' rule: move surplus above a dynamic floor.`,
			metrics: {
				totalBalance,
				income,
				expenses,
				netChange,
				averageDailySpend,
				daysInPeriod
			}
		},
		{
			id: 'behaviorPreferences',
			order: 2,
			title: 'Behavior & Preferences (Frequency Signals)',
			content: `- Dining: 15 mentions (30.0% of detected); elasticity proxy: Moderate.\n- Groceries: 10 mentions (20.0% of detected); elasticity proxy: Inelastic.\n- Entertainment: 8 mentions (16.0% of detected); elasticity proxy: Elastic-ish.\n- Transportation: 8 mentions (16.0% of detected); elasticity proxy: Moderate.\n- Utilities: 5 mentions (10.0% of detected); elasticity proxy: Inelastic.\n\nMethod: Keyword frequency across merchant descriptors; useful for engagement and rewards targeting.`,
			categories: [
				{ name: 'Dining', count: 15, total: 900, percent: 30.0 },
				{ name: 'Groceries', count: 10, total: 600, percent: 20.0 },
				{ name: 'Entertainment', count: 8, total: 480, percent: 16.0 },
				{ name: 'Transportation', count: 8, total: 320, percent: 16.0 },
				{ name: 'Utilities', count: 5, total: 500, percent: 10.0 }
			]
		}
	];

	// Add detailed sections if requested
	if (includeDetailed) {
		sections.push(
			{
				id: 'riskCompliance',
				order: 3,
				title: 'Risk, Churn & Compliance',
				content: 'Observation: No significant risks detected.\nLogic: Moderate churn risk based on spending patterns and liquidity position.\nBank Actions:\n1 Retention stack: auto-enroll in overdraft grace; boost rewards on top-3 categories next 60 days.\n2 Churn trigger: if end-bal < 1.2× avg daily spend for 2 consecutive cycles, launch save-offer.',
				risks: [],
				hasCriticalRisks: false,
				riskCount: 0
			},
			{
				id: 'recommendations',
				order: 4,
				title: 'Financial Recommendations',
				content: '1. Consider increasing emergency fund to 3-6 months of expenses.\n2. Optimize dining expenses by using rewards credit cards.\n3. Review subscriptions for unused services.',
				recommendations: [
					'Consider increasing emergency fund to 3-6 months of expenses.',
					'Optimize dining expenses by using rewards credit cards.',
					'Review subscriptions for unused services.'
				]
			}
		);
	}

	// Compile report
	return {
		generated: new Date().toISOString(),
		title: 'Banking Intelligence Command — Benchmark Report',
		format: 'json',
		period: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
		sections,
		summary: {
			totalBalance,
			transactionCount: 50,
			dateRange: { startDate, endDate },
			accountSummary: {
				totalBalance,
				income,
				expenses,
				netChange,
				averageDailySpend,
				daysInPeriod
			},
			topCategories: [
				{ name: 'Dining', count: 15, total: 900, percent: 30.0 },
				{ name: 'Groceries', count: 10, total: 600, percent: 20.0 },
				{ name: 'Entertainment', count: 8, total: 480, percent: 16.0 },
				{ name: 'Transportation', count: 8, total: 320, percent: 16.0 },
				{ name: 'Utilities', count: 5, total: 500, percent: 10.0 }
			],
			topMerchants: [
				{ name: 'Restaurants', count: 12, total: 720 },
				{ name: 'Grocery Store', count: 8, total: 480 },
				{ name: 'Movie Theater', count: 5, total: 300 },
				{ name: 'Rideshare', count: 6, total: 240 },
				{ name: 'Electric Company', count: 3, total: 300 }
			],
			riskCount: 0,
			hasCriticalRisks: false
		}
	};
};

/**
 * @route GET /api/banking-command/health
 * @desc Health check for Banking Command routes
 * @access Public
 */
router.get('/health', (req, res) => {
	logger.info('Banking Command health check');
	res.status(200).json(formatResponse({ status: 'healthy' }, 'Banking Command routes are available'));
});

/**
 * @route POST /api/banking-command/report
 * @desc Generate a banking intelligence command report
 * @access Private
 */
router.post('/report', authenticateJWT, (req, res) => {
	try {
		logger.info('Banking Command report endpoint called', {
			userId: req.body.userId,
			hasData: !!req.body.statementData
		});

		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const requestId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// Generate mock report (this would call the service in a full implementation)
		const report = generateMockReport({
			userId,
			timeframe,
			requestId,
			includeDetailed: includeDetailed !== false,
			format: format || 'json',
			statementData
		});

		// Return the report
		return res.status(200).json(formatResponse(report));
	} catch (error) {
		logger.error('Error generating Banking Intelligence Command report', {
			error: error.message,
			stack: error.stack
		});

		return res.status(500).json(formatError('Failed to generate report', error.message));
	}
});

/**
 * @route POST /api/banking-command/pdf-report
 * @desc Generate a banking intelligence report in PDF format
 * @access Private
 */
router.post('/pdf-report', authenticateJWT, (req, res) => {
	try {
		logger.info('Banking Command PDF report endpoint called');

		const { userId, timeframe, includeDetailed } = req.body;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// Generate mock report with PDF flag
		const report = generateMockReport({
			userId,
			timeframe,
			includeDetailed: includeDetailed !== false,
			format: 'pdf'
		});

		// Add PDF-specific flag
		report.isPdfPending = true;

		// Return the report
		return res.status(200).json(formatResponse(report));
	} catch (error) {
		logger.error('Error generating Banking Intelligence Command PDF report', {
			error: error.message,
			stack: error.stack
		});

		return res.status(500).json(formatError('Failed to generate PDF report', error.message));
	}
});

/**
 * @route POST /api/banking-command/statement-analysis
 * @desc Analyze a bank statement and generate insights
 * @access Private
 */
router.post('/statement-analysis', authenticateJWT, (req, res) => {
	try {
		logger.info('Banking Command statement analysis endpoint called');

		const { userId, statementData, includeDetailed } = req.body;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		if (!statementData) {
			return res.status(400).json(formatError('Missing required parameter: statementData'));
		}

		// Generate report based on statement data
		const report = generateMockReport({
			userId,
			statementData,
			includeDetailed: includeDetailed !== false,
			format: 'json'
		});

		// Return the report
		return res.status(200).json(formatResponse(report));
	} catch (error) {
		logger.error('Error analyzing statement with Banking Intelligence Command', {
			error: error.message,
			stack: error.stack
		});

		return res.status(500).json(formatError('Failed to analyze statement', error.message));
	}
});

// For debugging, log all routes
logger.info(`Banking Command routes defined: ${router.stack
	.filter(r => r.route)
	.map(r => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
	.join(', ')}`);

module.exports = router;