// src/migrations/seed.js
const bcrypt = require('bcrypt');
const { User, Client } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Seed the database with initial data
 */
async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // Check if admin user exists
    const adminExists = await User.findOne({
      where: { email: 'admin@example.com' }
    });
    
    if (!adminExists) {
      logger.info('Creating admin user...');
      
      // Create admin user
      const admin = await User.create({
        clientName: 'Admin',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('Admin123!', 10),
        description: 'System administrator'
      });
      
      // Create admin client
      const clientCredentials = Client.generateCredentials();
      await Client.create({
        userId: admin.id,
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret,
        description: 'Admin client'
      });
      
      logger.info('Admin user created:', {
        id: admin.id,
        email: admin.email,
        clientId: clientCredentials.clientId
      });
      
      logger.info('Admin client credentials (SAVE THESE):', {
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret
      });
    } else {
      logger.info('Admin user already exists, skipping...');
    }
    
    // Create a test user if it doesn't exist
    const testUserExists = await User.findOne({
      where: { email: 'test@example.com' }
    });
    
    if (!testUserExists) {
      logger.info('Creating test user...');
      
      // Create test user
      const testUser = await User.create({
        clientName: 'Test User',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        description: 'Test user account'
      });
      
      // Create test client
      const clientCredentials = Client.generateCredentials();
      await Client.create({
        userId: testUser.id,
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret,
        description: 'Test client'
      });
      
      logger.info('Test user created:', {
        id: testUser.id,
        email: testUser.email,
        clientId: clientCredentials.clientId
      });
      
      logger.info('Test client credentials (SAVE THESE):', {
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret
      });
    } else {
      logger.info('Test user already exists, skipping...');
    }
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
}

// Run seeding if executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Database seeding script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database seeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedDatabase;