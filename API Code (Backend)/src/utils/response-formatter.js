// src/utils/response-formatter.js
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

module.exports = {
	formatResponse,
	formatError
};