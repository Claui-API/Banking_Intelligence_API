// src/models/Transaction.js - Fixed version
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Transaction = sequelize.define('Transaction', {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true
		},
		clientId: {
			type: DataTypes.STRING,
			allowNull: false,
			references: {
				model: 'Clients',
				key: 'clientId'
			}
		},
		bankUserId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		accountId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		transactionId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		date: {
			type: DataTypes.DATE,
			allowNull: false
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		amount: {
			type: DataTypes.DECIMAL(12, 2),
			allowNull: false
		},
		category: {
			type: DataTypes.STRING,
			allowNull: true
		},
		type: {
			type: DataTypes.STRING,
			allowNull: true
		},
		pending: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		merchantName: {
			type: DataTypes.STRING,
			allowNull: true
		},
		metadata: {
			type: DataTypes.JSONB,
			allowNull: true
		}
	}, {
		timestamps: true,
		indexes: [
			{
				fields: ['clientId']
			},
			{
				fields: ['bankUserId']
			},
			{
				fields: ['accountId']
			},
			{
				fields: ['date']
			},
			{
				unique: true,
				fields: ['clientId', 'bankUserId', 'transactionId']
			}
		]
	});

	return Transaction;
};