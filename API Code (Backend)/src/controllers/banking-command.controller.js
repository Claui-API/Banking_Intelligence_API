// src/controllers/banking-command.controller.js
const logger = require('../utils/logger');
const BankingCommandService = require('../services/banking-command.service');
const { formatResponse, formatError } = require('../utils/response-formatter');

// Initialize banking command service
const bankingCommandService = new BankingCommandService();

/**
 * Banking Command Controller
 * Handles requests for banking intelligence reports
 */
const bankingCommandController = {
	/**
	 * Generate a comprehensive banking intelligence report
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	generateReport: async (req, res) => {
		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const requestId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		try {
			logger.info('Banking Intelligence Command report requested', {
				userId,
				timeframe,
				requestId,
				includeDetailed,
				format,
				hasStatementData: !!statementData
			});

			// Validate required parameters
			if (!userId) {
				return res.status(400).json(formatError('Missing required parameter: userId'));
			}

			// Generate report
			const report = await bankingCommandService.generateReport({
				userId,
				timeframe,
				requestId,
				includeDetailed: includeDetailed !== false, // Default to true if not specified
				format: format || 'json',
				statementData
			});

			// Return the report
			return res.status(200).json(formatResponse(report));
		} catch (error) {
			logger.error('Error generating Banking Intelligence Command report', {
				requestId,
				error: error.message,
				stack: error.stack
			});

			return res.status(500).json(formatError('Failed to generate report', error.message));
		}
	},

	/**
	 * Generate a banking intelligence report in PDF format
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	generatePdfReport: async (req, res) => {
		const { userId, timeframe, includeDetailed } = req.body;
		const requestId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		try {
			logger.info('Banking Intelligence Command PDF report requested', {
				userId,
				timeframe,
				requestId,
				includeDetailed
			});

			// Validate required parameters
			if (!userId) {
				return res.status(400).json(formatError('Missing required parameter: userId'));
			}

			// Generate report with PDF format
			const report = await bankingCommandService.generateReport({
				userId,
				timeframe,
				requestId,
				includeDetailed: includeDetailed !== false,
				format: 'pdf'
			});

			// Return the PDF report
			return res.status(200).json(formatResponse(report));
		} catch (error) {
			logger.error('Error generating Banking Intelligence Command PDF report', {
				requestId,
				error: error.message,
				stack: error.stack
			});

			return res.status(500).json(formatError('Failed to generate PDF report', error.message));
		}
	},

	/**
	 * Analyze a bank statement and generate insights
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	analyzeStatement: async (req, res) => {
		const { userId, statementData, includeDetailed } = req.body;
		const requestId = `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		try {
			logger.info('Banking Intelligence Command statement analysis requested', {
				userId,
				requestId,
				includeDetailed,
				hasStatementData: !!statementData
			});

			// Validate required parameters
			if (!userId) {
				return res.status(400).json(formatError('Missing required parameter: userId'));
			}

			if (!statementData) {
				return res.status(400).json(formatError('Missing required parameter: statementData'));
			}

			// Generate report based on statement data
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
				requestId,
				error: error.message,
				stack: error.stack
			});

			return res.status(500).json(formatError('Failed to analyze statement', error.message));
		}
	}
};

module.exports = bankingCommandController;