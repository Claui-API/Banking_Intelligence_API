// src/controllers/admin.controller.js - Enhanced version with reject functionality
const { User, Client } = require('../models');
const { Token } = require('../models');
const logger = require('../utils/logger');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { EmailSuppression } = require('../models');
const { ContactSubmission } = require('../models');
const { removeFromSuppressionList } = require('../services/suppression.service');
const AWS = require('aws-sdk');

// Configure SES for sending test emails
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2'
});

/**
 * Controller for admin operations
 */
class AdminController {
  /**
   * List all clients with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listClients(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const status = req.query.status || null;

      const where = {};
      if (status) {
        where.status = status;
      }

      const { count, rows: clients } = await Client.findAndCountAll({
        where,
        include: [
          { model: User, attributes: ['id', 'clientName', 'email'] },
          { model: User, as: 'Approver', attributes: ['id', 'email'], required: false }
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      // Format client data for response
      const formattedClients = clients.map(client => ({
        id: client.id,
        clientId: client.clientId,
        status: client.status,
        user: {
          id: client.User.id,
          name: client.User.clientName,
          email: client.User.email
        },
        description: client.description,
        createdAt: client.createdAt,
        usageQuota: client.usageQuota,
        usageCount: client.usageCount,
        approvedBy: client.Approver ? client.Approver.email : null,
        approvedAt: client.approvedAt,
        lastUsedAt: client.lastUsedAt
      }));

      return res.status(200).json({
        success: true,
        data: {
          clients: formattedClients,
          pagination: {
            total: count,
            page,
            limit,
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error listing clients:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve clients',
        error: error.message
      });
    }
  }

  /**
   * Get client details by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getClient(req, res) {
    try {
      const { clientId } = req.params;

      const client = await Client.findOne({
        where: { clientId },
        include: [
          { model: User, attributes: ['id', 'clientName', 'email', 'status'] },
          { model: User, as: 'Approver', attributes: ['id', 'email'], required: false }
        ]
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Get token statistics
      const tokenCount = await Token.count({
        where: { clientId: client.clientId }
      });

      // Format response
      const clientData = {
        id: client.id,
        clientId: client.clientId,
        status: client.status,
        user: {
          id: client.User.id,
          name: client.User.clientName,
          email: client.User.email,
          status: client.User.status
        },
        description: client.description,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        usageQuota: client.usageQuota,
        usageCount: client.usageCount,
        resetDate: client.resetDate,
        approvedBy: client.Approver ? client.Approver.email : null,
        approvedAt: client.approvedAt,
        lastUsedAt: client.lastUsedAt,
        tokenCount: tokenCount
      };

      return res.status(200).json({
        success: true,
        data: clientData
      });
    } catch (error) {
      logger.error('Error getting client details:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve client details',
        error: error.message
      });
    }
  }

  /**
   * Approve a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async approveClient(req, res) {
    try {
      const { clientId } = req.params;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId },
        include: [{ model: User }] // Include the user data for notifications
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      if (client.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Client is already approved'
        });
      }

      // Update client status
      client.status = 'active';
      client.approvedBy = adminId;
      client.approvedAt = new Date();
      await client.save();

      logger.info(`Client ${clientId} approved by admin ${adminId}`);

      // Send approval notification
      try {
        if (client.User) {
          let notificationService;
          try {
            notificationService = require('../services/notification.service.unified');
            logger.info('Notification service loaded successfully for approval notification');
          } catch (importError) {
            logger.error(`Failed to import notification service: ${importError.message}`);
            try {
              notificationService = require('./notification.service.unified');
              logger.info('Notification service loaded from alternate path');
            } catch (secondImportError) {
              logger.error(`Failed to import notification service from alternate path: ${secondImportError.message}`);
            }
          }

          if (notificationService) {
            logger.info(`Attempting to send approval email to ${client.User.email}`);
            const result = await notificationService.sendAccountApprovalNotification(client.User, client);
            logger.info('Approval notification result:', result);
          }
        } else {
          logger.warn(`No user found for client ${clientId}, cannot send approval notification`);
        }
      } catch (notificationError) {
        logger.error(`Failed to send approval notification: ${notificationError.message}`);
        // Don't block the approval process if notification fails
      }

      return res.status(200).json({
        success: true,
        message: 'Client approved successfully',
        data: {
          clientId: client.clientId,
          status: client.status,
          approvedAt: client.approvedAt
        }
      });
    } catch (error) {
      logger.error('Error approving client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve client',
        error: error.message
      });
    }
  }

  /**
  * Reject a pending client and delete from database (HARD DELETE)
  * @param {Object} req - Express request object
  * @param {Object} res - Express response object
  */
  async rejectClient(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { clientId } = req.params;
      const { reason } = req.body;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId },
        include: [{ model: User }],
        paranoid: false, // Include soft-deleted records in search
        transaction
      });

      if (!client) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      if (client.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Only pending clients can be rejected'
        });
      }

      // Store client and user info before deletion
      const clientInfo = {
        clientId: client.clientId,
        userName: client.User.clientName,
        userEmail: client.User.email,
        description: client.description
      };

      // Delete associated tokens first (force hard delete)
      await Token.destroy({
        where: { clientId: client.clientId },
        force: true, // Hard delete tokens
        transaction
      });

      // HARD DELETE the client (not soft delete)
      await client.destroy({
        transaction,
        force: true // This bypasses paranoid mode and actually deletes
      });

      // Delete the user if they have no other clients
      const otherClients = await Client.count({
        where: { userId: client.User.id },
        paranoid: false, // Count both active and soft-deleted clients
        transaction
      });

      if (otherClients === 0) {
        // HARD DELETE the user
        await client.User.destroy({
          transaction,
          force: true // Hard delete user too
        });
      }

      await transaction.commit();

      logger.info(`Client ${clientId} HARD DELETED by admin ${adminId}`, { reason, clientInfo });

      // Send rejection notification email
      try {
        await this.sendRejectionNotification(clientInfo, reason);
        logger.info(`Rejection notification sent to ${clientInfo.userEmail}`);
      } catch (notificationError) {
        logger.error(`Failed to send rejection notification: ${notificationError.message}`);
        // Don't fail the rejection if email fails
      }

      return res.status(200).json({
        success: true,
        message: 'Client rejected and permanently deleted',
        data: {
          clientId: clientInfo.clientId,
          userEmail: clientInfo.userEmail,
          deletedAt: new Date()
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error rejecting client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reject client',
        error: error.message
      });
    }
  }

  /**
   * Send rejection notification email
   * @param {Object} clientInfo - Client information
   * @param {string} reason - Rejection reason
   */
  async sendRejectionNotification(clientInfo, reason) {
    const subject = 'Your API Access Request Has Been Rejected';

    const text = `
      Hello ${clientInfo.userName || clientInfo.userEmail},
      
      We regret to inform you that your API access request has been rejected by our administrators.
      
      Application Details:
      - Email: ${clientInfo.userEmail}
      - Application Description: ${clientInfo.description || 'N/A'}
      - Rejection Reason: ${reason || 'No specific reason provided'}
      
      If you believe this decision was made in error or if you have additional information to support your request, please contact our support team.
      
      You may reapply for API access in the future by creating a new account.
      
      Thank you for your interest in our API service.
      
      Best regards,
      API Service Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000000; color: #ffffff; padding: 20px;">
        <div style="background-color: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #dc3545;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; font-size: 24px;">Banking Intelligence API</h1>
            <h2 style="color: #ffffff; font-size: 18px;">Application Rejected</h2>
          </div>
          
          <p>Hello ${clientInfo.userName || clientInfo.userEmail},</p>
          
          <p>We regret to inform you that your API access request has been <strong style="color: #dc3545;">rejected</strong> by our administrators.</p>
          
          <div style="background-color: #2d1b1b; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin-top: 0; color: #ffffff;">Application Details</h3>
            <p><strong>Email:</strong> ${clientInfo.userEmail}</p>
            <p><strong>Application Description:</strong> ${clientInfo.description || 'N/A'}</p>
            <p><strong>Rejection Reason:</strong> ${reason || 'No specific reason provided'}</p>
          </div>
          
          <p>If you believe this decision was made in error or if you have additional information to support your request, please contact our support team.</p>
          
          <p>You may reapply for API access in the future by creating a new account.</p>
          
          <p>Thank you for your interest in our API service.</p>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dc3545;">
            <p style="color: #dc3545; font-size: 12px;">Banking Intelligence API</p>
            <p style="color: #dc3545; font-size: 12px;">Vivy Tech USA, Inc.</p>
          </div>
        </div>
      </div>
    `;

    const emailParams = {
      Source: process.env.VERIFIED_SENDER_EMAIL || 'shreyas.atneu@gmail.com',
      Destination: {
        ToAddresses: [clientInfo.userEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8'
          },
          Text: {
            Data: text,
            Charset: 'UTF-8'
          }
        }
      },
      Tags: [
        { Name: 'Type', Value: 'RejectionNotification' },
        { Name: 'Source', Value: 'AdminPanel' }
      ]
    };

    return ses.sendEmail(emailParams).promise();
  }

  /**
   * Suspend a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async suspendClient(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { clientId } = req.params;
      const { reason } = req.body;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId },
        include: [{ model: User }],
        transaction
      });

      if (!client) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Update client status
      client.status = 'suspended';
      await client.save({ transaction });

      // Mark user for deletion (suspension leads to eventual deletion)
      const user = client.User;
      if (user) {
        user.status = 'inactive';
        user.markedForDeletionAt = new Date();
        await user.save({ transaction });
      }

      // Revoke all active tokens for this client
      await Token.update(
        { isRevoked: true },
        { where: { clientId, isRevoked: false }, transaction }
      );

      await transaction.commit();

      logger.info(`Client ${clientId} suspended by admin ${adminId}`, { reason });

      return res.status(200).json({
        success: true,
        message: 'Client suspended and marked for deletion',
        data: {
          clientId: client.clientId,
          status: client.status,
          userStatus: user?.status,
          markedForDeletionAt: user?.markedForDeletionAt
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error suspending client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to suspend client',
        error: error.message
      });
    }
  }

  /**
   * Revoke a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeClient(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { clientId } = req.params;
      const { reason } = req.body;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId },
        include: [{ model: User }],
        transaction
      });

      if (!client) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Update client status
      client.status = 'revoked';
      await client.save({ transaction });

      // Mark user for deletion (revocation leads to eventual deletion)
      const user = client.User;
      if (user) {
        user.status = 'inactive';
        user.markedForDeletionAt = new Date();
        await user.save({ transaction });
      }

      // Revoke all tokens for this client
      await Token.update(
        { isRevoked: true },
        { where: { clientId }, transaction }
      );

      await transaction.commit();

      logger.info(`Client ${clientId} revoked by admin ${adminId}`, { reason });

      return res.status(200).json({
        success: true,
        message: 'Client revoked and marked for deletion',
        data: {
          clientId: client.clientId,
          status: client.status,
          userStatus: user?.status,
          markedForDeletionAt: user?.markedForDeletionAt
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error revoking client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to revoke client',
        error: error.message
      });
    }
  }

  /**
   * Update client quota
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateClientQuota(req, res) {
    try {
      const { clientId } = req.params;
      const { usageQuota } = req.body;
      const adminId = req.auth.userId;

      if (!usageQuota || isNaN(parseInt(usageQuota)) || parseInt(usageQuota) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid usage quota. Must be a positive number.'
        });
      }

      const client = await Client.findOne({
        where: { clientId }
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Update client quota
      client.usageQuota = parseInt(usageQuota);
      await client.save();

      logger.info(`Client ${clientId} quota updated to ${usageQuota} by admin ${adminId}`);

      return res.status(200).json({
        success: true,
        message: 'Client quota updated successfully',
        data: {
          clientId: client.clientId,
          usageQuota: client.usageQuota
        }
      });
    } catch (error) {
      logger.error('Error updating client quota:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update client quota',
        error: error.message
      });
    }
  }

  /**
   * Reset client usage counter
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async resetClientUsage(req, res) {
    try {
      const { clientId } = req.params;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId }
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Reset usage count and set new reset date
      const oldCount = client.usageCount;
      client.usageCount = 0;

      // Set reset date to the first day of next month
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);
      client.resetDate = resetDate;

      await client.save();

      logger.info(`Client ${clientId} usage reset from ${oldCount} to 0 by admin ${adminId}`);

      return res.status(200).json({
        success: true,
        message: 'Client usage reset successfully',
        data: {
          clientId: client.clientId,
          usageCount: 0,
          previousCount: oldCount,
          resetDate: client.resetDate
        }
      });
    } catch (error) {
      logger.error('Error resetting client usage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset client usage',
        error: error.message
      });
    }
  }

  /**
   * Get system statistics for admin dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSystemStats(req, res) {
    try {
      // Get user counts
      const totalUsers = await User.count();
      const activeUsers = await User.count({ where: { status: 'active' } });

      // Get client counts
      const totalClients = await Client.count();
      const clientsByStatus = await Client.findAll({
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
        group: ['status']
      });

      // Format client status counts
      const clientStatus = {};
      clientsByStatus.forEach(item => {
        clientStatus[item.status] = parseInt(item.dataValues.count);
      });

      // Get token counts
      const totalTokens = await Token.count();
      const activeTokens = await Token.count({ where: { isRevoked: false } });

      // Get usage stats
      const totalUsage = await Client.sum('usageCount');

      // Get recent activity
      const recentClients = await Client.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [{ model: User, attributes: ['clientName', 'email'] }]
      });

      return res.status(200).json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers
          },
          clients: {
            total: totalClients,
            byStatus: clientStatus
          },
          tokens: {
            total: totalTokens,
            active: activeTokens
          },
          usage: {
            total: totalUsage || 0
          },
          recentActivity: {
            clients: recentClients.map(client => ({
              clientId: client.clientId,
              status: client.status,
              userName: client.User.clientName,
              userEmail: client.User.email,
              createdAt: client.createdAt
            }))
          }
        }
      });
    } catch (error) {
      logger.error('Error getting system stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve system statistics',
        error: error.message
      });
    }
  }
  /**
* Reinstate a suspended client
* @param {Object} req - Express request object
* @param {Object} res - Express response object
*/
  async reinstateClient(req, res) {
    try {
      const { clientId } = req.params;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId }
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      if (client.status !== 'suspended' && client.status !== 'revoked') {
        return res.status(400).json({
          success: false,
          message: `Client status is ${client.status} not suspended or revoked`
        });
      }

      // Update client status to active
      client.status = 'active';
      client.approvedBy = adminId;
      client.approvedAt = new Date();
      await client.save();

      logger.info(`Client ${clientId} reinstated by admin ${adminId}`);

      return res.status(200).json({
        success: true,
        message: 'Client reinstated successfully',
        data: {
          clientId: client.clientId,
          status: client.status,
          approvedAt: client.approvedAt
        }
      });
    } catch (error) {
      logger.error('Error reinstating client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reinstate client',
        error: error.message
      });
    }
  }

  /**
 * Delete a client from the database (HARD DELETE)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
  async deleteClient(req, res) {
    try {
      const { clientId } = req.params;
      const adminId = req.auth.userId;

      const client = await Client.findOne({
        where: { clientId },
        paranoid: false // Include soft-deleted records
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Only allow deletion of revoked clients for safety
      if (client.status !== 'revoked') {
        return res.status(400).json({
          success: false,
          message: 'Only revoked clients can be deleted. Please revoke the client first.'
        });
      }

      // Get client for logging purposes before deletion
      const clientInfo = {
        clientId: client.clientId,
        userId: client.userId
      };

      // Start a transaction
      const transaction = await sequelize.transaction();

      try {
        // Delete any associated tokens first (force hard delete)
        await Token.destroy({
          where: { clientId: client.clientId },
          force: true, // Hard delete tokens
          transaction
        });

        // HARD DELETE the client (not soft delete)
        await client.destroy({
          transaction,
          force: true // This bypasses paranoid mode
        });

        await transaction.commit();

        logger.info(`Client ${clientId} HARD DELETED by admin ${adminId}`, clientInfo);

        return res.status(200).json({
          success: true,
          message: 'Client permanently deleted'
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Error deleting client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete client',
        error: error.message
      });
    }
  }

  /**
   * Get email system statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmailStats(req, res) {
    try {
      // Get suppression statistics
      const suppressionStats = await EmailSuppression.findAll({
        attributes: [
          'reason',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: { isActive: true },
        group: ['reason'],
        raw: true
      });

      // Calculate totals
      let totalSuppressed = 0;
      const byReason = {};
      suppressionStats.forEach(stat => {
        const count = parseInt(stat.count);
        byReason[stat.reason] = count;
        totalSuppressed += count;
      });

      // Get AWS SES sending statistics
      let sesStats = {};
      try {
        const sendingQuota = await ses.getSendQuota().promise();
        const sendingStats = await ses.getSendStatistics().promise();

        // Calculate rates from recent data
        const recentStats = sendingStats.SendDataPoints.slice(-7); // Last 7 data points
        const totalSent = recentStats.reduce((sum, point) => sum + point.DeliveryAttempts, 0);
        const totalBounces = recentStats.reduce((sum, point) => sum + point.Bounces, 0);
        const totalComplaints = recentStats.reduce((sum, point) => sum + point.Complaints, 0);

        sesStats = {
          quota: sendingQuota.Max24HourSend,
          sent_last_24h: sendingQuota.SentLast24Hours,
          max_send_rate: sendingQuota.MaxSendRate,
          total_sent: totalSent,
          total_bounces: totalBounces,
          total_complaints: totalComplaints,
          bounce_rate: totalSent > 0 ? (totalBounces / totalSent) * 100 : 0,
          complaint_rate: totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0
        };
      } catch (sesError) {
        logger.warn('Could not fetch SES statistics', { error: sesError.message });
        sesStats = {
          quota: 0,
          sent_last_24h: 0,
          max_send_rate: 0,
          total_sent: 0,
          total_bounces: 0,
          total_complaints: 0,
          bounce_rate: 0,
          complaint_rate: 0
        };
      }

      return res.json({
        success: true,
        data: {
          ...sesStats,
          total_suppressed: totalSuppressed,
          suppressed_by_reason: byReason,
          last_updated: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error fetching email statistics', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch email statistics',
        error: error.message
      });
    }
  }

  /**
   * Get list of suppressed email addresses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSuppressedEmails(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = (page - 1) * limit;

      const { count, rows } = await EmailSuppression.findAndCountAll({
        where: { isActive: true },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        attributes: ['id', 'email', 'reason', 'source', 'createdAt', 'metadata']
      });

      return res.json({
        success: true,
        data: {
          emails: rows,
          pagination: {
            page,
            limit,
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching suppressed emails', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch suppressed emails',
        error: error.message
      });
    }
  }

  /**
   * Reactivate a suppressed email address
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async reactivateEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const success = await removeFromSuppressionList(email, 'admin_reactivation');

      if (success) {
        logger.info('Email reactivated by admin', {
          email,
          adminId: req.auth.userId,
          adminEmail: req.auth.userEmail || 'admin'
        });

        return res.json({
          success: true,
          message: `Email ${email} has been reactivated`,
          data: {
            email,
            reactivated_at: new Date().toISOString()
          }
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Email address not found in suppression list or already active'
        });
      }

    } catch (error) {
      logger.error('Error reactivating email', {
        error: error.message,
        email: req.body.email
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to reactivate email address',
        error: error.message
      });
    }
  }

  /**
   * Send a test email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendTestEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const adminEmail = req.auth.userEmail || req.auth.email || 'admin';

      const testEmailParams = {
        Source: process.env.VERIFIED_SENDER_EMAIL || 'shreyas.atneu@gmail.com',
        Destination: {
          ToAddresses: [email]
        },
        Message: {
          Subject: {
            Data: 'Banking Intelligence API - Test Email',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Test Email</title>
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #000000; color: #ffffff; padding: 20px;">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #28a745;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #28a745; font-size: 24px;">Banking Intelligence API</h1>
                      <h2 style="color: #ffffff; font-size: 18px;">Email System Test</h2>
                    </div>
                    
                    <div style="background-color: #0f1a0f; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <p>This is a test email sent from the Banking Intelligence API email monitoring system.</p>
                      
                      <p><strong>Test Details:</strong></p>
                      <ul>
                        <li>Sent at: ${new Date().toISOString()}</li>
                        <li>Sent by: Admin (${adminEmail})</li>
                        <li>Recipient: ${email}</li>
                        <li>System: ${process.env.NODE_ENV || 'development'}</li>
                      </ul>
                      
                      <p>If you received this email, the Banking Intelligence email system is working correctly!</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #28a745;">
                      <p style="color: #28a745; font-size: 12px;">Banking Intelligence API</p>
                      <p style="color: #28a745; font-size: 12px;">Vivy Tech USA, Inc.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
              Charset: 'UTF-8'
            },
            Text: {
              Data: `Banking Intelligence API - Test Email

This is a test email sent from the Banking Intelligence API email monitoring system.

Test Details:
- Sent at: ${new Date().toISOString()}
- Sent by: Admin (${adminEmail})
- Recipient: ${email}
- System: ${process.env.NODE_ENV || 'development'}

If you received this email, the Banking Intelligence email system is working correctly!

---
Banking Intelligence API
Vivy Tech USA, Inc.`,
              Charset: 'UTF-8'
            }
          }
        },
        Tags: [
          { Name: 'Type', Value: 'TestEmail' },
          { Name: 'Source', Value: 'AdminPanel' }
        ]
      };

      const result = await ses.sendEmail(testEmailParams).promise();

      logger.info('Admin test email sent', {
        messageId: result.MessageId,
        recipient: email,
        adminId: req.auth.userId,
        adminEmail: adminEmail
      });

      return res.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
        data: {
          message_id: result.MessageId,
          sent_at: new Date().toISOString(),
          recipient: email
        }
      });

    } catch (error) {
      logger.error('Error sending test email', {
        error: error.message,
        code: error.code,
        email: req.body.email,
        adminId: req.auth?.userId
      });

      let errorMessage = 'Failed to send test email';
      if (error.code === 'MessageRejected') {
        if (error.message.includes('not verified')) {
          errorMessage = 'Test email could not be sent - recipient or sender email not verified in SES';
        } else {
          errorMessage = 'Test email was rejected by AWS SES';
        }
      }

      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get contact form statistics using the ContactSubmission model
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async getContactFormStats(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const { Op } = require('sequelize');

      // Calculate date ranges
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Get period statistics
      const periodStats = await ContactSubmission.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_submissions'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'success' THEN 1 END")), 'successful_sends'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'partial_success' THEN 1 END")), 'partial_success'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'spam_blocked' THEN 1 END")), 'spam_blocked'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'rate_limited' THEN 1 END")), 'rate_limited'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'failed_sends'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'validation_failed' THEN 1 END")), 'validation_failed'],
          [sequelize.fn('AVG', sequelize.col('processingTimeMs')), 'avg_processing_time'],
          [sequelize.fn('AVG', sequelize.col('suspicionScore')), 'avg_suspicion_score']
        ],
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        raw: true
      });

      const stats = periodStats[0] || {};

      // Convert strings to numbers and calculate rates
      const totalSubmissions = parseInt(stats.total_submissions) || 0;
      const successfulSends = parseInt(stats.successful_sends) || 0;
      const partialSuccess = parseInt(stats.partial_success) || 0;
      const spamBlocked = parseInt(stats.spam_blocked) || 0;
      const rateLimited = parseInt(stats.rate_limited) || 0;
      const failedSends = parseInt(stats.failed_sends) || 0;
      const validationFailed = parseInt(stats.validation_failed) || 0;

      // Calculate success rate (including partial successes as they still send business email)
      const totalSuccessful = successfulSends + partialSuccess;
      const successRate = totalSubmissions > 0 ? ((totalSuccessful / totalSubmissions) * 100).toFixed(1) : 0;
      const spamRate = totalSubmissions > 0 ? ((spamBlocked / totalSubmissions) * 100).toFixed(1) : 0;

      // Get today's statistics
      const todayStats = await ContactSubmission.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_submissions'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status IN ('success', 'partial_success') THEN 1 END")), 'successful_sends']
        ],
        where: {
          createdAt: { [Op.gte]: todayStart }
        },
        raw: true
      });

      const todayData = todayStats[0] || {};
      const todayTotal = parseInt(todayData.total_submissions) || 0;
      const todaySuccessful = parseInt(todayData.successful_sends) || 0;

      // Get recent submissions for activity feed
      const recentSubmissions = await ContactSubmission.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'requestId', 'name', 'email', 'company', 'status', 'createdAt', 'suspicionScore'],
        where: {
          createdAt: { [Op.gte]: startDate }
        }
      });

      // Get hourly distribution for the last 24 hours
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const hourlyStats = await ContactSubmission.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('createdAt')), 'hour'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'submissions']
        ],
        where: {
          createdAt: { [Op.gte]: last24Hours }
        },
        group: [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('createdAt'))],
        order: [[sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('createdAt')), 'ASC']],
        raw: true
      });

      // Get top suspicious IPs
      const suspiciousIPs = await ContactSubmission.findAll({
        attributes: [
          'ipAddress',
          [sequelize.fn('COUNT', sequelize.col('id')), 'submission_count'],
          [sequelize.fn('AVG', sequelize.col('suspicionScore')), 'avg_suspicion'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'spam_blocked' THEN 1 END")), 'spam_count']
        ],
        where: {
          createdAt: { [Op.gte]: startDate },
          ipAddress: { [Op.ne]: null },
          [Op.or]: [
            { suspicionScore: { [Op.gte]: 2 } },
            { status: 'spam_blocked' }
          ]
        },
        group: ['ipAddress'],
        having: sequelize.literal('COUNT(id) > 1'),
        order: [[sequelize.fn('AVG', sequelize.col('suspicionScore')), 'DESC']],
        limit: 10,
        raw: true
      });

      // Get status breakdown over time (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const statusTrends = await ContactSubmission.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt')), 'date'],
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          createdAt: { [Op.gte]: weekAgo }
        },
        group: [
          sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt')),
          'status'
        ],
        order: [[sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt')), 'ASC']],
        raw: true
      });

      return res.json({
        success: true,
        data: {
          period_stats: {
            total_submissions: totalSubmissions,
            successful_sends: successfulSends,
            partial_success: partialSuccess,
            spam_blocked: spamBlocked,
            rate_limited: rateLimited,
            failed_sends: failedSends,
            validation_failed: validationFailed,
            success_rate: parseFloat(successRate),
            spam_rate: parseFloat(spamRate),
            avg_processing_time: stats.avg_processing_time ? Math.round(parseFloat(stats.avg_processing_time)) : null,
            avg_suspicion_score: stats.avg_suspicion_score ? parseFloat(stats.avg_suspicion_score).toFixed(1) : null,
            period_days: days
          },
          today_stats: {
            total_submissions: todayTotal,
            successful_sends: todaySuccessful,
            success_rate: todayTotal > 0 ? ((todaySuccessful / todayTotal) * 100).toFixed(1) : 0
          },
          recent_submissions: recentSubmissions.map(sub => ({
            id: sub.id,
            requestId: sub.requestId,
            name: sub.name,
            email: sub.email,
            company: sub.company,
            status: sub.status,
            suspicionScore: sub.suspicionScore,
            createdAt: sub.createdAt
          })),
          hourly_distribution: hourlyStats.map(stat => ({
            hour: stat.hour,
            submissions: parseInt(stat.submissions)
          })),
          suspicious_ips: suspiciousIPs.map(ip => ({
            ipAddress: ip.ipAddress,
            submissionCount: parseInt(ip.submission_count),
            avgSuspicion: parseFloat(ip.avg_suspicion).toFixed(1),
            spamCount: parseInt(ip.spam_count)
          })),
          status_trends: statusTrends,
          metadata: {
            period: `${days} days`,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            today_start: todayStart.toISOString(),
            last_updated: new Date().toISOString(),
            data_source: 'contact_submissions_table'
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching contact form statistics', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch contact form statistics',
        error: error.message
      });
    }
  }
}

module.exports = new AdminController();