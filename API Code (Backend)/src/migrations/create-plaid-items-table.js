// src/migrations/create-plaid-items-table.js
const { sequelize } = require('../config/database');
const PlaidItem = require('../models/PlaidItem');
const logger = require('../utils/logger');

async function createPlaidItemsTable() {
	try {
		logger.info('Creating PlaidItem table...');

		// Sync the model with the database
		await PlaidItem.sync({ alter: true });

		logger.info('PlaidItem table created successfully.');
	} catch (error) {
		logger.error('Error creating PlaidItem table:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	createPlaidItemsTable()
		.then(() => {
			logger.info('PlaidItem table creation completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('PlaidItem table creation failed:', error);
			process.exit(1);
		});
}

module.exports = createPlaidItemsTable;