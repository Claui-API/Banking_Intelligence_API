// src/models/ContactSubmission.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const ContactSubmission = sequelize.define('ContactSubmission', {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true
		},
		requestId: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
			comment: 'Unique identifier for tracking this submission (e.g., contact-1759754816909)'
		},
		name: {
			type: DataTypes.STRING(100),
			allowNull: false,
			comment: 'Name from the contact form'
		},
		email: {
			type: DataTypes.STRING(255),
			allowNull: false,
			validate: {
				isEmail: true
			},
			comment: 'Email address from the contact form'
		},
		company: {
			type: DataTypes.STRING(100),
			allowNull: true,
			comment: 'Company name (optional field)'
		},
		message: {
			type: DataTypes.TEXT,
			allowNull: false,
			comment: 'Message content from the contact form'
		},
		status: {
			type: DataTypes.ENUM(
				'pending',           // Just received, being processed
				'success',          // Successfully sent both business and confirmation emails
				'partial_success',  // Business email sent, but confirmation failed
				'failed',           // Failed to send business email
				'spam_blocked',     // Blocked by spam detection
				'rate_limited',     // Blocked by rate limiting
				'validation_failed' // Failed form validation
			),
			defaultValue: 'pending',
			allowNull: false,
			comment: 'Status of the contact form submission'
		},
		ipAddress: {
			type: DataTypes.STRING(45), // IPv6 compatible
			allowNull: true,
			comment: 'IP address of the submitter'
		},
		userAgent: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: 'User agent string from the request'
		},
		suspicionScore: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
			comment: 'Spam detection suspicion score (0 = clean, higher = more suspicious)'
		},
		businessEmailSent: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false,
			comment: 'Whether the business notification email was sent successfully'
		},
		confirmationEmailSent: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false,
			comment: 'Whether the confirmation email was sent to the user'
		},
		businessEmailId: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: 'AWS SES Message ID for the business email'
		},
		confirmationEmailId: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: 'AWS SES Message ID for the confirmation email'
		},
		errorMessage: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: 'Error message if submission failed'
		},
		processingTimeMs: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: 'Time taken to process the submission in milliseconds'
		},
		metadata: {
			type: DataTypes.JSONB,
			defaultValue: {},
			comment: 'Additional metadata about the submission (referrer, campaign, etc.)'
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
		tableName: 'contact_submissions',
		timestamps: true,
		indexes: [
			{
				fields: ['email']
			},
			{
				fields: ['status']
			},
			{
				fields: ['createdAt']
			},
			{
				fields: ['requestId'],
				unique: true
			},
			{
				fields: ['ipAddress']
			},
			{
				fields: ['suspicionScore']
			},
			{
				// Composite index for analytics queries
				fields: ['status', 'createdAt']
			},
			{
				// Index for IP-based rate limiting queries
				fields: ['ipAddress', 'createdAt']
			}
		]
	});

	// Static methods for analytics
	ContactSubmission.getStatsByDateRange = async function (startDate, endDate) {
		const { Op } = require('sequelize');

		return this.findAll({
			attributes: [
				'status',
				[sequelize.fn('COUNT', sequelize.col('id')), 'count']
			],
			where: {
				createdAt: {
					[Op.between]: [startDate, endDate]
				}
			},
			group: ['status'],
			raw: true
		});
	};

	ContactSubmission.getSuccessRate = async function (days = 30) {
		const { Op } = require('sequelize');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const results = await this.findAll({
			attributes: [
				[sequelize.fn('COUNT', sequelize.col('id')), 'total'],
				[sequelize.fn('COUNT', sequelize.literal("CASE WHEN status IN ('success', 'partial_success') THEN 1 END")), 'successful']
			],
			where: {
				createdAt: { [Op.gte]: startDate }
			},
			raw: true
		});

		const result = results[0];
		const total = parseInt(result.total) || 0;
		const successful = parseInt(result.successful) || 0;

		return {
			total,
			successful,
			rate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0
		};
	};

	ContactSubmission.getSpamStats = async function (days = 30) {
		const { Op } = require('sequelize');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		return this.findAll({
			attributes: [
				[sequelize.fn('COUNT', sequelize.col('id')), 'total'],
				[sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'spam_blocked' THEN 1 END")), 'spam_blocked'],
				[sequelize.fn('AVG', sequelize.col('suspicionScore')), 'avg_suspicion_score']
			],
			where: {
				createdAt: { [Op.gte]: startDate }
			},
			raw: true
		});
	};

	ContactSubmission.getRecentSubmissions = async function (limit = 10) {
		return this.findAll({
			limit,
			order: [['createdAt', 'DESC']],
			attributes: ['id', 'requestId', 'name', 'email', 'company', 'status', 'createdAt']
		});
	};

	// Instance methods
	ContactSubmission.prototype.markAsSuccess = function (businessMessageId, confirmationMessageId) {
		this.status = 'success';
		this.businessEmailSent = true;
		this.confirmationEmailSent = !!confirmationMessageId;
		this.businessEmailId = businessMessageId;
		this.confirmationEmailId = confirmationMessageId;
		return this.save();
	};

	ContactSubmission.prototype.markAsPartialSuccess = function (businessMessageId, error) {
		this.status = 'partial_success';
		this.businessEmailSent = true;
		this.confirmationEmailSent = false;
		this.businessEmailId = businessMessageId;
		this.errorMessage = error;
		return this.save();
	};

	ContactSubmission.prototype.markAsFailed = function (error) {
		this.status = 'failed';
		this.businessEmailSent = false;
		this.confirmationEmailSent = false;
		this.errorMessage = error;
		return this.save();
	};

	ContactSubmission.prototype.markAsSpam = function (reason) {
		this.status = 'spam_blocked';
		this.errorMessage = reason;
		return this.save();
	};

	return ContactSubmission;
};