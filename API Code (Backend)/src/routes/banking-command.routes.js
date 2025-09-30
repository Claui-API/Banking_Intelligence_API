// src/routes/banking-command.routes.js
const express = require('express');
const bankingCommandController = require('../controllers/banking-command.controller');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const reportCache = require('../utils/report-cache');

// Log route initialization
logger.info('Initializing Banking Command routes with caching support');

// Timeout configuration
const LONG_TIMEOUT = 120000; // 120 seconds for report generation
const DEFAULT_TIMEOUT = 30000; // 30 seconds default

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
 * Middleware to set extended timeout for report endpoints
 */
const setExtendedTimeout = (req, res, next) => {
	req.setTimeout(LONG_TIMEOUT);
	res.setTimeout(LONG_TIMEOUT);
	logger.info(`Extended timeout (${LONG_TIMEOUT}ms) set for request: ${req.path}`);
	next();
};

/**
 * @route GET /api/banking-command/health
 * @desc Health check for Banking Command routes
 * @access Public
 */
router.get('/health', (req, res) => {
	logger.info('Banking Command health check');
	const cacheStats = reportCache.getStats();
	res.status(200).json(formatResponse({
		status: 'healthy',
		cache: cacheStats
	}, 'Banking Command routes are available'));
});

/**
 * @route POST /api/banking-command/report
 * @desc Generate a banking intelligence command report with smart caching
 * @desc Supports both JSON and PDF formats based on format parameter
 * @access Private
 */
router.post('/report', authMiddleware, setExtendedTimeout, bankingCommandController.generateReport);

// Add these routes to your existing banking-command.routes.js file
// Place them after the existing POST /report route

/**
 * @route GET /api/banking-command/report
 * @desc Generate a banking intelligence report via GET (useful for HTML links)
 * @access Private
 */
router.get('/report', authMiddleware, setExtendedTimeout, (req, res) => {
	// Convert query parameters to request body format
	const { userId, timeframe, includeDetailed, format } = req.query;

	// Validate required parameters
	if (!userId) {
		return res.status(400).json(formatError('Missing required parameter: userId'));
	}

	// Create request object that matches POST format
	req.body = {
		userId,
		timeframe: timeframe || '30d',
		includeDetailed: includeDetailed !== 'false', // Convert string to boolean
		format: format || 'json'
	};

	logger.info('Banking Command GET report request', {
		userId,
		format: format || 'json',
		timeframe: timeframe || '30d',
		query: req.query
	});

	// Forward to the POST handler
	bankingCommandController.generateReport(req, res);
});

/**
 * @route GET /api/banking-command/html-report/:userId
 * @desc Generate an HTML banking intelligence report with clean URL
 * @access Private
 */
router.get('/html-report/:userId', authMiddleware, setExtendedTimeout, (req, res) => {
	const { userId } = req.params;
	const { timeframe, includeDetailed } = req.query;

	// Create request object for HTML format
	req.body = {
		userId,
		timeframe: timeframe || '30d',
		includeDetailed: includeDetailed !== 'false',
		format: 'html'
	};

	logger.info('Banking Command HTML report request', {
		userId,
		timeframe: timeframe || '30d',
		includeDetailed: includeDetailed !== 'false'
	});

	// Forward to the main controller
	bankingCommandController.generateReport(req, res);
});

/**
 * @route GET /api/banking-command/pdf-report/:userId
 * @desc Generate a PDF-ready banking intelligence report
 * @access Private
 */
router.get('/pdf-report/:userId', authMiddleware, setExtendedTimeout, (req, res) => {
	const { userId } = req.params;
	const { timeframe, includeDetailed } = req.query;

	// Create request object for PDF format
	req.body = {
		userId,
		timeframe: timeframe || '30d',
		includeDetailed: includeDetailed !== 'false',
		format: 'pdf'
	};

	logger.info('Banking Command PDF report request', {
		userId,
		timeframe: timeframe || '30d',
		includeDetailed: includeDetailed !== 'false'
	});

	// Forward to the main controller
	bankingCommandController.generateReport(req, res);
});

/**
 * @route POST /api/banking-command/pdf-report
 * @desc DEPRECATED: Generate a banking intelligence report in PDF format
 * @desc Use /report with format='pdf' instead for better caching
 * @access Private
 */
router.post('/pdf-report', authMiddleware, setExtendedTimeout, (req, res, next) => {
	logger.warn('DEPRECATED: /pdf-report endpoint used. Consider using /report with format=pdf');
	// Add deprecation header
	res.setHeader('X-Deprecation-Warning', 'This endpoint is deprecated. Use /report with format=pdf');
	// Set format and forward to main controller
	req.body.format = 'pdf';
	bankingCommandController.generateReport(req, res);
});

/**
 * @route POST /api/banking-command/statement-analysis
 * @desc Analyze a bank statement and generate insights
 * @access Private
 */
router.post('/statement-analysis', authMiddleware, setExtendedTimeout, bankingCommandController.analyzeStatement);

/**
 * @route GET /api/banking-command/cache/stats
 * @desc Get cache statistics for monitoring
 * @access Private
 */
router.get('/cache/stats', authMiddleware, bankingCommandController.getCacheStats);

/**
 * @route POST /api/banking-command/cache/clear
 * @desc Clear the report cache (admin function)
 * @access Private
 */
router.post('/cache/clear', authMiddleware, bankingCommandController.clearCache);

/**
 * @route DELETE /api/banking-command/cache/:userId
 * @desc Clear cache entries for a specific user
 * @access Private
 */
router.delete('/cache/:userId', authMiddleware, (req, res) => {
	try {
		const { userId } = req.params;

		// This is a simplified approach - in a more sophisticated implementation,
		// you'd iterate through cache keys and delete matching ones
		logger.info(`Cache invalidation requested for user: ${userId}`);

		// For now, we'll just clear the entire cache
		// In production, implement user-specific cache invalidation
		reportCache.clear();

		res.status(200).json(formatResponse({
			userId,
			action: 'cache_cleared'
		}, 'User cache entries cleared'));
	} catch (error) {
		logger.error('Error clearing user cache:', error);
		res.status(500).json(formatError('Failed to clear user cache'));
	}
});

// Legacy async endpoints (keeping for backward compatibility)
const reportJobs = {};

// Clean up old jobs periodically (every hour)
setInterval(() => {
	const oneHourAgo = Date.now() - (60 * 60 * 1000);
	Object.keys(reportJobs).forEach(jobId => {
		const job = reportJobs[jobId];
		if (job.requestedAt && new Date(job.requestedAt).getTime() < oneHourAgo) {
			delete reportJobs[jobId];
			logger.info(`Cleaned up old job: ${jobId}`);
		}
	});
}, 60 * 60 * 1000);

/**
 * @route POST /api/banking-command/async-report
 * @desc Asynchronously generate a banking intelligence report
 * @access Private
 */
router.post('/async-report', authMiddleware, async (req, res) => {
	try {
		logger.info('Banking Command async report endpoint called', {
			userId: req.body.userId
		});

		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// Check if report is already cached
		const cacheParams = { userId, timeframe, includeDetailed, statementData };
		if (reportCache.has(cacheParams)) {
			// Return immediately if cached
			const cachedReport = reportCache.get(cacheParams);
			logger.info(`Async request served immediately from cache: ${jobId}`);

			return res.status(200).json(formatResponse({
				jobId,
				status: 'completed',
				data: cachedReport,
				fromCache: true,
				resultUrl: `/api/banking-command/report-result/${jobId}`
			}, 'Report available immediately from cache'));
		}

		// Store job info
		reportJobs[jobId] = {
			status: 'pending',
			userId,
			requestedAt: new Date(),
			parameters: { userId, timeframe, includeDetailed, format, statementData },
			result: null,
			error: null,
			progress: 0,
			progressMessage: 'Queued for processing'
		};

		// Start background processing
		generateReportAsync(jobId);

		// Return job ID immediately
		return res.status(202).json(formatResponse({
			jobId,
			status: 'pending',
			checkStatusUrl: `/api/banking-command/report-status/${jobId}`,
			resultUrl: `/api/banking-command/report-result/${jobId}`
		}, 'Report generation started. Use the job ID to check status.'));
	} catch (error) {
		logger.error('Error initiating Banking Intelligence Command report', {
			error: error.message,
			stack: error.stack
		});

		return res.status(500).json(formatError('Failed to initiate report generation', error.message));
	}
});

/**
 * Background report generation function with caching integration
 * @param {string} jobId - Job ID
 */
async function generateReportAsync(jobId) {
	const job = reportJobs[jobId];

	try {
		// Update status
		job.status = 'processing';
		job.progress = 10;
		job.progressMessage = 'Checking cache...';

		// Check cache first
		const cacheParams = {
			userId: job.parameters.userId,
			timeframe: job.parameters.timeframe,
			includeDetailed: job.parameters.includeDetailed,
			statementData: job.parameters.statementData
		};

		let report = reportCache.get(cacheParams);

		if (report) {
			// Serve from cache
			job.result = report;
			job.status = 'completed';
			job.completedAt = new Date();
			job.progress = 100;
			job.progressMessage = 'Report served from cache';
			job.fromCache = true;

			logger.info('Async report served from cache', {
				jobId,
				userId: job.parameters.userId
			});
		} else {
			// Generate new report
			job.progress = 20;
			job.progressMessage = 'Generating new report...';

			const bankingCommandService = require('../services/banking-command.service');

			// Add progress callback to parameters
			const paramsWithProgress = {
				...job.parameters,
				requestId: jobId,
				format: 'json', // Always generate JSON for caching
				onProgress: (progress, message) => {
					job.progress = Math.max(20, Math.min(90, progress)); // Keep within 20-90 range
					job.progressMessage = message;
					logger.debug(`Job ${jobId} progress: ${job.progress}% - ${message}`);
				}
			};

			// Generate report
			report = await bankingCommandService.generateReport(paramsWithProgress);

			// Cache the new report
			reportCache.set(cacheParams, report);

			// Store result and update status
			job.result = report;
			job.status = 'completed';
			job.completedAt = new Date();
			job.progress = 100;
			job.progressMessage = 'Report generation completed';
			job.fromCache = false;

			logger.info('Async report generation completed and cached', {
				jobId,
				userId: job.parameters.userId,
				duration: new Date() - job.requestedAt
			});
		}
	} catch (error) {
		// Handle failure
		job.status = 'failed';
		job.error = error.message;
		job.progress = 0;
		job.progressMessage = `Failed: ${error.message}`;

		logger.error('Async report generation failed', {
			jobId,
			userId: job.parameters.userId,
			error: error.message
		});
	}
}

/**
 * @route GET /api/banking-command/report-status/:jobId
 * @desc Check the status of an asynchronous report
 * @access Private
 */
router.get('/report-status/:jobId', authMiddleware, (req, res) => {
	try {
		const { jobId } = req.params;
		const job = reportJobs[jobId];

		if (!job) {
			return res.status(404).json(formatError('Report job not found'));
		}

		// Create response
		const response = {
			jobId,
			status: job.status,
			userId: job.userId,
			requestedAt: job.requestedAt,
			progress: job.progress,
			progressMessage: job.progressMessage,
			fromCache: job.fromCache || false
		};

		if (job.status === 'completed') {
			response.completedAt = job.completedAt;
			response.resultUrl = `/api/banking-command/report-result/${jobId}`;
		} else if (job.status === 'failed') {
			response.error = job.error;
		}

		return res.status(200).json(formatResponse(response));
	} catch (error) {
		logger.error('Error checking report status', {
			error: error.message
		});

		return res.status(500).json(formatError('Failed to check report status', error.message));
	}
});

/**
 * @route GET /api/banking-command/report-result/:jobId
 * @desc Get the result of a completed report
 * @access Private
 */
router.get('/report-result/:jobId', authMiddleware, (req, res) => {
	try {
		const { jobId } = req.params;
		const job = reportJobs[jobId];

		if (!job) {
			return res.status(404).json(formatError('Report job not found'));
		}

		if (job.status !== 'completed') {
			return res.status(400).json(formatError(
				`Report not ready. Current status: ${job.status}`,
				{ progress: job.progress, message: job.progressMessage }
			));
		}

		// Clean up job after successful retrieval (optional)
		const result = {
			...job.result,
			_metadata: {
				fromCache: job.fromCache || false,
				completedAt: job.completedAt,
				requestedAt: job.requestedAt,
				duration: job.completedAt - job.requestedAt
			}
		};
		delete reportJobs[jobId];

		return res.status(200).json(formatResponse(result));
	} catch (error) {
		logger.error('Error retrieving report result', {
			error: error.message
		});

		return res.status(500).json(formatError('Failed to retrieve report result', error.message));
	}
});

// For debugging, log all routes
logger.info(`Banking Command routes defined: ${router.stack
	.filter(r => r.route)
	.map(r => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
	.join(', ')}`);

module.exports = router;