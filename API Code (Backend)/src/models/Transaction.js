// src/models/Transaction.js - Modified version
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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

// Set up associations
const setupAssociations = () => {
	const { Client } = require('./User');

	if (Client) {
		Client.hasMany(Transaction, { foreignKey: 'clientId', sourceKey: 'clientId' });
		Transaction.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
	}

	// Note: We're removing the direct foreign key constraints to BankUser and Account models
	// Instead, we'll rely on application-level validation
};

setupAssociations();

module.exports = Transaction;