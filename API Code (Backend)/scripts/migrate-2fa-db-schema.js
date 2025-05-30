// scripts/migrate-2fa-db-schema.js
const { sequelize } = require('../src/config/database');
const { User } = require('../src/models/User');
const logger = require('../src/utils/logger');

/**
 * Database Migration Script for 2FA
 * This script updates the database schema to support 2FA
 */

async function migrate2FASchema() {
	try {
		logger.info('Starting 2FA database migration...');

		// Connect to the database
		await sequelize.authenticate();
		logger.info('Database connection established');

		// Check if the columns already exist
		const tableInfo = await sequelize.getQueryInterface().describeTable('Users');

		if (tableInfo.twoFactorEnabled && tableInfo.twoFactorSecret) {
			logger.info('2FA columns already exist in the Users table');
			return true;
		}

		// Start a transaction
		const transaction = await sequelize.transaction();

		try {
			// Add twoFactorEnabled column
			if (!tableInfo.twoFactorEnabled) {
				logger.info('Adding twoFactorEnabled column to Users table');
				await sequelize.getQueryInterface().addColumn(
					'Users', // table name
					'twoFactorEnabled', // column name
					{
						type: sequelize.Sequelize.BOOLEAN,
						defaultValue: false,
						allowNull: false
					},
					{ transaction }
				);
			}

			// Add twoFactorSecret column
			if (!tableInfo.twoFactorSecret) {
				logger.info('Adding twoFactorSecret column to Users table');
				await sequelize.getQueryInterface().addColumn(
					'Users', // table name
					'twoFactorSecret', // column name
					{
						type: sequelize.Sequelize.STRING,
						allowNull: true
					},
					{ transaction }
				);
			}

			// Add backupCodes column
			if (!tableInfo.backupCodes) {
				logger.info('Adding backupCodes column to Users table');
				await sequelize.getQueryInterface().addColumn(
					'Users', // table name
					'backupCodes', // column name
					{
						type: sequelize.Sequelize.JSON,
						allowNull: true
					},
					{ transaction }
				);
			}

			// Commit the transaction
			await transaction.commit();

			logger.info('2FA database migration completed successfully');
			console.log('✅ Successfully added 2FA columns to Users table');

			return true;
		} catch (error) {
			// Rollback transaction on error
			await transaction.rollback();
			throw error;
		}
	} catch (error) {
		logger.error('Error in 2FA database migration:', error);
		console.error('❌ Failed to migrate database schema for 2FA:', error.message);
		return false;
	} finally {
		// Close database connection
		await sequelize.close();
	}
}

// Run the migration if executed directly
if (require.main === module) {
	migrate2FASchema()
		.then((success) => {
			if (success) {
				logger.info('2FA database migration script completed successfully');
			} else {
				logger.error('2FA database migration script failed');
			}
			process.exit(success ? 0 : 1);
		})
		.catch((error) => {
			logger.error('Unhandled error during 2FA database migration:', error);
			process.exit(1);
		});
}

module.exports = migrate2FASchema;