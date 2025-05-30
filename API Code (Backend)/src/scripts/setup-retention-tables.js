// src/scripts/setup-retention-tables.js - Fixed version
/**
 * Script to set up all tables required for data retention policy
 */
require('dotenv').config();
const logger = require('../utils/logger');
const createRetentionLogTable = require('../migrations/create-retention-log-table');
const createAdminLogTable = require('../migrations/create-admin-log-table');
const { sequelize } = require('../config/database');
const { User } = require('../models/User');
const dataRetentionService = require('../services/data-retention.service');

/**
 * Update user model with data retention fields
 */
async function updateUserModel() {
	try {
		logger.info('Adding data retention fields to User model...');

		// Check if the fields already exist by checking the database structure
		// instead of trying to query with the fields directly
		const userTableInfo = await sequelize.getQueryInterface().describeTable('Users');

		// Only add fields if they don't already exist
		if (!userTableInfo.markedForDeletionAt) {
			logger.info('Adding markedForDeletionAt field to Users table');
			await sequelize.queryInterface.addColumn('Users', 'markedForDeletionAt', {
				type: sequelize.Sequelize.DATE,
				allowNull: true
			});
		} else {
			logger.info('markedForDeletionAt field already exists');
		}

		if (!userTableInfo.inactivityWarningDate) {
			logger.info('Adding inactivityWarningDate field to Users table');
			await sequelize.queryInterface.addColumn('Users', 'inactivityWarningDate', {
				type: sequelize.Sequelize.DATE,
				allowNull: true
			});
		} else {
			logger.info('inactivityWarningDate field already exists');
		}

		if (!userTableInfo.deletionReason) {
			logger.info('Adding deletionReason field to Users table');
			await sequelize.queryInterface.addColumn('Users', 'deletionReason', {
				type: sequelize.Sequelize.STRING,
				allowNull: true
			});
		} else {
			logger.info('deletionReason field already exists');
		}

		if (!userTableInfo.dataRetentionPreferences) {
			logger.info('Adding dataRetentionPreferences field to Users table');
			await sequelize.queryInterface.addColumn('Users', 'dataRetentionPreferences', {
				type: sequelize.Sequelize.JSON,
				allowNull: true,
				defaultValue: {
					transactionRetentionDays: 730, // 24 months
					insightRetentionDays: 365, // 12 months
					emailNotifications: true,
					analyticalDataUse: true
				}
			});
		} else {
			logger.info('dataRetentionPreferences field already exists');
		}

		logger.info('User model updated with data retention fields');
		return true;
	} catch (error) {
		logger.error('Error updating User model:', error);
		throw error;
	}
}

/**
 * Update PlaidItem model with disconnection fields
 */
async function updatePlaidItemModel() {
	try {
		// Check if PlaidItem table exists
		try {
			await sequelize.getQueryInterface().describeTable('PlaidItems');
		} catch (err) {
			logger.info('PlaidItem table not found, skipping update');
			return false;
		}

		logger.info('Adding disconnection fields to PlaidItem model...');

		// Check if the fields already exist
		const plaidTableInfo = await sequelize.getQueryInterface().describeTable('PlaidItems');

		// Only add the field if it doesn't already exist
		if (!plaidTableInfo.disconnectedAt) {
			logger.info('Adding disconnectedAt field to PlaidItems table');
			await sequelize.queryInterface.addColumn('PlaidItems', 'disconnectedAt', {
				type: sequelize.Sequelize.DATE,
				allowNull: true
			});
		} else {
			logger.info('disconnectedAt field already exists');
		}

		// Add deletionScheduledAt field if it doesn't exist
		if (!plaidTableInfo.deletionScheduledAt) {
			logger.info('Adding deletionScheduledAt field to PlaidItems table');
			await sequelize.queryInterface.addColumn('PlaidItems', 'deletionScheduledAt', {
				type: sequelize.Sequelize.DATE,
				allowNull: true
			});
		} else {
			logger.info('deletionScheduledAt field already exists');
		}

		logger.info('PlaidItem model updated with disconnection fields');
		return true;
	} catch (error) {
		logger.error('Error updating PlaidItem model:', error);
		throw error;
	}
}

/**
 * Main setup function
 */
async function setupRetentionTables() {
	try {
		logger.info('Starting setup of data retention tables...');

		// Create retention log table
		await createRetentionLogTable();

		// Create admin log table
		await createAdminLogTable();

		// Update User model
		await updateUserModel();

		// Update PlaidItem model
		await updatePlaidItemModel();

		// Initialize data retention service
		// Only initialize if all prior steps succeeded
		try {
			await dataRetentionService.initialize();
			logger.info('Data retention service initialized successfully');
		} catch (serviceError) {
			logger.warn('Could not initialize data retention service:', serviceError.message);
			logger.info('You may need to restart your server to fully apply the data retention service');
		}

		logger.info('Data retention tables setup completed successfully');

		return true;
	} catch (error) {
		logger.error('Error setting up retention tables:', error);
		throw error;
	} finally {
		// Close the database connection
		await sequelize.close();
	}
}

// Run the setup if called directly
if (require.main === module) {
	setupRetentionTables()
		.then(success => {
			if (success) {
				logger.info('Data retention policy setup completed');
				process.exit(0);
			} else {
				logger.error('Data retention policy setup failed');
				process.exit(1);
			}
		})
		.catch(error => {
			logger.error('Unhandled error during setup:', error);
			process.exit(1);
		});
}

module.exports = setupRetentionTables;