// src/migrations/create-admin-log-table.js
const { sequelize } = require('../config/database');
const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

/**
 * Migration script to create the AdminLog table
 */
async function createAdminLogTable() {
	try {
		logger.info('Creating AdminLog table...');

		// Sync the model with the database
		const syncOptions = {
			alter: process.env.NODE_ENV !== 'production'
		};

		await AdminLog.sync(syncOptions);

		logger.info('AdminLog table created successfully');
	} catch (error) {
		logger.error('Error creating AdminLog table:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	createAdminLogTable()
		.then(() => {
			logger.info('AdminLog table migration completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('AdminLog table migration failed:', error);
			process.exit(1);
		});
}

module.exports = createAdminLogTable;