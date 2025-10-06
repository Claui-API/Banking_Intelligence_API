// src/routes/client.routes.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

// Create a router object
const router = express.Router();

// Import the controller
const clientController = require('../controllers/client.controller');

/**
 * @route GET /api/clients/user-client
 * @desc Get client ID for the authenticated user directly from database
 * @access Private
 */
router.get('/user-client', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    logger.info(`Finding client for user: ${userId}`);

    // Import models directly
    const { User, Client } = require('../models');

    // Find the user with associated clients
    const user = await User.findByPk(userId, {
      include: [{ model: Client }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all clients for this user
    const clients = user.Clients;

    if (!clients || clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No clients found for this user'
      });
    }

    // Format clients for response
    const formattedClients = clients.map(client => ({
      clientId: client.clientId,
      status: client.status,
      description: client.description,
      createdAt: client.createdAt,
      usageQuota: client.usageQuota,
      usageCount: client.usageCount,
      lastUsedAt: client.lastUsedAt,
      resetDate: client.resetDate
    }));

    logger.info(`Found ${clients.length} clients for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: formattedClients
    });
  } catch (error) {
    logger.error('Error getting user clients:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get clients for user',
      error: error.message
    });
  }
});

/**
 * @route GET /api/clients/status/:clientId
 * @desc Get client status by ID
 * @access Private
 */
router.get('/status/:clientId', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { userId } = req.auth;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    // Import models directly
    const { Client } = require('../models');

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
});

// Export the router
module.exports = router;