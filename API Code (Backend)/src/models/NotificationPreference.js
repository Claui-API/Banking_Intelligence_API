// src/models/NotificationPreference.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * NotificationPreference model for storing user notification preferences
 */
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
const setupAssociations = () => {
	const { User } = require('./User');

	// Set up associations
	User.hasOne(NotificationPreference, { foreignKey: 'userId' });
	NotificationPreference.belongsTo(User, { foreignKey: 'userId' });
};

// Run associations setup when models are loaded
setupAssociations();

// Helper method to get preferences for a user, creating default if not exists
NotificationPreference.getOrCreateForUser = async function (userId) {
	try {
		let preferences = await this.findOne({ where: { userId } });

		if (!preferences) {
			// Create default preferences
			preferences = await this.create({ userId });
		}

		return preferences;
	} catch (error) {
		throw error;
	}
};

module.exports = NotificationPreference;