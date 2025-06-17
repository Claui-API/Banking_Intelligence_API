// src/controllers/admin.controller.js
const { User, Client } = require('../models/User');
const Token = require('../models/Token');
const logger = require('../utils/logger');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
          // We use require here to avoid circular dependencies
          let notificationService;
          try {
            notificationService = require('../services/notification.service.unified');
            logger.info('Notification service loaded successfully for approval notification');
          } catch (importError) {
            logger.error(`Failed to import notification service: ${importError.message}`);

            // Try to load it from a different path
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
   * Suspend a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async suspendClient(req, res) {
    try {
      const { clientId } = req.params;
      const { reason } = req.body;
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

      // Update client status
      client.status = 'suspended';
      await client.save();

      // Revoke all active tokens for this client
      await Token.update(
        { isRevoked: true },
        { where: { clientId, isRevoked: false } }
      );

      logger.info(`Client ${clientId} suspended by admin ${adminId}`, { reason });

      return res.status(200).json({
        success: true,
        message: 'Client suspended successfully',
        data: {
          clientId: client.clientId,
          status: client.status
        }
      });
    } catch (error) {
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
    try {
      const { clientId } = req.params;
      const { reason } = req.body;
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

      // Update client status
      client.status = 'revoked';
      await client.save();

      // Revoke all tokens for this client
      await Token.update(
        { isRevoked: true },
        { where: { clientId } }
      );

      logger.info(`Client ${clientId} revoked by admin ${adminId}`, { reason });

      return res.status(200).json({
        success: true,
        message: 'Client revoked successfully',
        data: {
          clientId: client.clientId,
          status: client.status
        }
      });
    } catch (error) {
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
   * Delete a client from the database
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteClient(req, res) {
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
        // Delete any associated tokens first
        await Token.destroy({
          where: { clientId: client.clientId },
          transaction
        });

        // Delete the client
        await client.destroy({ transaction });

        await transaction.commit();

        logger.info(`Client ${clientId} deleted by admin ${adminId}`, clientInfo);

        return res.status(200).json({
          success: true,
          message: 'Client deleted successfully'
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
}

module.exports = new AdminController();