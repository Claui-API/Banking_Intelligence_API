// migrations/20251006220000-fix-json-columns-for-retention.js
'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			console.log('Starting JSON column type fixes for data retention...');

			// Check if we're using PostgreSQL
			const dialect = queryInterface.sequelize.getDialect();

			if (dialect === 'postgres') {
				console.log('PostgreSQL detected - fixing JSON column types...');

				// Convert JSON columns to JSONB where needed
				const tablesToUpdate = [
					{ table: 'AdminLogs', column: 'details' },
					{ table: 'Users', column: 'dataRetentionPreferences' },
					{ table: 'EmailSuppressions', column: 'metadata' },
					{ table: 'RetentionLogs', column: 'details' }
				];

				for (const { table, column } of tablesToUpdate) {
					try {
						// Check if table exists
						const tableExists = await queryInterface.describeTable(table);

						if (tableExists && tableExists[column]) {
							console.log(`Updating ${table}.${column} to JSONB type...`);

							// Update column type to JSONB
							await queryInterface.changeColumn(table, column, {
								type: Sequelize.JSONB,
								allowNull: true
							}, { transaction });

							console.log(`✓ Updated ${table}.${column} to JSONB`);
						} else {
							console.log(`ℹ Table ${table} or column ${column} not found, skipping...`);
						}
					} catch (error) {
						console.warn(`Warning: Could not update ${table}.${column}:`, error.message);
						// Continue with other tables even if one fails
					}
				}

			} else {
				console.log(`Database dialect is ${dialect} - JSON column fixes not needed`);
			}

			// Create system user for deleted admin references if it doesn't exist
			console.log('Ensuring system user exists for deleted admin references...');

			const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

			// Check if system user already exists
			const [existingSystemUser] = await queryInterface.sequelize.query(
				'SELECT id FROM "Users" WHERE id = :id',
				{
					replacements: { id: SYSTEM_USER_ID },
					type: queryInterface.sequelize.QueryTypes.SELECT,
					transaction
				}
			);

			if (!existingSystemUser) {
				console.log('Creating system user for deleted admin references...');

				// Create system user
				await queryInterface.sequelize.query(`
					INSERT INTO "Users" (
						id, 
						"clientName", 
						email, 
						role, 
						status,
						"passwordHash",
						"createdAt",
						"updatedAt"
					) VALUES (
						:id,
						'[SYSTEM USER]',
						'system@deleted-admins.internal',
						'system',
						'inactive',
						'N/A',
						NOW(),
						NOW()
					)
				`, {
					replacements: { id: SYSTEM_USER_ID },
					transaction
				});

				console.log('✓ System user created successfully');
			} else {
				console.log('ℹ System user already exists');
			}

			// Add data retention fields to Users table if they don't exist
			console.log('Ensuring Users table has data retention fields...');

			const userTableInfo = await queryInterface.describeTable('Users');

			if (!userTableInfo.markedForDeletionAt) {
				await queryInterface.addColumn('Users', 'markedForDeletionAt', {
					type: Sequelize.DATE,
					allowNull: true,
					comment: 'Timestamp when user was marked for deletion'
				}, { transaction });
				console.log('✓ Added markedForDeletionAt to Users table');
			}

			if (!userTableInfo.inactivityWarningDate) {
				await queryInterface.addColumn('Users', 'inactivityWarningDate', {
					type: Sequelize.DATE,
					allowNull: true,
					comment: 'Date when inactivity warning was sent'
				}, { transaction });
				console.log('✓ Added inactivityWarningDate to Users table');
			}

			if (!userTableInfo.deletionReason) {
				await queryInterface.addColumn('Users', 'deletionReason', {
					type: Sequelize.STRING,
					allowNull: true,
					comment: 'Reason for account deletion/marking'
				}, { transaction });
				console.log('✓ Added deletionReason to Users table');
			}

			if (!userTableInfo.dataRetentionPreferences) {
				await queryInterface.addColumn('Users', 'dataRetentionPreferences', {
					type: dialect === 'postgres' ? Sequelize.JSONB : Sequelize.JSON,
					allowNull: true,
					comment: 'User data retention preferences'
				}, { transaction });
				console.log('✓ Added dataRetentionPreferences to Users table');
			}

			await transaction.commit();
			console.log('✅ JSON column migration completed successfully');

		} catch (error) {
			await transaction.rollback();
			console.error('❌ Error during JSON column migration:', error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			console.log('Reverting JSON column type fixes...');

			const dialect = queryInterface.sequelize.getDialect();

			if (dialect === 'postgres') {
				// Convert JSONB columns back to JSON
				const tablesToRevert = [
					{ table: 'AdminLogs', column: 'details' },
					{ table: 'Users', column: 'dataRetentionPreferences' },
					{ table: 'EmailSuppressions', column: 'metadata' },
					{ table: 'RetentionLogs', column: 'details' }
				];

				for (const { table, column } of tablesToRevert) {
					try {
						const tableExists = await queryInterface.describeTable(table);

						if (tableExists && tableExists[column]) {
							await queryInterface.changeColumn(table, column, {
								type: Sequelize.JSON,
								allowNull: true
							}, { transaction });

							console.log(`Reverted ${table}.${column} back to JSON`);
						}
					} catch (error) {
						console.warn(`Could not revert ${table}.${column}:`, error.message);
					}
				}
			}

			// Remove system user
			const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
			await queryInterface.sequelize.query(
				'DELETE FROM "Users" WHERE id = :id',
				{
					replacements: { id: SYSTEM_USER_ID },
					transaction
				}
			);

			await transaction.commit();
			console.log('Migration reverted successfully');

		} catch (error) {
			await transaction.rollback();
			console.error('Error reverting migration:', error);
			throw error;
		}
	}
};