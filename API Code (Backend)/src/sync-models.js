// sync-models.js
require('dotenv').config();
const { sequelize } = require('./config/database');
const { User, Client } = require('./models/User'); // Adjust path if needed
const logger = require('./utils/logger');

// Define the NotificationPreference model here inline to avoid circular dependencies
const { DataTypes } = require('sequelize');

const NotificationPreference = sequelize.define('NotificationPreference', {
	id: {
		type: DataTypes.UUID,
		defaultValue: DataTypes.UUIDV4,
		primaryKey: true
	},
	userId: {
		type: DataTypes.UUID,
		allowNull: false,
		references: {
			model: 'Users',
			key: 'id'
		}
	},
	// Email notification preferences
	emailRegistration: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailAccountApproval: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailAccountStatus: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailApiUsage: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailApiQuotaExceeded: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailMonthlySummary: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	emailSecurityAlerts: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	// Push notification preferences
	pushAccountApproval: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	pushAccountStatus: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	pushApiUsage: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	pushApiQuotaExceeded: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	},
	pushSecurityAlerts: {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	}
}, {
	timestamps: true,
	indexes: [
		{
			unique: true,
			fields: ['userId']
		}
	]
});

// Set up associations
User.hasOne(NotificationPreference, { foreignKey: 'userId' });
NotificationPreference.belongsTo(User, { foreignKey: 'userId' });

// New fields to add to Client model
const clientFields = {
	lastNotifiedThreshold: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
		allowNull: false
	},
	lastResetDate: {
		type: DataTypes.DATE,
		allowNull: true
	},
	statusReason: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	statusChangedAt: {
		type: DataTypes.DATE,
		allowNull: true
	},
	statusChangedBy: {
		type: DataTypes.UUID,
		allowNull: true,
		references: {
			model: 'Users',
			key: 'id'
		}
	},
	quotaChangedAt: {
		type: DataTypes.DATE,
		allowNull: true
	},
	quotaChangedBy: {
		type: DataTypes.UUID,
		allowNull: true,
		references: {
			model: 'Users',
			key: 'id'
		}
	}
};

async function syncModels() {
	try {
		console.log('Adding new fields to Client model...');

		// Add new fields to Client model
		const queryInterface = sequelize.getQueryInterface();

		// Check for each field before adding to avoid errors
		const clientAttrs = await queryInterface.describeTable('Clients');

		for (const [fieldName, fieldDef] of Object.entries(clientFields)) {
			if (!clientAttrs[fieldName]) {
				await queryInterface.addColumn('Clients', fieldName, fieldDef);
				console.log(`Added ${fieldName} to Clients table`);
			} else {
				console.log(`Field ${fieldName} already exists in Clients table`);
			}
		}

		console.log('Creating NotificationPreferences table if it doesn\'t exist...');

		// Create the NotificationPreferences table
		try {
			await queryInterface.createTable('NotificationPreferences', {
				id: {
					type: DataTypes.UUID,
					defaultValue: DataTypes.UUIDV4,
					primaryKey: true
				},
				userId: {
					type: DataTypes.UUID,
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
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailAccountApproval: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailAccountStatus: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailApiUsage: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailApiQuotaExceeded: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailMonthlySummary: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				emailSecurityAlerts: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				// Push notification preferences
				pushAccountApproval: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				pushAccountStatus: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				pushApiUsage: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				pushApiQuotaExceeded: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				pushSecurityAlerts: {
					type: DataTypes.BOOLEAN,
					defaultValue: true
				},
				createdAt: {
					type: DataTypes.DATE,
					allowNull: false,
					defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
				},
				updatedAt: {
					type: DataTypes.DATE,
					allowNull: false,
					defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
				}
			});

			// Add index for userId
			await queryInterface.addIndex('NotificationPreferences', ['userId'], {
				unique: true
			});

			console.log('NotificationPreferences table created successfully');
		} catch (error) {
			// If the error is that the table already exists, that's fine
			if (error.message.includes('already exists')) {
				console.log('NotificationPreferences table already exists');
			} else {
				throw error;
			}
		}

		console.log('Model sync completed successfully!');
	} catch (error) {
		console.error('Model sync failed:', error);
		process.exit(1);
	}
}

syncModels()
	.then(() => process.exit(0))
	.catch(err => {
		console.error('Error during sync:', err);
		process.exit(1);
	});