// simple-test.js
require('dotenv').config();
const AWS = require('aws-sdk');

// Get recipient email from command line argument or use default
const recipientEmail = process.argv[2] || 'sreenivas@vivytech.com';

async function sendSimpleEmail() {
	try {
		console.log(`Sending a test email to: ${recipientEmail}`);

		// Configure AWS SDK with explicit credentials
		AWS.config.update({
			region: process.env.AWS_REGION || 'us-east-2',
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
		});

		// Create SES service object
		const ses = new AWS.SES({ apiVersion: '2010-12-01' });

		// Check if in sandbox mode
		const accountAttributes = await ses.getAccountSendingEnabled().promise();
		const isSendingEnabled = accountAttributes.Enabled;

		if (isSendingEnabled) {
			console.log('Email sending is enabled for your account');

			// Check account status
			try {
				const sendingStats = await ses.getSendStatistics().promise();
				console.log('Account status:', sendingStats);
			} catch (statsError) {
				console.log('Could not retrieve sending statistics:', statsError.message);
			}
		} else {
			console.log('WARNING: Email sending is disabled for your account');
		}

		// Check if recipient is verified (for sandbox mode)
		try {
			const verifiedAddresses = await ses.listVerifiedEmailAddresses().promise();
			const isRecipientVerified = verifiedAddresses.VerifiedEmailAddresses.includes(recipientEmail);

			if (!isRecipientVerified) {
				console.log(`WARNING: ${recipientEmail} is not verified. If your account is in sandbox mode, the email will be rejected.`);
				console.log('Verified addresses:', verifiedAddresses.VerifiedEmailAddresses);
			} else {
				console.log(`Recipient ${recipientEmail} is verified.`);
			}
		} catch (verifyError) {
			console.log('Could not check if recipient is verified:', verifyError.message);
		}

		// Parameters for sending email
		const params = {
			Source: 'Banking Intelligence API Service <sreenivas@vivytech.com>', // Properly formatted sender
			Destination: {
				ToAddresses: [recipientEmail]
			},
			Message: {
				Subject: {
					Data: 'SES Test Email'
				},
				Body: {
					Text: {
						Data: 'This is a test email sent from your API service using Amazon SES.'
					},
					Html: {
						Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Amazon SES Test</h2>
                <p>This is a test email from your API service to verify that Amazon SES is working correctly.</p>
                <p>If you're receiving this email, your SES configuration is correct!</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Server Time:</strong> ${new Date().toISOString()}</p>
                </div>
              </div>
            `
					}
				}
			}
		};

		// Send email
		console.log('Sending email...');
		const result = await ses.sendEmail(params).promise();
		console.log('Email sent successfully!');
		console.log('Message ID:', result.MessageId);

	} catch (error) {
		console.error('Error sending email:', error);

		if (error.code === 'MessageRejected') {
			console.error('\nIMPORTANT: Your email was rejected. Common causes:');
			console.error('1. Your SES account is in sandbox mode and the recipient email is not verified');
			console.error('2. The "From" address is not a verified identity in SES');
		}
	}
}

sendSimpleEmail();