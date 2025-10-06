// src/models/PlaidItem.js - Fixed version
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
		// Add fields for data retention
		disconnectedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: 'When the Plaid connection was disconnected by user'
		},
		deletionScheduledAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: 'When the Plaid data is scheduled to be deleted'
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

	return PlaidItem;
};