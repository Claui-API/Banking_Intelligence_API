'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// First, add new fields to the Client model
		await queryInterface.addColumn('Clients', 'lastNotifiedThreshold', {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false
		});

		await queryInterface.addColumn('Clients', 'lastResetDate', {
			type: Sequelize.DATE,
			allowNull: true
		});

		await queryInterface.addColumn('Clients', 'statusReason', {
			type: Sequelize.TEXT,
			allowNull: true
		});

		await queryInterface.addColumn('Clients', 'statusChangedAt', {
			type: Sequelize.DATE,
			allowNull: true
		});

		await queryInterface.addColumn('Clients', 'statusChangedBy', {
			type: Sequelize.UUID,
			allowNull: true,
			references: {
				model: 'Users',
				key: 'id'
			}
		});

		await queryInterface.addColumn('Clients', 'quotaChangedAt', {
			type: Sequelize.DATE,
			allowNull: true
		});

		await queryInterface.addColumn('Clients', 'quotaChangedBy', {
			type: Sequelize.UUID,
			allowNull: true,
			references: {
				model: 'Users',
				key: 'id'
			}
		});

		// Now create the NotificationPreferences table
		await queryInterface.createTable('NotificationPreferences', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true
			},
			userId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'Users',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			// Email notification preferences
			emailRegistration: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailAccountApproval: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailAccountStatus: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailApiUsage: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailApiQuotaExceeded: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailMonthlySummary: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			emailSecurityAlerts: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			// Push notification preferences
			pushAccountApproval: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			pushAccountStatus: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			pushApiUsage: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			pushApiQuotaExceeded: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			pushSecurityAlerts: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			}
		});

		// Add index for faster lookups
		await queryInterface.addIndex('NotificationPreferences', ['userId'], {
			unique: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		// Drop the NotificationPreferences table
		await queryInterface.dropTable('NotificationPreferences');

		// Remove columns from Clients table
		await queryInterface.removeColumn('Clients', 'lastNotifiedThreshold');
		await queryInterface.removeColumn('Clients', 'lastResetDate');
		await queryInterface.removeColumn('Clients', 'statusReason');
		await queryInterface.removeColumn('Clients', 'statusChangedAt');
		await queryInterface.removeColumn('Clients', 'statusChangedBy');
		await queryInterface.removeColumn('Clients', 'quotaChangedAt');
		await queryInterface.removeColumn('Clients', 'quotaChangedBy');
	}
};