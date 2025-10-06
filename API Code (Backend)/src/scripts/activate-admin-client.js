// src/scripts/activate-admin-client.js
require('dotenv').config();
const { User, Client } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function activateAdminClient() {
  try {
    logger.info('Starting admin client activation...');

    // Find admin user
    const adminUser = await User.findOne({
      where: { role: 'admin' }
    });

    if (!adminUser) {
      logger.error('Admin user not found!');
      return false;
    }

    logger.info(`Found admin user: ${adminUser.id} (${adminUser.email})`);

    // Find all clients for this admin
    const adminClients = await Client.findAll({
      where: { userId: adminUser.id }
    });

    if (adminClients.length === 0) {
      logger.error('No clients found for admin user!');

      // Create a new client for admin
      logger.info('Creating new client for admin user...');

      const clientCredentials = Client.generateCredentials();
      await Client.create({
        userId: adminUser.id,
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret,
        description: 'Admin client (auto-created)',
        status: 'active',
        approvedBy: adminUser.id,
        approvedAt: new Date()
      });

      logger.info('Created new client for admin user with credentials:');
      logger.info(`Client ID: ${clientCredentials.clientId}`);
      logger.info(`Client Secret: ${clientCredentials.clientSecret}`);

      return true;
    }

    // Update all admin clients to active status
    let updatedCount = 0;

    for (const client of adminClients) {
      if (client.status !== 'active') {
        client.status = 'active';
        client.approvedBy = adminUser.id;
        client.approvedAt = new Date();
        await client.save();
        updatedCount++;

        logger.info(`Activated client: ${client.clientId}`);
      }
    }

    if (updatedCount > 0) {
      logger.info(`${updatedCount} admin client(s) activated successfully!`);
    } else {
      logger.info(`All admin clients are already active.`);
    }

    return true;
  } catch (error) {
    logger.error('Error activating admin client:', error);
    return false;
  } finally {
    await sequelize.close();
  }
}

// Run the activation if executed directly
if (require.main === module) {
  activateAdminClient()
    .then((success) => {
      if (success) {
        logger.info('Admin client activation completed successfully');
      } else {
        logger.error('Admin client activation failed');
      }
      process.exit(0);
    })
    .catch(error => {
      logger.error('Unhandled error during admin client activation:', error);
      process.exit(1);
    });
}

module.exports = activateAdminClient;