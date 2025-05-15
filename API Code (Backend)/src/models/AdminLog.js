// src/models/AdminLog.js - Fixed version
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Model for logging admin activities, especially for sensitive operations
 */
const AdminLog = sequelize.define('AdminLog', {
	id: {
		type: DataTypes.UUID,
		defaultValue: DataTypes.UUIDV4,
		primaryKey: true
	},
	adminId: {
		type: DataTypes.UUID,
		allowNull: false,
		comment: 'ID of the admin who performed the action',
		references: {
			model: 'Users',
			key: 'id'
		}
	},
	action: {
		type: DataTypes.STRING,
		allowNull: false,
		comment: 'Type of admin action performed'
	},
	details: {
		type: DataTypes.JSON,
		allowNull: true,
		comment: 'Additional details about the action'
	},
	ipAddress: {
		type: DataTypes.STRING,
		allowNull: true,
		comment: 'IP address from which the action was performed'
	},
	userAgent: {
		type: DataTypes.TEXT,
		allowNull: true,
		comment: 'User agent of the browser/client used'
	},
	timestamp: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
		comment: 'When the admin action occurred'
	}
}, {
	timestamps: true,
	indexes: [
		{
			fields: ['adminId']
		},
		{
			fields: ['action']
		},
		{
			fields: ['timestamp']
		}
	],
	comment: 'Logs for sensitive admin operations and data management'
});

module.exports = AdminLog;