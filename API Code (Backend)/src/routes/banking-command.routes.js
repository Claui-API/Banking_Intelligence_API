// src/routes/banking-command.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const bankingCommandService = require('../services/banking-command.service');

// Log route initialization
logger.info('Initializing Banking Command routes with service implementation');

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
	res.status(200).json(formatResponse({ status: 'healthy' }, 'Banking Command routes are available'));
});

/**
 * @route POST /api/banking-command/report
 * @desc Generate a banking intelligence command report
 * @access Private
 */
router.post('/report', authMiddleware, setExtendedTimeout, async (req, res) => {
	try {
		logger.info('Banking Command report endpoint called', {
			userId: req.body.userId,
			hasData: !!req.body.statementData
		});

		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const requestId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
		const startTime = Date.now();

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// For streaming progress updates (optional - comment out if not needed)
		const useStreaming = req.headers['accept'] === 'text/event-stream';

		if (useStreaming) {
			// Set up SSE headers for progress streaming
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'X-Accel-Buffering': 'no' // Disable Nginx buffering
			});

			// Send initial progress
			res.write(`data: ${JSON.stringify({
				status: 'processing',
				message: 'Starting report generation...',
				progress: 0
			})}\n\n`);

			// Keep connection alive
			const keepAlive = setInterval(() => {
				res.write(`: keep-alive\n\n`);
			}, 15000);

			try {
				// Generate report with progress callback
				const report = await bankingCommandService.generateReport({
					userId,
					timeframe,
					requestId,
					includeDetailed: includeDetailed !== false,
					format: format || 'json',
					statementData,
					onProgress: (progress, message) => {
						// Send progress updates
						res.write(`data: ${JSON.stringify({
							status: 'processing',
							message,
							progress
						})}\n\n`);
					}
				});

				// Clear keep-alive
				clearInterval(keepAlive);

				// Send completion
				res.write(`data: ${JSON.stringify({
					status: 'complete',
					data: report,
					duration: Date.now() - startTime
				})}\n\n`);

				res.end();
			} catch (error) {
				clearInterval(keepAlive);
				res.write(`data: ${JSON.stringify({
					status: 'error',
					error: error.message
				})}\n\n`);
				res.end();
			}
		} else {
			// Standard JSON response
			const report = await bankingCommandService.generateReport({
				userId,
				timeframe,
				requestId,
				includeDetailed: includeDetailed !== false,
				format: format || 'json',
				statementData
			});

			logger.info(`Report generated successfully in ${Date.now() - startTime}ms`, {
				userId,
				requestId
			});

			// Return the report
			return res.status(200).json(formatResponse(report));
		}
	} catch (error) {
		logger.error('Error generating Banking Intelligence Command report', {
			error: error.message,
			stack: error.stack
		});

		// Only send response if not streaming
		if (!res.headersSent) {
			return res.status(500).json(formatError('Failed to generate report', error.message));
		}
	}
});

/**
 * @route POST /api/banking-command/report-chunked
 * @desc Generate a banking intelligence report with chunked transfer encoding
 * @access Private
 */
router.post('/report-chunked', authMiddleware, setExtendedTimeout, async (req, res) => {
	try {
		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const requestId = `chunked-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// Set chunked transfer encoding
		res.writeHead(200, {
			'Content-Type': 'application/json',
			'Transfer-Encoding': 'chunked',
			'X-Content-Type-Options': 'nosniff'
		});

		// Send progress chunks to prevent timeout
		const progressInterval = setInterval(() => {
			if (!res.writableEnded) {
				res.write(JSON.stringify({
					type: 'progress',
					timestamp: new Date().toISOString()
				}) + '\n');
			}
		}, 10000); // Send keep-alive every 10 seconds

		try {
			// Generate the report
			const report = await bankingCommandService.generateReport({
				userId,
				timeframe,
				requestId,
				includeDetailed: includeDetailed !== false,
				format: format || 'json',
				statementData
			});

			// Clear progress interval
			clearInterval(progressInterval);

			// Send final result
			res.write(JSON.stringify({
				type: 'complete',
				data: report
			}));
			res.end();
		} catch (error) {
			clearInterval(progressInterval);
			if (!res.writableEnded) {
				res.write(JSON.stringify({
					type: 'error',
					error: error.message
				}));
				res.end();
			}
		}
	} catch (error) {
		logger.error('Error in chunked report generation', {
			error: error.message
		});

		if (!res.headersSent && !res.writableEnded) {
			res.end(JSON.stringify(formatError('Failed to generate report', error.message)));
		}
	}
});

/**
 * @route POST /api/banking-command/pdf-report
 * @desc Generate a banking intelligence report in PDF format
 * @access Private
 */
router.post('/pdf-report', authMiddleware, setExtendedTimeout, async (req, res) => {
	try {
		logger.info('Banking Command PDF report endpoint called');

		const { userId, timeframe, includeDetailed } = req.body;
		const requestId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		// Generate report using the service with PDF format
		const report = await bankingCommandService.generateReport({
			userId,
			timeframe,
			requestId,
			includeDetailed: includeDetailed !== false,
			format: 'pdf'
		});

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
router.post('/statement-analysis', authMiddleware, setExtendedTimeout, async (req, res) => {
	try {
		logger.info('Banking Command statement analysis endpoint called');

		const { userId, statementData, includeDetailed } = req.body;
		const requestId = `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		// Validate required parameters
		if (!userId) {
			return res.status(400).json(formatError('Missing required parameter: userId'));
		}

		if (!statementData) {
			return res.status(400).json(formatError('Missing required parameter: statementData'));
		}

		// Generate report based on statement data using the service
		const report = await bankingCommandService.generateReport({
			userId,
			statementData,
			requestId,
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

// In-memory store for report jobs (consider using Redis in production)
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
 * Background report generation function
 * @param {string} jobId - Job ID
 */
async function generateReportAsync(jobId) {
	const job = reportJobs[jobId];

	try {
		// Update status
		job.status = 'processing';
		job.progress = 10;
		job.progressMessage = 'Initializing report generation...';

		// Add progress callback to parameters
		const paramsWithProgress = {
			...job.parameters,
			requestId: jobId,
			onProgress: (progress, message) => {
				job.progress = progress;
				job.progressMessage = message;
				logger.debug(`Job ${jobId} progress: ${progress}% - ${message}`);
			}
		};

		// Generate report
		const report = await bankingCommandService.generateReport(paramsWithProgress);

		// Store result and update status
		job.result = report;
		job.status = 'completed';
		job.completedAt = new Date();
		job.progress = 100;
		job.progressMessage = 'Report generation completed';

		logger.info('Async report generation completed', {
			jobId,
			userId: job.parameters.userId,
			duration: new Date() - job.requestedAt
		});
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
			progressMessage: job.progressMessage
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
		const result = job.result;
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