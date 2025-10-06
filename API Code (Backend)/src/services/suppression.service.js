// src/services/suppression.service.js
const { EmailSuppression } = require('../models');
const logger = require('../utils/logger');

/**
 * Check if email is in suppression list
 * @param {string} email - Email address to check
 * @returns {Object|null} - Suppression record if found, null otherwise
 */
const checkSuppressionList = async (email) => {
	try {
		const suppression = await EmailSuppression.findOne({
			where: {
				email: email.toLowerCase(),
				isActive: true
			}
		});

		if (suppression) {
			logger.info('Email found in suppression list', {
				email,
				reason: suppression.reason,
				suppressedAt: suppression.createdAt
			});
		}

		return suppression;
	} catch (error) {
		logger.error('Error checking suppression list', { email, error: error.message });
		return null; // Don't block sending on database errors
	}
};

/**
 * Add email to suppression list
 * @param {string} email - Email address to suppress
 * @param {string} reason - Reason for suppression (bounce, complaint, unsubscribe)
 * @param {string} source - Source of suppression (ses, manual, user)
 * @param {Object} metadata - Additional metadata
 * @returns {Object} - Created suppression record
 */
const addToSuppressionList = async (email, reason, source = 'manual', metadata = {}) => {
	try {
		// Check if already suppressed
		const existing = await EmailSuppression.findOne({
			where: {
				email: email.toLowerCase(),
				isActive: true
			}
		});

		if (existing) {
			logger.info('Email already suppressed, updating reason', {
				email,
				existingReason: existing.reason,
				newReason: reason
			});

			// Update existing record
			existing.reason = reason;
			existing.source = source;
			existing.metadata = { ...existing.metadata, ...metadata, updatedAt: new Date() };
			await existing.save();
			return existing;
		}

		// Create new suppression record
		const suppression = await EmailSuppression.create({
			email: email.toLowerCase(),
			reason,
			source,
			metadata,
			isActive: true
		});

		logger.info('Email added to suppression list', {
			email,
			reason,
			source,
			suppressionId: suppression.id
		});

		return suppression;
	} catch (error) {
		logger.error('Error adding email to suppression list', {
			email,
			reason,
			error: error.message
		});
		throw error;
	}
};

/**
 * Remove email from suppression list (reactivate)
 * @param {string} email - Email address to reactivate
 * @param {string} reason - Reason for reactivation
 * @returns {boolean} - Success status
 */
const removeFromSuppressionList = async (email, reason = 'manual_reactivation') => {
	try {
		const result = await EmailSuppression.update(
			{
				isActive: false,
				metadata: { deactivatedAt: new Date(), deactivationReason: reason }
			},
			{
				where: {
					email: email.toLowerCase(),
					isActive: true
				}
			}
		);

		const wasUpdated = result[0] > 0;

		logger.info('Email suppression status updated', {
			email,
			wasUpdated,
			reason
		});

		return wasUpdated;
	} catch (error) {
		logger.error('Error removing email from suppression list', {
			email,
			error: error.message
		});
		throw error;
	}
};

/**
 * Process AWS SES bounce notification
 * @param {Object} bounceData - Bounce data from SES
 */
const processBounce = async (bounceData) => {
	try {
		const { mail, bounce } = bounceData;

		for (const recipient of bounce.bouncedRecipients) {
			const email = recipient.emailAddress;
			const bounceType = bounce.bounceType; // 'Permanent' or 'Transient'
			const bounceSubType = bounce.bounceSubType;

			// Only suppress permanent bounces
			if (bounceType === 'Permanent') {
				await addToSuppressionList(email, 'bounce', 'ses', {
					bounceType,
					bounceSubType,
					messageId: mail.messageId,
					timestamp: bounce.timestamp,
					diagnosticCode: recipient.diagnosticCode
				});
			} else {
				logger.info('Transient bounce received - not suppressing', {
					email,
					bounceType,
					bounceSubType,
					messageId: mail.messageId
				});
			}
		}
	} catch (error) {
		logger.error('Error processing bounce notification', {
			error: error.message,
			bounceData
		});
	}
};

/**
 * Process AWS SES complaint notification
 * @param {Object} complaintData - Complaint data from SES
 */
const processComplaint = async (complaintData) => {
	try {
		const { mail, complaint } = complaintData;

		for (const recipient of complaint.complainedRecipients) {
			const email = recipient.emailAddress;

			await addToSuppressionList(email, 'complaint', 'ses', {
				complaintFeedbackType: complaint.complaintFeedbackType,
				messageId: mail.messageId,
				timestamp: complaint.timestamp,
				userAgent: complaint.userAgent
			});
		}
	} catch (error) {
		logger.error('Error processing complaint notification', {
			error: error.message,
			complaintData
		});
	}
};

/**
 * Process unsubscribe request
 * @param {string} email - Email address to unsubscribe
 * @param {string} source - Source of unsubscribe (link, manual, etc.)
 * @returns {boolean} - Success status
 */
const processUnsubscribe = async (email, source = 'unsubscribe_link') => {
	try {
		await addToSuppressionList(email, 'unsubscribe', source, {
			unsubscribedAt: new Date()
		});
		return true;
	} catch (error) {
		logger.error('Error processing unsubscribe', {
			email,
			source,
			error: error.message
		});
		return false;
	}
};

/**
 * Get suppression list statistics
 * @returns {Object} - Suppression statistics
 */
const getSuppressionStats = async () => {
	try {
		const stats = await EmailSuppression.findAll({
			attributes: [
				'reason',
				[EmailSuppression.sequelize.fn('COUNT', EmailSuppression.sequelize.col('id')), 'count']
			],
			where: { isActive: true },
			group: ['reason']
		});

		const result = {
			total: 0,
			byReason: {}
		};

		stats.forEach(stat => {
			const count = parseInt(stat.dataValues.count);
			result.byReason[stat.reason] = count;
			result.total += count;
		});

		return result;
	} catch (error) {
		logger.error('Error getting suppression stats', { error: error.message });
		return { total: 0, byReason: {} };
	}
};

module.exports = {
	checkSuppressionList,
	addToSuppressionList,
	removeFromSuppressionList,
	processBounce,
	processComplaint,
	processUnsubscribe,
	getSuppressionStats
};