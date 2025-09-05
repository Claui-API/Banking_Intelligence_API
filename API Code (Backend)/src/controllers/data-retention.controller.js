// src/controllers/data-retention.controller.js
const { Op } = require('sequelize'); // Import Op explicitly
const dataRetentionService = require('../services/data-retention.service');
const logger = require('../utils/logger');
const { User } = require('../models/User');
const { sequelize } = require('../config/database');

/**
 * Controller for handling user data retention requests
 */
class DataRetentionController {
	/**
	 * Get user's data retention settings
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getRetentionSettings(req, res) {
		try {
			const { userId } = req.auth;

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Fetch user from database to get retention preferences
			const user = await User.findByPk(userId);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Get data retention preferences from user model
			// If not set, use default values
			const defaultSettings = {
				transactionRetentionDays: 730, // 24 months
				insightRetentionDays: 365, // 12 months
				emailNotifications: true,
				analyticalDataUse: true
			};

			const retentionSettings = user.dataRetentionPreferences || defaultSettings;

			// Check if account is marked for deletion
			const accountStatus = {
				isMarkedForDeletion: user.markedForDeletionAt !== null,
				markedForDeletionAt: user.markedForDeletionAt,
				status: user.status
			};

			// Calculate scheduled deletion date if marked for deletion
			if (accountStatus.isMarkedForDeletion) {
				const deletionDate = new Date(user.markedForDeletionAt);
				deletionDate.setDate(deletionDate.getDate() +
					dataRetentionService.retentionRules.inactivity.deletionPeriod);

				accountStatus.scheduledDeletionDate = deletionDate;
			}

			logger.info(`Retrieved retention settings for user ${userId}`);

			return res.status(200).json({
				success: true,
				data: {
					settings: retentionSettings,
					accountStatus
				}
			});
		} catch (error) {
			logger.error('Error retrieving retention settings:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve retention settings',
				error: error.message
			});
		}
	}

	/**
	 * Update user's data retention settings
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async updateRetentionSettings(req, res) {
		try {
			const { userId } = req.auth;
			const {
				transactionRetentionDays,
				insightRetentionDays,
				emailNotifications,
				analyticalDataUse
			} = req.body;

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			// Fetch user from database
			const user = await User.findByPk(userId);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found'
				});
			}

			// Get current settings or initialize defaults
			const currentSettings = user.dataRetentionPreferences || {
				transactionRetentionDays: 730,
				insightRetentionDays: 365,
				emailNotifications: true,
				analyticalDataUse: true
			};

			// Update settings with new values if provided
			const updatedSettings = {
				...currentSettings,
				...(transactionRetentionDays !== undefined && {
					transactionRetentionDays: Number(transactionRetentionDays)
				}),
				...(insightRetentionDays !== undefined && {
					insightRetentionDays: Number(insightRetentionDays)
				}),
				...(emailNotifications !== undefined && {
					emailNotifications: Boolean(emailNotifications)
				}),
				...(analyticalDataUse !== undefined && {
					analyticalDataUse: Boolean(analyticalDataUse)
				})
			};

			// Save updated settings to user model
			user.dataRetentionPreferences = updatedSettings;
			await user.save();

			// Log this update
			await dataRetentionService.createRetentionLog('retention_settings_updated', {
				userId,
				settings: updatedSettings
			});

			logger.info(`Updated retention settings for user ${userId}`);

			return res.status(200).json({
				success: true,
				message: 'Data retention settings updated successfully',
				data: updatedSettings
			});
		} catch (error) {
			logger.error('Error updating retention settings:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to update retention settings',
				error: error.message
			});
		}
	}

	/**
	 * Export user's data for data portability
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async exportUserData(req, res) {
		try {
			const { userId } = req.auth;
			const format = req.query.format ? req.query.format.toLowerCase() : 'json';

			// Validate user is authenticated
			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
				});
			}

			logger.info(`Processing data export request for user ${userId} in ${format} format`);

			// Use the existing service method to get the export data
			const exportData = await dataRetentionService.exportUserData(userId);

			// Handle different export formats
			if (format === 'pdf') {
				try {
					// Load the PDF generator (using dynamic import to avoid loading if not needed)
					const { generatePDF } = require('../utils/pdf-generator');

					// Generate PDF
					const pdfBuffer = await generatePDF(exportData);

					// Set headers for PDF download
					res.setHeader('Content-Type', 'application/pdf');
					res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.pdf`);

					// Send the PDF
					return res.send(pdfBuffer);
				} catch (pdfError) {
					logger.error(`Error generating PDF for user ${userId}:`, pdfError);

					// Fall back to JSON if PDF generation fails
					logger.info('Falling back to JSON format due to PDF generation error');

					res.setHeader('Content-Type', 'application/json');
					res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.json`);

					return res.status(200).json(exportData);
				}
			} else {
				// Default to JSON format
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('Content-Disposition', `attachment; filename=financial-data-export-${new Date().toISOString().split('T')[0]}.json`);

				return res.status(200).json(exportData);
			}
		} catch (error) {
			logger.error(`Error exporting data for user ${req.auth?.userId}:`, error);

			return res.status(500).json({
				success: false,
				message: 'Failed to export user data',
				error: error.message
			});
		}
	}

	/**
	 * For admin: view retention logs
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	async getRetentionLogs(req, res) {
		try {
			// Verify admin authorization
			if (!req.auth || req.auth.role !== 'admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Admin access required'
				});
			}

			// Parse query parameters
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const action = req.query.action || null;
			const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
			const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

			// Validate date range if provided
			if (startDate && endDate && startDate > endDate) {
				return res.status(400).json({
					success: false,
					message: 'Invalid date range: start date must be before end date'
				});
			}

			// Build query filters
			const filters = {};

			if (action) {
				filters.action = action;
			}

			if (startDate && endDate) {
				filters.timestamp = {
					[Op.between]: [startDate, endDate] // Using imported Op
				};
			} else if (startDate) {
				filters.timestamp = {
					[Op.gte]: startDate // Using imported Op
				};
			} else if (endDate) {
				filters.timestamp = {
					[Op.lte]: endDate // Using imported Op
				};
			}

			// Check if RetentionLog model exists
			if (!sequelize.models.RetentionLog) {
				return res.status(404).json({
					success: false,
					message: 'Retention logging is not configured in this environment'
				});
			}

			// Fetch logs
			const { count, rows } = await sequelize.models.RetentionLog.findAndCountAll({
				where: filters,
				limit,
				offset: (page - 1) * limit,
				order: [['timestamp', 'DESC']]
			});

			// Return logs with pagination info
			return res.status(200).json({
				success: true,
				data: {
					logs: rows,
					pagination: {
						total: count,
						page,
						limit,
						totalPages: Math.ceil(count / limit)
					}
				}
			});
		} catch (error) {
			logger.error('Error retrieving retention logs:', error);

			return res.status(500).json({
				success: false,
				message: 'Failed to retrieve retention logs',
				error: error.message
			});
		}
	}
}

// Export singleton instance
module.exports = new DataRetentionController();