// src/models/RetentionLog.js - Fixed version
const { DataTypes } = require('sequelize');

/**
 * Model for logging data retention and deletion activities
 */
module.exports = (sequelize) => {
	const RetentionLog = sequelize.define('RetentionLog', {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true
		},
		action: {
			type: DataTypes.STRING,
			allowNull: false,
			comment: 'Type of retention action performed'
		},
		details: {
			type: DataTypes.JSON,
			allowNull: true,
			comment: 'Additional details about the action'
		},
		timestamp: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
			comment: 'When the retention action occurred'
		}
	}, {
		timestamps: true,
		indexes: [
			{
				fields: ['action']
			},
			{
				fields: ['timestamp']
			}
		],
		comment: 'Logs for data retention compliance and auditing'
	});

	return RetentionLog;
};