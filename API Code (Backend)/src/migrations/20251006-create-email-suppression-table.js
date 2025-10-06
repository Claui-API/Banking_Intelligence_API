// src/migrations/fix-email-suppression-table.js
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Script to fix the EmailSuppression table by dropping and recreating it properly
 */
async function fixEmailSuppressionTable() {
	try {
		logger.info('Fixing EmailSuppression table...');

		const queryInterface = sequelize.getQueryInterface();

		// First, check if table exists and drop it
		try {
			await queryInterface.describeTable('email_suppressions');
			logger.info('Table exists, dropping it...');
			await queryInterface.dropTable('email_suppressions');
		} catch (error) {
			logger.info('Table does not exist or already dropped');
		}

		// Drop the ENUM types if they exist
		try {
			await sequelize.query('DROP TYPE IF EXISTS "enum_email_suppressions_reason" CASCADE;');
			await sequelize.query('DROP TYPE IF EXISTS "enum_email_suppressions_source" CASCADE;');
			logger.info('Dropped existing ENUM types');
		} catch (error) {
			logger.info('ENUM types did not exist or already dropped');
		}

		// Create ENUM types
		await sequelize.query(`
			CREATE TYPE "enum_email_suppressions_reason" AS ENUM ('bounce', 'complaint', 'unsubscribe', 'manual');
		`);

		await sequelize.query(`
			CREATE TYPE "enum_email_suppressions_source" AS ENUM ('ses', 'manual', 'user', 'system');
		`);

		logger.info('Created ENUM types');

		// Create the table with all columns
		await queryInterface.createTable('email_suppressions', {
			id: {
				type: sequelize.Sequelize.UUID,
				defaultValue: sequelize.Sequelize.UUIDV4,
				primaryKey: true
			},
			email: {
				type: sequelize.Sequelize.STRING(255),
				allowNull: false
			},
			reason: {
				type: sequelize.Sequelize.ENUM('bounce', 'complaint', 'unsubscribe', 'manual'),
				allowNull: false
			},
			source: {
				type: sequelize.Sequelize.ENUM('ses', 'manual', 'user', 'system'),
				allowNull: false,
				defaultValue: 'manual'
			},
			isActive: {
				type: sequelize.Sequelize.BOOLEAN,
				defaultValue: true,
				allowNull: false
			},
			metadata: {
				type: sequelize.Sequelize.JSONB,
				defaultValue: {}
			},
			createdAt: {
				type: sequelize.Sequelize.DATE,
				allowNull: false,
				defaultValue: sequelize.Sequelize.NOW
			},
			updatedAt: {
				type: sequelize.Sequelize.DATE,
				allowNull: false,
				defaultValue: sequelize.Sequelize.NOW
			}
		});

		logger.info('Created email_suppressions table');

		// Add comments to columns
		await sequelize.query(`
			COMMENT ON COLUMN email_suppressions.email IS 'Email address to suppress (stored in lowercase)';
		`);
		await sequelize.query(`
			COMMENT ON COLUMN email_suppressions.reason IS 'Reason for suppression: bounce, complaint, unsubscribe, manual';
		`);
		await sequelize.query(`
			COMMENT ON COLUMN email_suppressions.source IS 'Source of suppression: ses (AWS), manual (admin), user (self), system (automated)';
		`);
		await sequelize.query(`
			COMMENT ON COLUMN email_suppressions."isActive" IS 'Whether the suppression is currently active';
		`);
		await sequelize.query(`
			COMMENT ON COLUMN email_suppressions.metadata IS 'Additional metadata about the suppression (bounce details, complaint info, etc.)';
		`);

		// Create indexes
		await queryInterface.addIndex('email_suppressions', ['email', 'isActive'], {
			name: 'idx_email_suppressions_email_active'
		});

		await queryInterface.addIndex('email_suppressions', ['reason'], {
			name: 'idx_email_suppressions_reason'
		});

		await queryInterface.addIndex('email_suppressions', ['source'], {
			name: 'idx_email_suppressions_source'
		});

		await queryInterface.addIndex('email_suppressions', ['createdAt'], {
			name: 'idx_email_suppressions_created_at'
		});

		logger.info('Created indexes for email_suppressions table');

		// Test the table by checking its structure
		const tableDescription = await queryInterface.describeTable('email_suppressions');
		logger.info('Table structure verified:', Object.keys(tableDescription));

		logger.info('EmailSuppression table fixed successfully');
		return true;
	} catch (error) {
		logger.error('Error fixing EmailSuppression table:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	fixEmailSuppressionTable()
		.then(() => {
			logger.info('EmailSuppression table fix completed successfully');
			process.exit(0);
		})
		.catch(error => {
			logger.error('EmailSuppression table fix failed:', error);
			process.exit(1);
		});
}

module.exports = fixEmailSuppressionTable;