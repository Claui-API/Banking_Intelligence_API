// src/models/PlaidItem.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlaidItem = sequelize.define('PlaidItem', {
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
	itemId: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	accessToken: {
		type: DataTypes.STRING,
		allowNull: false
	},
	institutionId: {
		type: DataTypes.STRING,
		allowNull: true
	},
	institutionName: {
		type: DataTypes.STRING,
		allowNull: true
	},
	status: {
		type: DataTypes.ENUM('active', 'error', 'disconnected'),
		defaultValue: 'active'
	},
	consentExpiresAt: {
		type: DataTypes.DATE,
		allowNull: true
	},
	lastSyncedAt: {
		type: DataTypes.DATE,
		allowNull: true
	},
	error: {
		type: DataTypes.JSON,
		allowNull: true
	}
}, {
	timestamps: true,
	paranoid: true,
	indexes: [
		{
			fields: ['userId']
		},
		{
			fields: ['itemId'],
			unique: true
		}
	]
});

// Create association with User model
const setupAssociations = () => {
	const { User } = require('./User');

	User.hasMany(PlaidItem, { foreignKey: 'userId' });
	PlaidItem.belongsTo(User, { foreignKey: 'userId' });
};

// Run associations setup when models are loaded
setupAssociations();

module.exports = PlaidItem;