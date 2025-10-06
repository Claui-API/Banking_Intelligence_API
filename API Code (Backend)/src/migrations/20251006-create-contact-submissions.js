// migrations/YYYYMMDDHHMMSS-create-contact-submissions.js

'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('contact_submissions', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true,
				allowNull: false
			},
			requestId: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
				comment: 'Unique identifier for tracking this submission'
			},
			name: {
				type: Sequelize.STRING(100),
				allowNull: false,
				comment: 'Name from the contact form'
			},
			email: {
				type: Sequelize.STRING(255),
				allowNull: false,
				comment: 'Email address from the contact form'
			},
			company: {
				type: Sequelize.STRING(100),
				allowNull: true,
				comment: 'Company name (optional field)'
			},
			message: {
				type: Sequelize.TEXT,
				allowNull: false,
				comment: 'Message content from the contact form'
			},
			status: {
				type: Sequelize.ENUM(
					'pending',
					'success',
					'partial_success',
					'failed',
					'spam_blocked',
					'rate_limited',
					'validation_failed'
				),
				defaultValue: 'pending',
				allowNull: false,
				comment: 'Status of the contact form submission'
			},
			ipAddress: {
				type: Sequelize.STRING(45), // IPv6 compatible
				allowNull: true,
				comment: 'IP address of the submitter'
			},
			userAgent: {
				type: Sequelize.TEXT,
				allowNull: true,
				comment: 'User agent string from the request'
			},
			suspicionScore: {
				type: Sequelize.INTEGER,
				defaultValue: 0,
				allowNull: false,
				comment: 'Spam detection suspicion score'
			},
			businessEmailSent: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
				allowNull: false,
				comment: 'Whether the business notification email was sent successfully'
			},
			confirmationEmailSent: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
				allowNull: false,
				comment: 'Whether the confirmation email was sent to the user'
			},
			businessEmailId: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'AWS SES Message ID for the business email'
			},
			confirmationEmailId: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'AWS SES Message ID for the confirmation email'
			},
			errorMessage: {
				type: Sequelize.TEXT,
				allowNull: true,
				comment: 'Error message if submission failed'
			},
			processingTimeMs: {
				type: Sequelize.INTEGER,
				allowNull: true,
				comment: 'Time taken to process the submission in milliseconds'
			},
			metadata: {
				type: Sequelize.JSONB,
				defaultValue: {},
				comment: 'Additional metadata about the submission'
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.NOW
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.NOW
			}
		});

		// Add indexes
		await queryInterface.addIndex('contact_submissions', ['email'], {
			name: 'idx_contact_submissions_email'
		});

		await queryInterface.addIndex('contact_submissions', ['status'], {
			name: 'idx_contact_submissions_status'
		});

		await queryInterface.addIndex('contact_submissions', ['createdAt'], {
			name: 'idx_contact_submissions_created_at'
		});

		await queryInterface.addIndex('contact_submissions', ['requestId'], {
			name: 'idx_contact_submissions_request_id',
			unique: true
		});

		await queryInterface.addIndex('contact_submissions', ['ipAddress'], {
			name: 'idx_contact_submissions_ip_address'
		});

		await queryInterface.addIndex('contact_submissions', ['suspicionScore'], {
			name: 'idx_contact_submissions_suspicion_score'
		});

		// Composite indexes for analytics
		await queryInterface.addIndex('contact_submissions', ['status', 'createdAt'], {
			name: 'idx_contact_submissions_status_created_at'
		});

		await queryInterface.addIndex('contact_submissions', ['ipAddress', 'createdAt'], {
			name: 'idx_contact_submissions_ip_created_at'
		});
	},

	down: async (queryInterface, Sequelize) => {
		// Drop indexes first
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_email');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_status');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_created_at');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_request_id');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_ip_address');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_suspicion_score');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_status_created_at');
		await queryInterface.removeIndex('contact_submissions', 'idx_contact_submissions_ip_created_at');

		// Drop the table
		await queryInterface.dropTable('contact_submissions');
	}
};