// src/middleware/rateLimiting.js - Fixed version with proper trust proxy handling
const rateLimit = require('express-rate-limit');
const { checkRateLimit } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Rate limiting middleware for contact form - with proper trust proxy handling
 */
const contactFormRateLimit = rateLimit({
	windowMs: parseInt(process.env.CONTACT_FORM_RATE_WINDOW) || 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.CONTACT_FORM_RATE_LIMIT) || 5, // limit each IP to 5 requests per windowMs
	message: {
		error: 'Too many contact form submissions from this IP. Please try again in 15 minutes.',
		type: 'rate_limit_exceeded',
		retryAfter: 15 * 60 // seconds
	},
	standardHeaders: true,
	legacyHeaders: false,
	// FIXED: Add proper trust proxy configuration
	trustProxy: process.env.NODE_ENV === 'production' ? 1 : false, // Trust first proxy in production
	keyGenerator: (req, res) => {
		// Use X-Forwarded-For in production with proper validation
		if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
			const forwarded = req.headers['x-forwarded-for'].split(',')[0].trim();
			logger.debug('Using forwarded IP', { forwarded, originalIP: req.ip });
			return forwarded;
		}
		return req.ip;
	},
	skip: (req) => {
		// Skip rate limiting for certain IPs (optional)
		const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
		return trustedIPs.includes(req.ip);
	},
	handler: (req, res) => {
		logger.warn('Rate limit exceeded for contact form', {
			ip: req.ip,
			forwarded: req.headers['x-forwarded-for'],
			userAgent: req.get('User-Agent'),
			timestamp: new Date().toISOString()
		});

		res.status(429).json({
			error: 'Too many contact form submissions from this IP. Please try again in 15 minutes.',
			type: 'rate_limit_exceeded',
			retryAfter: 15 * 60
		});
	}
});

/**
 * General API rate limiter with proper trust proxy
 */
const generalRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100,
	message: {
		error: 'Too many requests from this IP, please try again later.',
		type: 'rate_limit_exceeded'
	},
	standardHeaders: true,
	legacyHeaders: false,
	trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
	keyGenerator: (req, res) => {
		if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
			return req.headers['x-forwarded-for'].split(',')[0].trim();
		}
		return req.ip;
	},
	handler: (req, res) => {
		logger.warn('General rate limit exceeded', {
			ip: req.ip,
			forwarded: req.headers['x-forwarded-for'],
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
 * Authentication rate limiter with proper trust proxy
 */
const authRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10,
	message: {
		error: 'Too many authentication attempts. Please try again in 15 minutes.',
		type: 'auth_rate_limit_exceeded'
	},
	standardHeaders: true,
	legacyHeaders: false,
	trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
	keyGenerator: (req, res) => {
		if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
			return req.headers['x-forwarded-for'].split(',')[0].trim();
		}
		return req.ip;
	},
	handler: (req, res) => {
		logger.warn('Authentication rate limit exceeded', {
			ip: req.ip,
			forwarded: req.headers['x-forwarded-for'],
			userAgent: req.get('User-Agent'),
			path: req.path
		});

		res.status(429).json({
			error: 'Too many authentication attempts. Please try again in 15 minutes.',
			type: 'auth_rate_limit_exceeded'
		});
	}
});

// Custom spam detection remains the same
const spamDetectionMiddleware = async (req, res, next) => {
	try {
		const { name, email, message, company } = req.body;

		const suspiciousPatterns = [
			(text) => (text.match(/https?:\/\/[^\s]+/g) || []).length > 2,
			(text) => /\b(SEO|backlinks?|viagra|casino|lottery|crypto|bitcoin)\b/i.test(text),
			(text) => text.length > 20 && (text.match(/[A-Z]/g) || []).length / text.length > 0.7,
			(text) => /(.)\1{4,}/.test(text),
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

		suspiciousPatterns.slice(0, -1).forEach(pattern => {
			if (pattern(fullText)) suspicionScore++;
		});

		if (suspiciousPatterns[suspiciousPatterns.length - 1](email, company)) {
			suspicionScore++;
		}

		if (message && message.length < 20) suspicionScore++;
		if (name && name.length < 2) suspicionScore++;

		const disposableDomains = [
			'tempmail.org', '10minutemail.com', 'guerrillamail.com',
			'mailinator.com', 'throwaway.email', 'temp-mail.org'
		];
		const emailDomain = email?.split('@')[1]?.toLowerCase();
		if (emailDomain && disposableDomains.includes(emailDomain)) {
			suspicionScore += 2;
		}

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

			if (suspicionScore >= 4) {
				return res.status(400).json({
					error: 'Your submission appears to be spam. Please contact us directly if this is a legitimate inquiry.',
					type: 'spam_detected'
				});
			}
		}

		req.suspicionScore = suspicionScore;
		next();

	} catch (error) {
		logger.error('Error in spam detection middleware', { error: error.message });
		next();
	}
};

module.exports = {
	contactFormRateLimit,
	spamDetectionMiddleware,
	generalRateLimit,
	authRateLimit
};