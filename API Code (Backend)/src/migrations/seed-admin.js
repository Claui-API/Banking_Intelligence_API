// src/migrations/seed-admin.js
const bcrypt = require('bcrypt');
const { User, Client } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Seed an admin user
 */
async function seedAdmin() {
  try {
    logger.info('Starting admin user seeding...');
    
    // Check if admin user exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminExists = await User.findOne({
      where: { email: adminEmail }
    });
    
    if (adminExists) {
      // Check if admin has admin role, update if not
      if (adminExists.role !== 'admin') {
        adminExists.role = 'admin';
        await adminExists.save();
        logger.info(`Updated existing user ${adminEmail} to admin role`);
      } else {
        logger.info(`Admin user ${adminEmail} already exists, skipping...`);
      }
    } else {
      // Create admin user
      logger.info('Creating admin user...');
      
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
      
      const admin = await User.create({
        clientName: 'Admin',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        description: 'System administrator',
        role: 'admin'
      });
      
      // Create admin client with active status
      const clientCredentials = Client.generateCredentials();
      await Client.create({
        userId: admin.id,
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret,
        description: 'Admin client',
        status: 'active', // Admin's client is automatically active
        approvedBy: admin.id,
        approvedAt: new Date()
      });
      
      logger.info('Admin user created:', {
        id: admin.id,
        email: admin.email,
        role: admin.role
      });
      
      logger.info('Admin client credentials (SAVE THESE):', {
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret
      });
    }
    
    logger.info('Admin seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    throw error;
  }
}

// Run seeding if executed directly
if (require.main === module) {
  seedAdmin()
    .then(() => {
      logger.info('Admin seeding script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Admin seeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedAdmin;