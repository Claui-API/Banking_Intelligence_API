'use strict';

const logger = require('../utils/logger');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			logger.info('Creating EmailSuppression table...');

			// Clean up any existing table/types
			await queryInterface.sequelize.query('DROP TABLE IF EXISTS "email_suppressions" CASCADE;', { transaction });
			await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_email_suppressions_reason" CASCADE;', { transaction });
			await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_email_suppressions_source" CASCADE;', { transaction });

			// Create the table - let Sequelize handle ENUM creation
			await queryInterface.createTable('email_suppressions', {
				id: {
					type: Sequelize.UUID,
					defaultValue: Sequelize.UUIDV4,
					primaryKey: true
				},
				email: {
					type: Sequelize.STRING(255),
					allowNull: false
				},
				reason: {
					type: Sequelize.ENUM('bounce', 'complaint', 'unsubscribe', 'manual'),
					allowNull: false
				},
				source: {
					type: Sequelize.ENUM('ses', 'manual', 'user', 'system'),
					allowNull: false,
					defaultValue: 'manual'
				},
				isActive: {
					type: Sequelize.BOOLEAN,
					defaultValue: true,
					allowNull: false
				},
				metadata: {
					type: Sequelize.JSONB,
					defaultValue: {}
				},
				createdAt: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW
				},
				updatedAt: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW
				}
			}, { transaction });

			// Don't create indexes here - let the model handle them
			// The model's index definitions will be applied when the model is loaded

			await transaction.commit();
			logger.info('EmailSuppression table created successfully');

		} catch (error) {
			await transaction.rollback();
			logger.error('Error creating EmailSuppression table:', error);
			throw error;
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			await queryInterface.dropTable('email_suppressions', { transaction });
			await transaction.commit();
			logger.info('EmailSuppression table dropped successfully');

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}
};