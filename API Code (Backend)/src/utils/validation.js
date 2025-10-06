// src/utils/validation.js
const validator = require('validator');
const xss = require('xss');

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const validateEmail = (email) => {
	if (!email || typeof email !== 'string') {
		return false;
	}

	// Basic format check
	if (!validator.isEmail(email)) {
		return false;
	}

	// Additional checks
	if (email.length > 255) {
		return false;
	}

	// Check for common disposable email domains (optional)
	const disposableDomains = [
		'10minutemail.com',
		'tempmail.org',
		'guerrillamail.com',
		'mailinator.com'
	];

	const domain = email.split('@')[1]?.toLowerCase();
	if (disposableDomains.includes(domain)) {
		return false;
	}

	return true;
};

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - Input to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized input
 */
const sanitizeInput = (input, maxLength = 1000) => {
	if (!input || typeof input !== 'string') {
		return '';
	}

	// Trim whitespace
	let sanitized = input.trim();

	// Limit length
	if (maxLength && sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	// Remove XSS attempts
	sanitized = xss(sanitized, {
		whiteList: {}, // No HTML tags allowed
		stripIgnoreTag: true,
		stripIgnoreTagBody: ['script']
	});

	return sanitized;
};

/**
 * Validate contact form data
 * @param {Object} formData - Form data to validate
 * @returns {Object} - Validation result with errors array
 */
const validateContactForm = (formData) => {
	const errors = [];
	const { name, email, company, message } = formData;

	// Name validation
	if (!name || name.trim().length === 0) {
		errors.push('Name is required');
	} else if (name.trim().length > 100) {
		errors.push('Name must be less than 100 characters');
	} else if (!/^[a-zA-Z\s\-'\.]+$/.test(name.trim())) {
		errors.push('Name contains invalid characters');
	}

	// Email validation
	if (!email || email.trim().length === 0) {
		errors.push('Email is required');
	} else if (!validateEmail(email.trim())) {
		errors.push('Please enter a valid email address');
	}

	// Company validation (optional field)
	if (company && company.trim().length > 100) {
		errors.push('Company name must be less than 100 characters');
	} else if (company && !/^[a-zA-Z0-9\s\-'\.&,]*$/.test(company.trim())) {
		errors.push('Company name contains invalid characters');
	}

	// Message validation
	if (!message || message.trim().length === 0) {
		errors.push('Message is required');
	} else if (message.trim().length < 10) {
		errors.push('Message must be at least 10 characters long');
	} else if (message.trim().length > 2000) {
		errors.push('Message must be less than 2000 characters');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
};

/**
 * Validate and sanitize contact form data
 * @param {Object} formData - Raw form data
 * @returns {Object} - Validation result and sanitized data
 */
const processContactFormData = (formData) => {
	const validation = validateContactForm(formData);

	if (!validation.isValid) {
		return {
			...validation,
			sanitizedData: null
		};
	}

	const sanitizedData = {
		name: sanitizeInput(formData.name.trim(), 100),
		email: formData.email.trim().toLowerCase(),
		company: formData.company ? sanitizeInput(formData.company.trim(), 100) : '',
		message: sanitizeInput(formData.message.trim(), 2000)
	};

	return {
		...validation,
		sanitizedData
	};
};

/**
 * Check if string contains potential spam indicators
 * @param {string} text - Text to check
 * @returns {boolean} - Whether text appears to be spam
 */
const isLikelySpam = (text) => {
	if (!text || typeof text !== 'string') {
		return false;
	}

	const spamIndicators = [
		/\b(viagra|cialis|casino|lottery|winner|congratulations)\b/i,
		/\$\d+.*\b(million|thousand|dollars|USD|earn|make money)\b/i,
		/\b(click here|act now|limited time|urgent|guarantee)\b/i,
		/\b(free|100%|risk-free|no obligation|instant)\b.*\b(money|cash|income)\b/i
	];

	return spamIndicators.some(pattern => pattern.test(text));
};

/**
 * Rate limiting helper - check if IP has exceeded limits
 * @param {string} ip - IP address
 * @param {Object} cache - Memory cache or Redis client
 * @param {number} limit - Request limit
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} - Rate limit status
 */
const checkRateLimit = async (ip, cache, limit = 5, windowMs = 15 * 60 * 1000) => {
	const key = `rate_limit:${ip}`;
	const now = Date.now();

	// Get existing requests
	let requests = [];
	try {
		const cached = await cache.get(key);
		if (cached) {
			requests = JSON.parse(cached);
		}
	} catch (error) {
		// If cache fails, allow the request
		return { allowed: true, remaining: limit };
	}

	// Filter out old requests
	requests = requests.filter(timestamp => now - timestamp < windowMs);

	// Check if limit exceeded
	if (requests.length >= limit) {
		return {
			allowed: false,
			remaining: 0,
			resetTime: new Date(requests[0] + windowMs)
		};
	}

	// Add current request
	requests.push(now);

	// Save to cache
	try {
		await cache.set(key, JSON.stringify(requests), 'PX', windowMs);
	} catch (error) {
		// If cache fails, still allow the request
	}

	return {
		allowed: true,
		remaining: limit - requests.length
	};
};

module.exports = {
	validateEmail,
	sanitizeInput,
	validateContactForm,
	processContactFormData,
	isLikelySpam,
	checkRateLimit
};