// src/controllers/unsubscribe.controller.js
const logger = require('../utils/logger');
const { processUnsubscribe } = require('../services/suppression.service');
const { validateEmail } = require('../utils/validation');

/**
 * Handle unsubscribe requests from email links
 */
const handleUnsubscribe = async (req, res) => {
	try {
		const { token } = req.query;

		if (!token) {
			logger.warn('Unsubscribe request without token', { ip: req.ip });
			return res.status(400).render('unsubscribe-error', {
				error: 'Invalid unsubscribe link. Please contact support if you need assistance.'
			});
		}

		// Decode the token
		let email, requestId;
		try {
			const decoded = Buffer.from(token, 'base64').toString('utf-8');
			[email, requestId] = decoded.split(':');
		} catch (decodeError) {
			logger.warn('Invalid unsubscribe token', { token, ip: req.ip });
			return res.status(400).render('unsubscribe-error', {
				error: 'Invalid unsubscribe link. Please contact support if you need assistance.'
			});
		}

		// Validate email
		if (!validateEmail(email)) {
			logger.warn('Invalid email in unsubscribe token', { email, ip: req.ip });
			return res.status(400).render('unsubscribe-error', {
				error: 'Invalid email address in unsubscribe link.'
			});
		}

		// Process unsubscribe
		const success = await processUnsubscribe(email, 'unsubscribe_link');

		if (success) {
			logger.info('Email unsubscribed successfully', {
				email,
				requestId,
				ip: req.ip,
				userAgent: req.get('User-Agent')
			});

			return res.render('unsubscribe-success', {
				email,
				contactEmail: 'business@vivytech.com'
			});
		} else {
			logger.error('Failed to process unsubscribe', { email, requestId });
			return res.status(500).render('unsubscribe-error', {
				error: 'Failed to process unsubscribe request. Please contact support.'
			});
		}

	} catch (error) {
		logger.error('Error processing unsubscribe request', {
			error: error.message,
			stack: error.stack,
			query: req.query,
			ip: req.ip
		});

		return res.status(500).render('unsubscribe-error', {
			error: 'An error occurred while processing your request. Please contact support.'
		});
	}
};

/**
 * Handle manual unsubscribe form submission
 */
const handleManualUnsubscribe = async (req, res) => {
	try {
		const { email } = req.body;

		// Validate email
		if (!validateEmail(email)) {
			return res.status(400).json({
				error: 'Please enter a valid email address.'
			});
		}

		// Process unsubscribe
		const success = await processUnsubscribe(email, 'manual_form');

		if (success) {
			logger.info('Manual unsubscribe processed', {
				email,
				ip: req.ip,
				userAgent: req.get('User-Agent')
			});

			return res.json({
				success: true,
				message: 'You have been successfully unsubscribed from all future communications.'
			});
		} else {
			return res.status(500).json({
				error: 'Failed to process unsubscribe request. Please try again or contact support.'
			});
		}

	} catch (error) {
		logger.error('Error processing manual unsubscribe', {
			error: error.message,
			email: req.body.email,
			ip: req.ip
		});

		return res.status(500).json({
			error: 'An error occurred while processing your request. Please try again.'
		});
	}
};

/**
 * Show unsubscribe form page
 */
const showUnsubscribePage = (req, res) => {
	res.render('unsubscribe-form', {
		title: 'Unsubscribe from Banking Intelligence Communications'
	});
};

module.exports = {
	handleUnsubscribe,
	handleManualUnsubscribe,
	showUnsubscribePage
};