// src/migrations/create-retention-log-table.js
const { sequelize } = require('../config/database');
const RetentionLog = require('../models/RetentionLog');
const logger = require('../utils/logger');

/**
 * Migration script to create the RetentionLog table
 */
async function createRetentionLogTable() {
	try {
		logger.info('Creating RetentionLog table...');

		// Sync the model with the database
		// Use force: true only in development to drop the table if it exists
		const syncOptions = {
			alter: process.env.NODE_ENV !== 'production'
		};

		await RetentionLog.sync(syncOptions);

		logger.info('RetentionLog table created successfully');
	} catch (error) {
		logger.error('Error creating RetentionLog table:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	createRetentionLogTable()
		.then(() => {
			logger.info('RetentionLog table migration completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('RetentionLog table migration failed:', error);
			process.exit(1);
		});
}

module.exports = createRetentionLogTable;