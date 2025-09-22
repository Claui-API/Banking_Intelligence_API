// src/utils/formatting.js

/**
 * Format a currency amount
 * @param {number|string} amount - Amount to format
 * @param {string} currency - Currency code (e.g., 'USD')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
	if (amount === null || amount === undefined) return '-';

	// Parse amount to ensure it's a number
	const numAmount = parseFloat(amount);

	// Format with appropriate currency
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(numAmount);
};

/**
 * Format a date string or timestamp
 * @param {string|Date} dateStr - Date to format
 * @param {boolean} includeTime - Whether to include time in the output
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateStr, includeTime = false) => {
	if (!dateStr) return '-';

	try {
		const date = new Date(dateStr);

		if (isNaN(date.getTime())) {
			return '-';
		}

		if (includeTime) {
			return date.toLocaleString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} else {
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		}
	} catch (error) {
		console.error('Error formatting date:', error);
		return '-';
	}
};

/**
 * Format a percentage
 * @param {number|string} value - Percentage value (e.g., 0.25 for 25%)
 * @param {number} decimalPlaces - Number of decimal places to include
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, decimalPlaces = 2) => {
	if (value === null || value === undefined) return '-';

	// Parse value to ensure it's a number
	const numValue = parseFloat(value);

	// Check if the value is already in percentage form (e.g., 25 instead of 0.25)
	const percentage = numValue > 1 && numValue <= 100 ? numValue : numValue * 100;

	return `${percentage.toFixed(decimalPlaces)}%`;
};

/**
 * Format a number with thousands separators
 * @param {number|string} value - Number to format
 * @param {number} decimalPlaces - Number of decimal places to include
 * @returns {string} - Formatted number string
 */
export const formatNumber = (value, decimalPlaces = 0) => {
	if (value === null || value === undefined) return '-';

	// Parse value to ensure it's a number
	const numValue = parseFloat(value);

	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: decimalPlaces,
		maximumFractionDigits: decimalPlaces
	}).format(numValue);
};

/**
 * Truncate text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text with ellipsis if needed
 */
export const truncateText = (text, maxLength = 50) => {
	if (!text) return '';

	if (text.length <= maxLength) return text;

	return `${text.substring(0, maxLength)}...`;
};

export default {
	formatCurrency,
	formatDate,
	formatPercentage,
	formatNumber,
	truncateText
};