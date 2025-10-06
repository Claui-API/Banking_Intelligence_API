// src/middleware/rateLimiting.js - Fixed version
const rateLimit = require('express-rate-limit');
const { checkRateLimit } = require('../utils/validation');
const logger = require('../utils/logger');

// Memory store for rate limiting (use Redis in production for multiple servers)
const requestStore = new Map();

/**
 * Rate limiting middleware for contact form
 */
const contactFormRateLimit = rateLimit({
	windowMs: parseInt(process.env.CONTACT_FORM_RATE_WINDOW) || 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.CONTACT_FORM_RATE_LIMIT) || 5, // limit each IP to 5 requests per windowMs
	message: {
		error: 'Too many contact form submissions from this IP. Please try again in 15 minutes.',
		type: 'rate_limit_exceeded',
		retryAfter: 15 * 60 // seconds
	},
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	skip: (req) => {
		// Skip rate limiting for certain IPs (optional)
		const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
		return trustedIPs.includes(req.ip);
	},
	// Replace deprecated onLimitReached with handler
	handler: (req, res) => {
		logger.warn('Rate limit exceeded for contact form', {
			ip: req.ip,
			userAgent: req.get('User-Agent'),
			timestamp: new Date().toISOString()
		});

		// Mark request as rate limited for the controller to handle
		req.rateLimited = true;

		// Send the response
		res.status(429).json({
			error: 'Too many contact form submissions from this IP. Please try again in 15 minutes.',
			type: 'rate_limit_exceeded',
			retryAfter: 15 * 60 // seconds
		});
	}
});

/**
 * Custom spam detection middleware
 */
const spamDetectionMiddleware = async (req, res, next) => {
	try {
		const { name, email, message, company } = req.body;

		// Check for suspicious patterns
		const suspiciousPatterns = [
			// Too many URLs
			(text) => (text.match(/https?:\/\/[^\s]+/g) || []).length > 2,

			// Suspicious keywords
			(text) => /\b(SEO|backlinks?|viagra|casino|lottery|crypto|bitcoin)\b/i.test(text),

			// Excessive caps
			(text) => text.length > 20 && (text.match(/[A-Z]/g) || []).length / text.length > 0.7,

			// Repeated characters
			(text) => /(.)\1{4,}/.test(text),

			// Email domain mismatch with company
			(email, company) => {
				if (!company) return false;
				const emailDomain = email.split('@')[1]?.toLowerCase();
				const companyWords = company.toLowerCase().split(/\s+/);
				return emailDomain && !companyWords.some(word =>
					word.length > 3 && emailDomain.includes(word.replace(/[^a-z]/g, ''))
				);
			}
		];

		const fullText = `${name} ${email} ${company || ''} ${message}`;
		let suspicionScore = 0;

		// Check text patterns
		suspiciousPatterns.slice(0, -1).forEach(pattern => {
			if (pattern(fullText)) suspicionScore++;
		});

		// Check email-company mismatch
		if (suspiciousPatterns[suspiciousPatterns.length - 1](email, company)) {
			suspicionScore++;
		}

		// Additional checks
		if (message && message.length < 20) suspicionScore++;
		if (name && name.length < 2) suspicionScore++;

		// Check for disposable email domains
		const disposableDomains = [
			'tempmail.org', '10minutemail.com', 'guerrillamail.com',
			'mailinator.com', 'throwaway.email', 'temp-mail.org'
		];
		const emailDomain = email?.split('@')[1]?.toLowerCase();
		if (emailDomain && disposableDomains.includes(emailDomain)) {
			suspicionScore += 2;
		}

		// Log suspicious activity
		if (suspicionScore >= 2) {
			logger.warn('Potential spam detected in contact form', {
				ip: req.ip,
				suspicionScore,
				email,
				name,
				company: company || 'Not provided',
				messageLength: message?.length || 0,
				userAgent: req.get('User-Agent')
			});

			// Block if high suspicion
			if (suspicionScore >= 4) {
				return res.status(400).json({
					error: 'Your submission appears to be spam. Please contact us directly if this is a legitimate inquiry.',
					type: 'spam_detected'
				});
			}
		}

		// Add suspicion score to request for logging
		req.suspicionScore = suspicionScore;
		next();

	} catch (error) {
		logger.error('Error in spam detection middleware', { error: error.message });
		// Don't block on middleware errors
		next();
	}
};

/**
 * General API rate limiter
 */
const generalRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	message: {
		error: 'Too many requests from this IP, please try again later.',
		type: 'rate_limit_exceeded'
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn('General rate limit exceeded', {
			ip: req.ip,
			userAgent: req.get('User-Agent'),
			path: req.path,
			method: req.method
		});

		res.status(429).json({
			error: 'Too many requests from this IP, please try again later.',
			type: 'rate_limit_exceeded'
		});
	}
});

/**
 * Authentication rate limiter
 */
const authRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Limit each IP to 10 authentication attempts per 15 minutes
	message: {
		error: 'Too many authentication attempts. Please try again in 15 minutes.',
		type: 'auth_rate_limit_exceeded'
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn('Authentication rate limit exceeded', {
			ip: req.ip,
			userAgent: req.get('User-Agent'),
			path: req.path
		});

		res.status(429).json({
			error: 'Too many authentication attempts. Please try again in 15 minutes.',
			type: 'auth_rate_limit_exceeded'
		});
	}
});

module.exports = {
	contactFormRateLimit,
	spamDetectionMiddleware,
	generalRateLimit,
	authRateLimit
};