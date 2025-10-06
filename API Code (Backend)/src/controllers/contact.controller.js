const AWS = require('aws-sdk');
const logger = require('../utils/logger');
const { validateEmail, sanitizeInput } = require('../utils/validation');
const { checkSuppressionList } = require('../services/suppression.service');
const { ContactSubmission } = require('../models');

// Configure AWS SES
const ses = new AWS.SES({
	region: process.env.AWS_REGION || 'us-east-2',
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const VERIFIED_SENDER_EMAIL = process.env.VERIFIED_SENDER_EMAIL || 'shreyas.atneu@gmail.com';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'business@vivytech.com';
const CONTACT_FROM_NAME = process.env.CONTACT_FROM_NAME || 'Banking Intelligence API';

/**
 * Handle contact form submission with database tracking
 */
const submitContactForm = async (req, res) => {
	const requestId = `contact-${Date.now()}`;
	const startTime = Date.now();
	let submission = null;

	try {
		const { name, email, company, message } = req.body;

		// Create initial database record
		submission = await ContactSubmission.create({
			requestId,
			name: name ? name.trim() : '',
			email: email ? email.trim().toLowerCase() : '',
			company: company ? company.trim() : '',
			message: message ? message.trim() : '',
			status: 'pending',
			ipAddress: req.ip || req.connection.remoteAddress,
			userAgent: req.get('User-Agent'),
			suspicionScore: req.suspicionScore || 0,
			metadata: {
				referrer: req.get('Referer'),
				origin: req.get('Origin'),
				timestamp: new Date().toISOString()
			}
		});

		// Enhanced validation
		const validationErrors = [];

		if (!name || name.trim().length === 0) {
			validationErrors.push('Name is required');
		} else if (name.trim().length > 100) {
			validationErrors.push('Name must be less than 100 characters');
		}

		if (!validateEmail(email)) {
			validationErrors.push('Valid email address is required');
		}

		if (!message || message.trim().length < 10) {
			validationErrors.push('Message must be at least 10 characters long');
		} else if (message.trim().length > 2000) {
			validationErrors.push('Message must be less than 2000 characters');
		}

		if (validationErrors.length > 0) {
			await submission.update({
				status: 'validation_failed',
				errorMessage: validationErrors.join(', '),
				processingTimeMs: Date.now() - startTime
			});

			logger.warn('Contact form validation failed', {
				requestId,
				errors: validationErrors,
				ip: req.ip,
				userAgent: req.get('User-Agent')
			});

			return res.status(400).json({
				error: validationErrors.length === 1
					? validationErrors[0]
					: `Please fix the following issues: ${validationErrors.join(', ')}`,
				details: validationErrors
			});
		}

		// Check if request was rate limited
		if (req.rateLimited) {
			await submission.update({
				status: 'rate_limited',
				errorMessage: 'Rate limit exceeded',
				processingTimeMs: Date.now() - startTime
			});

			return res.status(429).json({
				error: 'Too many contact form submissions. Please try again in 15 minutes.',
				type: 'rate_limit_exceeded'
			});
		}

		// Check if marked as spam
		if (req.suspicionScore >= 4) {
			await submission.update({
				status: 'spam_blocked',
				errorMessage: 'High spam suspicion score',
				processingTimeMs: Date.now() - startTime
			});

			logger.warn('Contact form blocked as spam', {
				requestId,
				suspicionScore: req.suspicionScore,
				email: email.trim().toLowerCase()
			});

			return res.status(400).json({
				error: 'Your submission appears to be spam. Please contact us directly if this is a legitimate inquiry.',
				type: 'spam_detected'
			});
		}

		// Check suppression list
		const emailSuppressed = await checkSuppressionList(email.trim().toLowerCase());
		if (emailSuppressed) {
			logger.info('Email suppressed - not sending confirmation', {
				requestId,
				email: email.trim().toLowerCase(),
				reason: emailSuppressed.reason
			});
		}

		// Sanitize inputs
		const sanitizedData = {
			name: sanitizeInput(name.trim(), 100),
			email: email.trim().toLowerCase(),
			company: company ? sanitizeInput(company.trim(), 100) : '',
			message: sanitizeInput(message.trim(), 2000)
		};

		logger.info('Processing contact form submission', {
			requestId,
			from: sanitizedData.email,
			company: sanitizedData.company || 'Not provided',
			messageLength: sanitizedData.message.length,
			suppressed: !!emailSuppressed
		});

		let businessEmailResult = null;
		let confirmationResult = null;
		let processingError = null;

		try {
			// Send business inquiry email (always send)
			businessEmailResult = await sendBusinessInquiry(sanitizedData, requestId);

			// Send confirmation email (only if not suppressed and not in sandbox mode)
			if (!emailSuppressed && process.env.SES_SANDBOX_MODE !== 'true') {
				try {
					confirmationResult = await sendUserConfirmation(sanitizedData, requestId);
				} catch (confirmError) {
					// Log but don't fail the entire request if confirmation fails
					processingError = `Confirmation email failed: ${confirmError.message}`;
					logger.warn('User confirmation email failed', {
						requestId,
						error: confirmError.message,
						customerEmail: sanitizedData.email
					});
				}
			}

			// Update submission status based on results
			if (businessEmailResult && confirmationResult) {
				await submission.markAsSuccess(
					businessEmailResult.MessageId,
					confirmationResult.MessageId
				);
			} else if (businessEmailResult && !confirmationResult) {
				await submission.markAsPartialSuccess(
					businessEmailResult.MessageId,
					processingError || 'Confirmation email skipped or failed'
				);
			} else {
				throw new Error('Failed to send business email');
			}

			await submission.update({
				processingTimeMs: Date.now() - startTime
			});

		} catch (emailError) {
			await submission.markAsFailed(emailError.message);
			await submission.update({
				processingTimeMs: Date.now() - startTime
			});
			throw emailError;
		}

		logger.info('Contact form processed successfully', {
			requestId,
			businessEmailSent: !!businessEmailResult,
			confirmationEmailSent: !!confirmationResult,
			suppressed: !!emailSuppressed,
			processingTimeMs: Date.now() - startTime
		});

		res.status(200).json({
			success: true,
			message: 'Thank you for your inquiry! We\'ll be in touch within 24 hours.',
			requestId
		});

	} catch (error) {
		const processingTime = Date.now() - startTime;

		// Update submission record if it exists
		if (submission) {
			try {
				await submission.update({
					status: 'failed',
					errorMessage: error.message,
					processingTimeMs: processingTime
				});
			} catch (updateError) {
				logger.error('Failed to update submission record', {
					requestId,
					error: updateError.message
				});
			}
		}

		logger.error('Contact form submission failed', {
			requestId,
			error: error.message,
			code: error.code,
			statusCode: error.statusCode,
			stack: error.stack,
			processingTimeMs: processingTime
		});

		// Handle specific AWS SES errors
		if (error.code === 'MessageRejected') {
			if (error.message.includes('not verified')) {
				return res.status(500).json({
					error: 'Email service configuration issue. Please contact us directly at business@vivytech.com.',
					type: 'verification_error'
				});
			}
			return res.status(400).json({
				error: 'Email could not be delivered. Please check your email address and try again.',
				type: 'delivery_error'
			});
		} else if (error.code === 'SendingQuotaExceeded' || error.code === 'Throttling') {
			return res.status(429).json({
				error: 'Email service temporarily unavailable. Please try again in a few minutes or contact us directly at business@vivytech.com.',
				type: 'rate_limit_error'
			});
		}

		return res.status(500).json({
			error: 'There was a problem sending your message. Please try again or contact us directly at business@vivytech.com.',
			type: 'server_error'
		});
	}
};

/**
 * Updated email sending functions with proper anti-spam headers
 */

/**
 * Send business inquiry email with enhanced tracking
 */
const sendBusinessInquiry = async (data, requestId) => {
	const { name, email, company, message } = data;

	const emailBody = generateBusinessEmailText(data, requestId);
	const htmlBody = generateBusinessEmailHTML(data, requestId);

	const emailParams = {
		Source: `${CONTACT_FROM_NAME} <${VERIFIED_SENDER_EMAIL}>`,
		Destination: {
			ToAddresses: [BUSINESS_EMAIL],
		},
		Message: {
			Subject: {
				Data: `Banking Intelligence Inquiry from ${name}${company ? ` - ${company}` : ''}`,
				Charset: 'UTF-8',
			},
			Body: {
				Text: {
					Data: emailBody,
					Charset: 'UTF-8',
				},
				Html: {
					Data: htmlBody,
					Charset: 'UTF-8',
				},
			},
		},
		ReplyToAddresses: [email],
		Tags: [
			{ Name: 'Type', Value: 'ContactForm' },
			{ Name: 'Category', Value: 'BusinessInquiry' },
			{ Name: 'RequestId', Value: requestId }
		]
		// ConfigurationSetName will be added conditionally below
	};

	// Only add configuration set if it exists and is not the problematic one
	if (process.env.SES_CONFIGURATION_SET && process.env.SES_CONFIGURATION_SET !== 'banking-intelligence-emails') {
		emailParams.ConfigurationSetName = process.env.SES_CONFIGURATION_SET;
	}

	const result = await ses.sendEmail(emailParams).promise();

	logger.info('Business inquiry email sent', {
		requestId,
		messageId: result.MessageId,
		recipient: BUSINESS_EMAIL
	});

	return result;
};

/**
 * Send confirmation email with proper anti-spam headers
 */
const sendUserConfirmation = async (data, requestId) => {
	const { name, email, message } = data;
	const unsubscribeToken = Buffer.from(`${data.email}:${requestId}`).toString('base64');
	const unsubscribeUrl = `https://bankingintelligenceapi.com/unsubscribe?token=${unsubscribeToken}`;

	const emailBody = generateConfirmationEmailText(data, requestId);
	const htmlBody = generateConfirmationEmailHTML(data, requestId);

	const emailParams = {
		Source: `${CONTACT_FROM_NAME} <${VERIFIED_SENDER_EMAIL}>`,
		Destination: {
			ToAddresses: [email],
		},
		Message: {
			Subject: {
				Data: 'Thank you for your Banking Intelligence inquiry',
				Charset: 'UTF-8',
			},
			Body: {
				Text: {
					Data: emailBody,
					Charset: 'UTF-8',
				},
				Html: {
					Data: htmlBody,
					Charset: 'UTF-8',
				},
			},
		},
		Tags: [
			{ Name: 'Type', Value: 'ContactForm' },
			{ Name: 'Category', Value: 'Confirmation' },
			{ Name: 'RequestId', Value: requestId }
		]
		// ConfigurationSetName will be added conditionally below
	};

	// Only add configuration set if it exists
	if (process.env.SES_CONFIGURATION_SET && process.env.SES_CONFIGURATION_SET !== 'banking-intelligence-emails') {
		emailParams.ConfigurationSetName = process.env.SES_CONFIGURATION_SET;
	}

	// Use sendRawEmail to include custom headers for better deliverability
	const rawEmailParams = {
		Source: `${CONTACT_FROM_NAME} <${VERIFIED_SENDER_EMAIL}>`,
		Destinations: [email],
		RawMessage: {
			Data: createRawEmailMessage({
				from: `${CONTACT_FROM_NAME} <${VERIFIED_SENDER_EMAIL}>`,
				to: email,
				subject: 'Thank you for your Banking Intelligence inquiry',
				textBody: emailBody,
				htmlBody: htmlBody,
				unsubscribeUrl: unsubscribeUrl,
				requestId: requestId
			})
		},
		Tags: [
			{ Name: 'Type', Value: 'ContactForm' },
			{ Name: 'Category', Value: 'Confirmation' },
			{ Name: 'RequestId', Value: requestId }
		]
	};

	// Add configuration set if available
	if (process.env.SES_CONFIGURATION_SET && process.env.SES_CONFIGURATION_SET !== 'banking-intelligence-emails') {
		rawEmailParams.ConfigurationSetName = process.env.SES_CONFIGURATION_SET;
	}

	const result = await ses.sendRawEmail(rawEmailParams).promise();

	logger.info('Confirmation email sent with enhanced headers', {
		requestId,
		messageId: result.MessageId,
		recipient: email
	});

	return result;
};

/**
 * Create raw email message with proper headers for deliverability
 */
const createRawEmailMessage = ({ from, to, subject, textBody, htmlBody, unsubscribeUrl, requestId }) => {
	const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const date = new Date().toUTCString();

	const rawMessage = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		`Date: ${date}`,
		`Message-ID: <${requestId}-${Date.now()}@bankingintelligenceapi.com>`,
		`MIME-Version: 1.0`,
		`Content-Type: multipart/alternative; boundary="${boundary}"`,

		// Anti-spam headers
		`List-Unsubscribe: <${unsubscribeUrl}>`,
		`List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
		`List-ID: Banking Intelligence Contact Confirmations <contact-confirmations.bankingintelligenceapi.com>`,
		`Precedence: bulk`,
		`Auto-Submitted: auto-replied`,

		// Authentication headers (these help with deliverability)
		`X-Mailer: Banking Intelligence Contact System`,
		`X-Priority: 3`,
		`X-MSMail-Priority: Normal`,

		'', // Empty line to separate headers from body

		// Text part
		`--${boundary}`,
		`Content-Type: text/plain; charset=UTF-8`,
		`Content-Transfer-Encoding: quoted-printable`,
		'',
		textBody.replace(/=/g, '=3D').replace(/\r?\n/g, '\r\n'),
		'',

		// HTML part
		`--${boundary}`,
		`Content-Type: text/html; charset=UTF-8`,
		`Content-Transfer-Encoding: quoted-printable`,
		'',
		htmlBody.replace(/=/g, '=3D').replace(/\r?\n/g, '\r\n'),
		'',

		`--${boundary}--`
	].join('\r\n');

	return Buffer.from(rawMessage);
};

/**
 * Generate business inquiry email text
 */
const generateBusinessEmailText = (data, requestId) => {
	const { name, email, company, message } = data;

	return `New Banking Intelligence Inquiry

Contact Details:
Name: ${name}
Email: ${email}
${company ? `Company: ${company}` : ''}

Message:
${message}

---
Request ID: ${requestId}
Timestamp: ${new Date().toLocaleString()}
Sent via Banking Intelligence Contact Form`;
};

/**
 * Generate business inquiry email HTML
 */
const generateBusinessEmailHTML = (data, requestId) => {
	const { name, email, company, message } = data;

	return `
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Banking Intelligence Inquiry</title>
	</head>
	<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
		<div style="max-width: 600px; margin: 0 auto; background-color: #000000; color: #ffffff; padding: 20px; border-radius: 8px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #28a745; font-size: 24px; margin-bottom: 10px;">Banking Intelligence</h1>
				<p style="color: #28a745; font-size: 14px; margin: 0;">New Contact Form Inquiry</p>
			</div>
			
			<div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
				<h3 style="color: #28a745; margin-top: 0;">Contact Details</h3>
				<p><strong>Name:</strong> ${name}</p>
				<p><strong>Email:</strong> <a href="mailto:${email}" style="color: #28a745;">${email}</a></p>
				${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
			</div>
			
			<div style="background-color: #0f1a0f; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
				<h3 style="color: #28a745; margin-top: 0;">Message</h3>
				<p style="white-space: pre-wrap;">${message}</p>
			</div>
			
			<div style="text-align: center; padding: 15px; background-color: #1a1a1a; border-radius: 8px;">
				<p style="color: #28a745; font-size: 12px; margin: 0;">
					Request ID: ${requestId}<br>
					Sent via Banking Intelligence Contact Form<br>
					${new Date().toLocaleString()}
				</p>
			</div>
		</div>
	</body>
	</html>`;
};

/**
 * Generate confirmation email text
 */
const generateConfirmationEmailText = (data, requestId) => {
	const { name, message } = data;

	return `Dear ${name},

Thank you for your interest in Banking Intelligence!

We received your inquiry and will get back to you within 24 hours. Our team is excited to discuss how Banking Intelligence can help modernize your financial institution.

Your original message:
"${message}"

If you have any urgent questions, feel free to contact us directly:
📧 business@vivytech.com
📞 +1 7869307561
🏢 100 Arlington St Boston Office 11C

Best regards,
The Banking Intelligence Team
Vivy Tech USA, inc.

---
Banking Intelligence - The easiest way to modernize your bank
www.vivytech.com

Request ID: ${requestId}

To unsubscribe from future communications: https://bankingintelligenceapi.com/unsubscribe?token=${Buffer.from(`${data.email}:${requestId}`).toString('base64')}`;
};

/**
 * Generate confirmation email HTML with unsubscribe
 */
const generateConfirmationEmailHTML = (data, requestId) => {
	const { name, message } = data;
	const unsubscribeToken = Buffer.from(`${data.email}:${requestId}`).toString('base64');

	return `
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Thank you for your inquiry</title>
	</head>
	<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
		<div style="max-width: 600px; margin: 0 auto; background-color: #000000; color: #ffffff; padding: 20px; border-radius: 8px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #28a745; font-size: 24px; margin-bottom: 10px;">Banking Intelligence</h1>
				<p style="color: #28a745; font-size: 14px; margin: 0;">Vivy Tech USA, inc.</p>
			</div>
			
			<h2 style="color: #28a745;">Thank You for Your Interest!</h2>
			
			<p>Dear ${name},</p>
			
			<p>Thank you for your interest in Banking Intelligence!</p>
			
			<p>We received your inquiry and will get back to you within <strong style="color: #28a745;">24 hours</strong>. Our team is excited to discuss how Banking Intelligence can help modernize your financial institution.</p>
			
			<div style="background-color: #1a1a1a; padding: 15px; border-left: 3px solid #28a745; margin: 20px 0;">
				<h4 style="color: #28a745; margin-top: 0;">Your original message:</h4>
				<p style="font-style: italic;">"${message}"</p>
			</div>
			
			<div style="background-color: #0f1a0f; padding: 20px; border-radius: 8px; margin: 20px 0;">
				<h4 style="color: #28a745; margin-top: 0;">Contact Information</h4>
				<p>📧 business@vivytech.com</p>
				<p>📞 +1 7869307561</p>
				<p>🏢 100 Arlington St Boston Office 11C</p>
			</div>
			
			<p>Best regards,<br>
			<strong>The Banking Intelligence Team</strong><br>
			Vivy Tech USA, inc.</p>
			
			<div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #28a745;">
				<p style="color: #28a745; font-size: 12px;">Banking Intelligence - The easiest way to modernize your bank</p>
				<p style="color: #28a745; font-size: 12px;">www.vivytech.com</p>
				<p style="color: #666; font-size: 10px;">Request ID: ${requestId}</p>
				<p style="color: #666; font-size: 10px; margin-top: 15px;">
					<a href="https://bankingintelligenceapi.com/unsubscribe?token=${unsubscribeToken}" style="color: #666;">Unsubscribe from future communications</a>
				</p>
			</div>
		</div>
	</body>
	</html>`;
};

module.exports = {
	submitContactForm
};