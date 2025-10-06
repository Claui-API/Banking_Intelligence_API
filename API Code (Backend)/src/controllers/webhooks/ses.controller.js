// src/controllers/webhooks/ses.controller.js
const logger = require('../../utils/logger');
const { processBounce, processComplaint } = require('../../services/suppression.service');
const crypto = require('crypto');

/**
 * Verify SNS message signature
 */
const verifySnsSiganture = (message, signature, signingCertURL) => {
	// In production, you should verify the SNS message signature
	// This is a simplified version - implement proper SNS signature verification
	// See: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
	return true; // Placeholder - implement proper verification
};

/**
 * Handle SES bounce notifications
 */
const handleBounceNotification = async (req, res) => {
	try {
		const message = JSON.parse(req.body.Message);

		// Verify this is a bounce notification
		if (message.notificationType !== 'Bounce') {
			logger.warn('Received non-bounce notification', { notificationType: message.notificationType });
			return res.status(400).json({ error: 'Invalid notification type' });
		}

		logger.info('Processing bounce notification', {
			messageId: message.mail.messageId,
			bounceType: message.bounce.bounceType,
			bounceSubType: message.bounce.bounceSubType,
			recipientCount: message.bounce.bouncedRecipients.length
		});

		// Process bounce through suppression service
		await processBounce(message);

		res.status(200).json({ success: true, message: 'Bounce processed successfully' });

	} catch (error) {
		logger.error('Error processing bounce notification', {
			error: error.message,
			stack: error.stack,
			body: req.body
		});
		res.status(500).json({ error: 'Failed to process bounce notification' });
	}
};

/**
 * Handle SES complaint notifications
 */
const handleComplaintNotification = async (req, res) => {
	try {
		const message = JSON.parse(req.body.Message);

		// Verify this is a complaint notification
		if (message.notificationType !== 'Complaint') {
			logger.warn('Received non-complaint notification', { notificationType: message.notificationType });
			return res.status(400).json({ error: 'Invalid notification type' });
		}

		logger.info('Processing complaint notification', {
			messageId: message.mail.messageId,
			complaintFeedbackType: message.complaint.complaintFeedbackType,
			recipientCount: message.complaint.complainedRecipients.length
		});

		// Process complaint through suppression service
		await processComplaint(message);

		res.status(200).json({ success: true, message: 'Complaint processed successfully' });

	} catch (error) {
		logger.error('Error processing complaint notification', {
			error: error.message,
			stack: error.stack,
			body: req.body
		});
		res.status(500).json({ error: 'Failed to process complaint notification' });
	}
};

/**
 * Handle general SES notifications (route all types)
 */
const handleSesNotification = async (req, res) => {
	try {
		// Parse SNS message
		let snsMessage;
		try {
			snsMessage = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
		} catch (parseError) {
			logger.error('Failed to parse SNS message', { error: parseError.message });
			return res.status(400).json({ error: 'Invalid JSON payload' });
		}

		// Handle SNS subscription confirmation
		if (snsMessage.Type === 'SubscriptionConfirmation') {
			logger.info('SNS subscription confirmation received', {
				topicArn: snsMessage.TopicArn,
				subscribeURL: snsMessage.SubscribeURL
			});

			// In production, you might want to auto-confirm subscriptions
			// or log the SubscribeURL for manual confirmation
			return res.status(200).json({
				success: true,
				message: 'Subscription confirmation received',
				subscribeURL: snsMessage.SubscribeURL
			});
		}

		// Handle notifications
		if (snsMessage.Type === 'Notification') {
			const sesMessage = JSON.parse(snsMessage.Message);

			logger.info('SES notification received', {
				notificationType: sesMessage.notificationType,
				messageId: sesMessage.mail?.messageId
			});

			switch (sesMessage.notificationType) {
				case 'Bounce':
					await processBounce(sesMessage);
					break;
				case 'Complaint':
					await processComplaint(sesMessage);
					break;
				case 'Delivery':
					logger.info('Delivery notification received', {
						messageId: sesMessage.mail.messageId,
						recipients: sesMessage.delivery.recipients
					});
					// You can track successful deliveries here if needed
					break;
				default:
					logger.warn('Unknown SES notification type', {
						notificationType: sesMessage.notificationType
					});
			}

			return res.status(200).json({ success: true, message: 'Notification processed' });
		}

		logger.warn('Unknown SNS message type', { type: snsMessage.Type });
		res.status(400).json({ error: 'Unknown message type' });

	} catch (error) {
		logger.error('Error processing SES notification', {
			error: error.message,
			stack: error.stack
		});
		res.status(500).json({ error: 'Failed to process notification' });
	}
};

module.exports = {
	handleBounceNotification,
	handleComplaintNotification,
	handleSesNotification
};