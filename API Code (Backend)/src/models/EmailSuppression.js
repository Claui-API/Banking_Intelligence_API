// src/models/EmailSuppression.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const EmailSuppression = sequelize.define('EmailSuppression', {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				isEmail: true
			},
			set(value) {
				this.setDataValue('email', value.toLowerCase());
			}
		},
		reason: {
			type: DataTypes.ENUM('bounce', 'complaint', 'unsubscribe', 'manual'),
			allowNull: false,
			comment: 'Reason for suppression: bounce, complaint, unsubscribe, manual'
		},
		source: {
			type: DataTypes.ENUM('ses', 'manual', 'user', 'system'),
			allowNull: false,
			defaultValue: 'manual',
			comment: 'Source of suppression: ses (AWS), manual (admin), user (self), system (automated)'
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
			comment: 'Whether the suppression is currently active'
		},
		metadata: {
			type: DataTypes.JSONB,
			defaultValue: {},
			comment: 'Additional metadata about the suppression (bounce details, complaint info, etc.)'
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW
		}
	}, {
		tableName: 'email_suppressions',
		timestamps: true,
		indexes: [
			{
				unique: false,
				fields: ['email', 'isActive']
			},
			{
				unique: false,
				fields: ['reason']
			},
			{
				unique: false,
				fields: ['source']
			},
			{
				unique: false,
				fields: ['createdAt']
			}
		]
	});

	// Class methods
	EmailSuppression.findByEmail = async function (email) {
		return this.findOne({
			where: {
				email: email.toLowerCase(),
				isActive: true
			}
		});
	};

	EmailSuppression.suppressEmail = async function (email, reason, source = 'manual', metadata = {}) {
		const [suppression, created] = await this.findOrCreate({
			where: {
				email: email.toLowerCase(),
				isActive: true
			},
			defaults: {
				email: email.toLowerCase(),
				reason,
				source,
				metadata,
				isActive: true
			}
		});

		if (!created) {
			// Update existing record
			suppression.reason = reason;
			suppression.source = source;
			suppression.metadata = { ...suppression.metadata, ...metadata, updatedAt: new Date() };
			await suppression.save();
		}

		return suppression;
	};

	EmailSuppression.getStatsByReason = async function () {
		return this.findAll({
			attributes: [
				'reason',
				[sequelize.fn('COUNT', sequelize.col('id')), 'count']
			],
			where: { isActive: true },
			group: ['reason'],
			raw: true
		});
	};

	EmailSuppression.getStatsBySource = async function () {
		return this.findAll({
			attributes: [
				'source',
				[sequelize.fn('COUNT', sequelize.col('id')), 'count']
			],
			where: { isActive: true },
			group: ['source'],
			raw: true
		});
	};

	return EmailSuppression;
};