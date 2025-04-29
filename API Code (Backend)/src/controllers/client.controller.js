// src/controllers/client.controller.js
const logger = require('../utils/logger');

class ClientController {
  /**
   * Get client status by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getClientStatus(req, res) {
    try {
      const { clientId } = req.params;
      const { userId } = req.auth;
      
      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
      }
      
      // Import models dynamically to avoid circular dependencies
      const { Client } = require('../models/User');
      
      // Find the client
      const client = await Client.findOne({
        where: { clientId }
      });
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
      
      // Only allow the client owner or admins to see the status
      if (client.userId !== userId && req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this client'
        });
      }
      
      logger.info(`Retrieved client status for ${clientId}: ${client.status}`);
      
      return res.status(200).json({
        success: true,
        data: {
          clientId: client.clientId,
          status: client.status,
          lastUsedAt: client.lastUsedAt,
          usageCount: client.usageCount,
          usageQuota: client.usageQuota,
          resetDate: client.resetDate
        }
      });
    } catch (error) {
      logger.error('Error getting client status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get client status',
        error: error.message
      });
    }
  }
}

module.exports = new ClientController();