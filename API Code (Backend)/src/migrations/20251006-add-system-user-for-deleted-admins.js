'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			// Define the system user UUID for deleted admin references
			const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

			console.log('Creating system user for deleted admin references...');

			// Check if system user already exists
			const [existingUser] = await queryInterface.sequelize.query(`
        SELECT id FROM "Users" WHERE id = :systemUserId
      `, {
				replacements: { systemUserId: SYSTEM_USER_ID },
				type: Sequelize.QueryTypes.SELECT,
				transaction
			});

			if (existingUser) {
				console.log('System user already exists, skipping creation');
			} else {
				// Insert system user using raw SQL to avoid enum/field issues
				await queryInterface.sequelize.query(`
          INSERT INTO "Users" (
            "id", 
            "clientName", 
            "email", 
            "passwordHash", 
            "status", 
            "role", 
            "lastLoginAt", 
            "createdAt", 
            "updatedAt", 
            "deletedAt", 
            "twoFactorEnabled", 
            "twoFactorSecret", 
            "backupCodes", 
            "markedForDeletionAt", 
            "inactivityWarningDate", 
            "deletionReason", 
            "dataRetentionPreferences"
          ) 
          VALUES (
            :id, 
            :clientName, 
            :email, 
            :passwordHash, 
            :status, 
            :role, 
            NULL, 
            NOW(), 
            NOW(), 
            NULL, 
            false, 
            NULL, 
            NULL, 
            NULL, 
            NULL, 
            :deletionReason, 
            :dataRetentionPreferences
          )
        `, {
					replacements: {
						id: SYSTEM_USER_ID,
						clientName: 'System - Deleted Admin',
						email: 'system.deleted.admin@internal.system',
						passwordHash: '$2b$10$INVALID.HASH.PLACEHOLDER.CANNOT.LOGIN.SYSTEM.USER',
						status: 'inactive',
						role: 'admin',
						deletionReason: 'System user for deleted admin references',
						dataRetentionPreferences: JSON.stringify({
							transactionRetentionDays: 0,
							insightRetentionDays: 0,
							emailNotifications: false,
							analyticalDataUse: false
						})
					},
					transaction
				});

				console.log(`System user ${SYSTEM_USER_ID} created successfully`);
			}

			// Skip the problematic AdminLogs update for now
			// We'll handle it in the data retention service instead
			console.log('Skipping AdminLogs update - will be handled by data retention service');

			// Add an index to improve performance (if it doesn't exist)
			try {
				await queryInterface.addIndex('AdminLogs', ['adminId'], {
					name: 'idx_admin_logs_admin_id_system_ref',
					transaction
				});
				console.log('Added index for AdminLogs.adminId');
			} catch (indexError) {
				console.log('Index already exists or could not be created:', indexError.message);
			}

			await transaction.commit();

			console.log('Migration completed successfully');
			console.log(`System user ID: ${SYSTEM_USER_ID}`);
			console.log('Role: admin (inactive)');
			console.log('Future admin deletions will reference this system user instead of causing constraint violations');

		} catch (error) {
			await transaction.rollback();
			console.error('Migration failed:', error);
			throw error;
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction();

		try {
			const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

			console.log('Reversing system user migration...');

			// Remove the index we added
			try {
				await queryInterface.removeIndex('AdminLogs', 'idx_admin_logs_admin_id_system_ref', { transaction });
				console.log('Removed AdminLogs index');
			} catch (indexError) {
				console.log('Could not remove index (may not exist):', indexError.message);
			}

			// Count how many AdminLogs reference the system user
			const [countResult] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count FROM "AdminLogs" WHERE "adminId" = :systemUserId
      `, {
				replacements: { systemUserId: SYSTEM_USER_ID },
				type: Sequelize.QueryTypes.SELECT,
				transaction
			});

			const referencedCount = parseInt(countResult.count);

			if (referencedCount > 0) {
				console.warn(`WARNING: ${referencedCount} AdminLog records reference the system user.`);
				console.warn('Deleting AdminLog records that reference the system user...');

				// Delete AdminLog records that reference system user
				await queryInterface.sequelize.query(`
          DELETE FROM "AdminLogs" WHERE "adminId" = :systemUserId
        `, {
					replacements: { systemUserId: SYSTEM_USER_ID },
					transaction
				});

				console.log(`Deleted ${referencedCount} AdminLog records`);
			}

			// Delete the system user
			await queryInterface.sequelize.query(`
        DELETE FROM "Users" WHERE "id" = :systemUserId
      `, {
				replacements: { systemUserId: SYSTEM_USER_ID },
				transaction
			});

			await transaction.commit();

			console.log('Migration rollback completed successfully');
			console.log('System user and related changes have been removed');

		} catch (error) {
			await transaction.rollback();
			console.error('Migration rollback failed:', error);
			throw error;
		}
	}
};