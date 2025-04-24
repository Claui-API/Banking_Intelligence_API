// src/migrations/setup.js
const { sequelize } = require('../config/database');
const { User, Client } = require('../models/User');
const Token = require('../models/Token');
const logger = require('../utils/logger');

/**
 * Set up database tables and relationships
 */
async function setupDatabase() {
  try {
    logger.info('Starting database setup...');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    logger.info('Database tables synchronized');
    
    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Error setting up database:', error);
    throw error;
  }
}

// Run setup if executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      logger.info('Database setup script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database setup script failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;