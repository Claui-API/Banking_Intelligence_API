// src/routes/contact.routes.js (Updated)
const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../controllers/contact.controller');
const { contactFormRateLimit, spamDetectionMiddleware } = require('../middleware/rateLimiting');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @route   POST /api/contact
 * @desc    Submit contact form with enhanced security
 * @access  Public
 */
router.post('/',
	// Rate limiting
	contactFormRateLimit,

	// Input validation
	[
		body('name')
			.trim()
			.isLength({ min: 1, max: 100 })
			.withMessage('Name is required and must be less than 100 characters')
			.matches(/^[a-zA-Z\s\-'\.]+$/)
			.withMessage('Name contains invalid characters'),

		body('email')
			.trim()
			.isEmail()
			.normalizeEmail()
			.withMessage('Valid email is required')
			.isLength({ max: 255 })
			.withMessage('Email must be less than 255 characters'),

		body('company')
			.optional()
			.trim()
			.isLength({ max: 100 })
			.withMessage('Company name must be less than 100 characters')
			.matches(/^[a-zA-Z0-9\s\-'\.&,]*$/)
			.withMessage('Company name contains invalid characters'),

		body('message')
			.trim()
			.isLength({ min: 10, max: 2000 })
			.withMessage('Message must be between 10 and 2000 characters')
	],

	// Spam detection
	spamDetectionMiddleware,

	// Request handler
	async (req, res) => {
		try {
			// Check for validation errors
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const errorMessages = errors.array().map(error => error.msg);

				logger.warn('Contact form validation failed', {
					ip: req.ip,
					userAgent: req.get('User-Agent'),
					errors: errorMessages,
					suspicionScore: req.suspicionScore || 0
				});

				return res.status(400).json({
					error: errorMessages.length === 1
						? errorMessages[0]
						: `Please fix the following issues: ${errorMessages.join(', ')}`,
					type: 'validation_error',
					details: errorMessages
				});
			}

			// Log successful validation
			logger.info('Contact form validation passed', {
				ip: req.ip,
				userAgent: req.get('User-Agent'),
				email: req.body.email,
				company: req.body.company || 'Not provided',
				suspicionScore: req.suspicionScore || 0
			});

			// Pass to controller
			await submitContactForm(req, res);

		} catch (error) {
			logger.error('Contact route error', {
				error: error.message,
				stack: error.stack,
				ip: req.ip
			});

			res.status(500).json({
				error: 'Internal server error. Please try again later or contact us directly at business@vivytech.com.',
				type: 'server_error'
			});
		}
	}
);

/**
 * @route   GET /api/contact/health
 * @desc    Health check for contact service
 * @access  Public
 */
router.get('/health', async (req, res) => {
	try {
		const { getSuppressionStats } = require('../services/suppression.service');
		const suppressionStats = await getSuppressionStats();

		res.status(200).json({
			status: 'healthy',
			service: 'contact',
			timestamp: new Date().toISOString(),
			checks: {
				aws_ses: process.env.AWS_ACCESS_KEY_ID ? 'configured' : 'not_configured',
				verified_sender: process.env.VERIFIED_SENDER_EMAIL ? 'configured' : 'not_configured',
				suppression_service: suppressionStats ? 'operational' : 'error'
			},
			suppression_stats: suppressionStats
		});
	} catch (error) {
		logger.error('Contact health check failed', { error: error.message });
		res.status(500).json({
			status: 'unhealthy',
			service: 'contact',
			error: 'Health check failed'
		});
	}
});

module.exports = router;