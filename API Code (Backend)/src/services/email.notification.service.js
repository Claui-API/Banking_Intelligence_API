// src/services/email.notification.service.js
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

/**
 * Email notification service for sending system emails using Amazon SES
 */
class EmailNotificationService {
  constructor() {
    this.initialized = false;
    this.initializeService();
  }

  /**
   * Initialize the email service
   */
  async initializeService() {
    try {
      // Check if we're using SMTP credentials or AWS SDK directly
      if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        // Using SMTP credentials
        logger.info('Initializing email service with SMTP credentials');

        // We'll use nodemailer for SMTP
        const nodemailer = require('nodemailer');

        // Create reusable transporter
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });

        // Verify connection
        await this.transporter.verify();
        this.useSmtp = true;

      } else {
        // Using AWS SDK directly (recommended for EC2)
        logger.info('Initializing email service with AWS SDK');

        // Configure AWS SDK
        AWS.config.update({
          region: process.env.AWS_REGION || 'us-east-1'
          // Credentials will be automatically loaded from instance profile
          // when deployed to EC2, or from environment variables
        });

        // Create SES service object
        this.ses = new AWS.SES({ apiVersion: '2010-12-01' });
        this.useSmtp = false;
      }

      this.initialized = true;
      logger.info('Email notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email notification service:', error);
      this.initialized = false;
    }
  }

  /**
   * Send an email notification
   * @param {Object} options - Email options
   * @returns {Promise<Object>} - Send result
   */
  async sendEmail(options) {
    try {
      if (!this.initialized) {
        await this.initializeService();
        if (!this.initialized) {
          throw new Error('Email service not initialized');
        }
      }

      const { to, subject, text, html, attachments } = options;

      if (this.useSmtp) {
        // Send via SMTP
        const message = {
          from: process.env.EMAIL_FROM || `"API Service" <${process.env.EMAIL_USER}>`,
          to,
          subject,
          text,
          html
        };

        // Add attachments if provided
        if (attachments && Array.isArray(attachments)) {
          message.attachments = attachments;
        }

        const info = await this.transporter.sendMail(message);
        logger.info(`Email sent via SMTP: ${info.messageId}`);

        return {
          success: true,
          messageId: info.messageId,
          response: info.response
        };
      } else {
        // Send via AWS SES SDK
        const params = {
          Source: process.env.EMAIL_FROM || 'API Service <no-reply@yourdomain.com>',
          Destination: {
            ToAddresses: Array.isArray(to) ? to : [to]
          },
          Message: {
            Subject: {
              Data: subject
            },
            Body: {
              Text: { Data: text },
              Html: { Data: html }
            }
          }
        };

        const result = await this.ses.sendEmail(params).promise();
        logger.info(`Email sent via SES: ${result.MessageId}`);

        return {
          success: true,
          messageId: result.MessageId
        };
      }
    } catch (error) {
      logger.error('Error sending email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send registration notification
   * @param {Object} user - User object
   * @param {Object} client - Client object
   * @returns {Promise<Object>} - Send result
   */
  async sendRegistrationNotification(user, client) {
    const subject = 'Your Account Registration - Awaiting Approval';

    const text = `
      Hello ${user.name || user.email},
      
      Thank you for registering with our API service. Your account has been created successfully and is now awaiting administrator approval.
      
      Account Details:
      - Email: ${user.email}
      - Client Name: ${user.clientName || 'Default Client'}
      
      You will receive another email once your account has been approved. This process typically takes 1-2 business days.
      
      If you have any questions, please contact our support team.
      
      Thank you,
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to our API Service</h2>
        <p>Hello ${user.name || user.email},</p>
        
        <p>Thank you for registering with our API service. Your account has been created successfully and is now <strong>awaiting administrator approval</strong>.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Account Details</h3>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Client Name:</strong> ${user.clientName || 'Default Client'}</p>
        </div>
        
        <p>You will receive another email once your account has been approved. This process typically takes 1-2 business days.</p>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Thank you,<br>API Service Team</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send account approval notification
   * @param {Object} user - User object
   * @param {Object} client - Client object
   * @returns {Promise<Object>} - Send result
   */
  async sendAccountApprovalNotification(user, client) {
    const subject = 'Your Account Has Been Approved';

    const text = `
      Hello ${user.name || user.email},
      
      Great news! Your API service account has been approved by our administrators.
      
      You can now log in and start using our API services with the following credentials:
      
      - Email: ${user.email}
      - Client ID: ${client.clientId}
      
      Your client secret was provided during registration. If you've lost it, you can generate a new one from your account settings.
      
      Monthly API Call Quota: ${client.usageQuota || 'Unlimited'}
      
      Thank you for choosing our service.
      
      Best regards,
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Approved!</h2>
        <p>Hello ${user.name || user.email},</p>
        
        <p>Great news! Your API service account has been <strong style="color: #28a745;">approved</strong> by our administrators.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your API Credentials</h3>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Client ID:</strong> ${client.clientId}</p>
          <p><em>Your client secret was provided during registration. If you've lost it, you can generate a new one from your account settings.</em></p>
          <p><strong>Monthly API Call Quota:</strong> ${client.usageQuota || 'Unlimited'}</p>
        </div>
        
        <p>You can now log in and start using our API services.</p>
        
        <p>Thank you for choosing our service.</p>
        
        <p>Best regards,<br>API Service Team</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send API usage threshold notification
   * @param {Object} user - User object
   * @param {Object} client - Client object
   * @param {number} threshold - Threshold percentage reached
   * @returns {Promise<Object>} - Send result
   */
  async sendApiUsageNotification(user, client, threshold) {
    // Determine color based on threshold
    let thresholdColor = '#28a745'; // Green for lower thresholds
    if (threshold >= 90) {
      thresholdColor = '#dc3545'; // Red for high thresholds
    } else if (threshold >= 75) {
      thresholdColor = '#fd7e14'; // Orange for medium-high thresholds
    } else if (threshold >= 50) {
      thresholdColor = '#ffc107'; // Yellow for medium thresholds
    }

    const subject = `API Usage Alert: ${threshold}% of Monthly Quota Reached`;

    const text = `
      Hello ${user.name || user.email},
      
      This is an automated notification to inform you that you have reached ${threshold}% of your monthly API usage quota.
      
      Current Usage: ${client.usageCount} API calls
      Monthly Quota: ${client.usageQuota} API calls
      Usage Period: ${new Date(client.resetDate).toLocaleDateString()}
      
      If you anticipate needing additional API calls this month, please contact our support team to discuss increasing your quota.
      
      Thank you,
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>API Usage Alert</h2>
        <p>Hello ${user.name || user.email},</p>
        
        <p>This is an automated notification to inform you that you have reached <strong style="color: ${thresholdColor};">${threshold}%</strong> of your monthly API usage quota.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Usage Details</h3>
          <p><strong>Current Usage:</strong> ${client.usageCount} API calls</p>
          <p><strong>Monthly Quota:</strong> ${client.usageQuota} API calls</p>
          <p><strong>Usage Period:</strong> Reset on ${new Date(client.resetDate).toLocaleDateString()}</p>
          
          <div style="background-color: #e9ecef; height: 24px; border-radius: 12px; margin-top: 15px;">
            <div style="background-color: ${thresholdColor}; width: ${threshold}%; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; color: white; font-weight: bold;">
              ${threshold}%
            </div>
          </div>
        </div>
        
        <p>If you anticipate needing additional API calls this month, please contact our support team to discuss increasing your quota.</p>
        
        <p>Thank you,<br>API Service Team</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send API quota exceeded notification
   * @param {Object} user - User object
   * @param {Object} client - Client object
   * @returns {Promise<Object>} - Send result
   */
  async sendApiQuotaExceededNotification(user, client) {
    const subject = 'API Usage Alert: Monthly Quota Exceeded';

    const text = `
      Hello ${user.name || user.email},
      
      This is an automated notification to inform you that you have reached 100% of your monthly API usage quota.
      
      Current Usage: ${client.usageCount} API calls
      Monthly Quota: ${client.usageQuota} API calls
      
      Your API access has been temporarily paused until your quota resets on ${new Date(client.resetDate).toLocaleDateString()}.
      
      If you need immediate access, please contact our support team to discuss increasing your quota.
      
      Thank you,
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>API Quota Exceeded</h2>
        <p>Hello ${user.name || user.email},</p>
        
        <p>This is an automated notification to inform you that you have reached <strong style="color: #dc3545;">100%</strong> of your monthly API usage quota.</p>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p><strong>Your API access has been temporarily paused</strong> until your quota resets on ${new Date(client.resetDate).toLocaleDateString()}.</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Usage Details</h3>
          <p><strong>Current Usage:</strong> ${client.usageCount} API calls</p>
          <p><strong>Monthly Quota:</strong> ${client.usageQuota} API calls</p>
          
          <div style="background-color: #e9ecef; height: 24px; border-radius: 12px; margin-top: 15px;">
            <div style="background-color: #dc3545; width: 100%; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; color: white; font-weight: bold;">
              100%
            </div>
          </div>
        </div>
        
        <p>If you need immediate access, please contact our support team to discuss increasing your quota.</p>
        
        <p>Thank you,<br>API Service Team</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send account status change notification
   * @param {Object} user - User object
   * @param {Object} client - Client object
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} - Send result
   */
  async sendAccountStatusChangeNotification(user, client, status, reason) {
    let subject, text, html;

    if (status === 'suspended') {
      subject = 'Your Account Has Been Suspended';

      text = `
        Hello ${user.name || user.email},
        
        We're writing to inform you that your API service account has been suspended.
        
        Reason: ${reason || 'A review of your account activity has led to this decision.'}
        
        If you believe this is an error or would like to discuss restoring your access, please contact our support team.
        
        Account Details:
        - Email: ${user.email}
        - Client ID: ${client.clientId}
        
        Thank you for your understanding.
        
        Regards,
        API Service Team
      `;

      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Account Suspended</h2>
          <p>Hello ${user.name || user.email},</p>
          
          <p>We're writing to inform you that your API service account has been <strong style="color: #dc3545;">suspended</strong>.</p>
          
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Reason:</strong> ${reason || 'A review of your account activity has led to this decision.'}</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Account Details</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Client ID:</strong> ${client.clientId}</p>
          </div>
          
          <p>If you believe this is an error or would like to discuss restoring your access, please contact our support team.</p>
          
          <p>Thank you for your understanding.</p>
          
          <p>Regards,<br>API Service Team</p>
        </div>
      `;
    } else if (status === 'active') {
      subject = 'Your Account Has Been Activated';

      text = `
        Hello ${user.name || user.email},
        
        We're pleased to inform you that your API service account has been activated.
        
        You can now use your API credentials to access our services.
        
        Account Details:
        - Email: ${user.email}
        - Client ID: ${client.clientId}
        
        If you have any questions about using our API, please refer to our documentation or contact our support team.
        
        Thank you for choosing our service.
        
        Best regards,
        API Service Team
      `;

      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Account Activated</h2>
          <p>Hello ${user.name || user.email},</p>
          
          <p>We're pleased to inform you that your API service account has been <strong style="color: #28a745;">activated</strong>.</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p>You can now use your API credentials to access our services.</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Account Details</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Client ID:</strong> ${client.clientId}</p>
          </div>
          
          <p>If you have any questions about using our API, please refer to our documentation or contact our support team.</p>
          
          <p>Thank you for choosing our service.</p>
          
          <p>Best regards,<br>API Service Team</p>
        </div>
      `;
    } else {
      subject = `Your Account Status Has Changed: ${status}`;

      text = `
        Hello ${user.name || user.email},
        
        We're writing to inform you that your API service account status has been changed to: ${status}.
        
        ${reason ? `Reason: ${reason}` : ''}
        
        Account Details:
        - Email: ${user.email}
        - Client ID: ${client.clientId}
        
        If you have any questions, please contact our support team.
        
        Regards,
        API Service Team
      `;

      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Account Status Changed</h2>
          <p>Hello ${user.name || user.email},</p>
          
          <p>We're writing to inform you that your API service account status has been changed to: <strong>${status}</strong>.</p>
          
          ${reason ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          ` : ''}
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Account Details</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Client ID:</strong> ${client.clientId}</p>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <p>Regards,<br>API Service Team</p>
        </div>
      `;
    }

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send monthly usage summary
   * @param {Object} user - User object
   * @param {Object} data - Usage data
   * @returns {Promise<Object>} - Send result
   */
  async sendMonthlyUsageSummary(user, data) {
    // Determine color based on usage percentage
    let usageColor = '#28a745'; // Green for low usage
    if (data.usagePercentage >= 90) {
      usageColor = '#dc3545'; // Red for high usage
    } else if (data.usagePercentage >= 75) {
      usageColor = '#fd7e14'; // Orange for medium-high usage
    } else if (data.usagePercentage >= 50) {
      usageColor = '#ffc107'; // Yellow for medium usage
    }

    const subject = 'Monthly API Usage Summary';

    const text = `
      Hello ${user.name || user.email},
      
      Here's your monthly API usage summary:
      
      Period: ${new Date(data.period.start).toLocaleDateString()} to ${new Date(data.period.end).toLocaleDateString()}
      
      Total API Calls: ${data.previousUsage}
      Monthly Quota: ${data.client.usageQuota}
      Usage Percentage: ${data.usagePercentage}%
      
      Your quota has been reset for the new billing cycle. Your next reset will occur on ${new Date(data.nextResetDate).toLocaleDateString()}.
      
      Thank you for using our API service.
      
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Monthly API Usage Summary</h2>
        <p>Hello ${user.name || user.email},</p>
        
        <p>Here's your monthly API usage summary:</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Usage Period</h3>
          <p>${new Date(data.period.start).toLocaleDateString()} to ${new Date(data.period.end).toLocaleDateString()}</p>
          
          <h3>Usage Statistics</h3>
          <p><strong>Total API Calls:</strong> ${data.previousUsage}</p>
          <p><strong>Monthly Quota:</strong> ${data.client.usageQuota}</p>
          <p><strong>Usage Percentage:</strong> <span style="color: ${usageColor}; font-weight: bold;">${data.usagePercentage}%</span></p>
          
          <div style="background-color: #e9ecef; height: 24px; border-radius: 12px; margin-top: 15px;">
            <div style="background-color: ${usageColor}; width: ${Math.min(data.usagePercentage, 100)}%; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; color: white; font-weight: bold;">
              ${data.usagePercentage}%
            </div>
          </div>
        </div>
        
        <div style="background-color: #e7f5e7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
          <p><strong>Your quota has been reset for the new billing cycle.</strong></p>
          <p>Your next reset will occur on ${new Date(data.nextResetDate).toLocaleDateString()}.</p>
        </div>
        
        <p>Thank you for using our API service.</p>
        
        <p>API Service Team</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }
}

module.exports = new EmailNotificationService();