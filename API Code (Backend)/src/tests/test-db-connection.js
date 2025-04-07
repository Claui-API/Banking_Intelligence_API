// test-db-connection.js
const mongoose = require('mongoose');
const dbConnection = require('../utils/db-connection');
const logger = require('../utils/logger');

async function testConnection() {
  try {
    logger.info('Starting database connection test...');
    
    // Attempt to connect
    await dbConnection.connect();
    
    // If we got here, connection was successful
    logger.info('✅ Database connection successful');
    
    // Get connection status
    const status = dbConnection.getStatus();
    logger.info('Connection details:', status);
    
    // Check if we can perform a simple operation
    // This assumes you have a mongoose model defined
    try {
      // List available collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      logger.info('Available collections:');
      collections.forEach(collection => {
        logger.info(`- ${collection.name}`);
      });
    } catch (err) {
      logger.warn('Could not list collections:', err.message);
    }
    
    // Close the connection
    logger.info('Closing connection...');
    await dbConnection.disconnect();
    logger.info('Connection closed');
    
  } catch (error) {
    logger.error('❌ Database connection test failed:', error);
  } finally {
    // Ensure process exits
    process.exit(0);
  }
}

// Run the test
testConnection();