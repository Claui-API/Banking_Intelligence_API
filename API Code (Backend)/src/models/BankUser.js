// src/models/BankUser.js - Fixed version
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const BankUser = sequelize.define('BankUser', {
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
		name: {
			type: DataTypes.STRING,
			allowNull: true
		},
		email: {
			type: DataTypes.STRING,
			allowNull: true
		},
		status: {
			type: DataTypes.STRING,
			defaultValue: 'active'
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
				unique: true,
				fields: ['clientId', 'bankUserId']
			}
		]
	});

	return BankUser;
};