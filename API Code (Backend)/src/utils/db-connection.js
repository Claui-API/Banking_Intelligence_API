// utils/db-connection.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const logger = require('./logger');
const path = require('path');

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Database connection utility
 * Handles connecting to MongoDB (local), MongoDB Atlas (cloud), or DocumentDB (AWS)
 */
class DatabaseConnection {
  constructor() {
    this.isConnected = false;
  }
  
  /**
   * Initialize database connection
   */

  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Using existing database connection');
        return;
      }
      
      // Determine environment and connection type
      const environment = process.env.NODE_ENV || 'development';
      const connectionType = process.env.DB_TYPE || 'local'; // 'local', 'atlas', or 'aws'
      
      let connectionString;
      
      // Build connection string based on environment and type
      if (environment === 'production' && connectionType === 'aws') {
        // AWS DocumentDB for production
        connectionString = `mongodb://${process.env.DB_USERNAME}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_ENDPOINT}:27017/banking-intelligence?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred`;
        
        // DocDB requires SSL certificate
        const certPath = './rds-combined-ca-bundle.pem';
        if (!fs.existsSync(certPath)) {
          logger.warn('CA certificate not found. Please download it from:');
          logger.warn('https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem');
        }
        
        // Set Mongoose SSL options
        mongoose.set('sslValidate', true);
        mongoose.set('sslCA', [certPath]);
        
        logger.info('Connecting to AWS DocumentDB');
      } else if (connectionType === 'atlas') {
        // MongoDB Atlas for development or staging
        if (!process.env.MONGODB_URI) {
          throw new Error('MONGODB_URI environment variable is required for Atlas connection');
        }
        
        connectionString = process.env.MONGODB_URI;
        logger.info('Connecting to MongoDB Atlas');
      } else {
        // Local MongoDB for development
        connectionString = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/banking-intelligence';
        logger.info('Connecting to local MongoDB');
      }
      
      // Connection options
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: connectionType !== 'aws' // AWS DocumentDB doesn't support retryWrites
      };
      
      // Connect to the database
      await mongoose.connect(connectionString, options);
      
      this.isConnected = true;
      logger.info('Successfully connected to the database');
      
      // Log connection events
      mongoose.connection.on('error', err => {
        logger.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.info('MongoDB disconnected');
        this.isConnected = false;
      });
      
      // Handle application termination
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Error connecting to the database:', error);
      throw error;
    }
  }
  
  /**
   * Close database connection
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        return;
      }
      
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error disconnecting from the database:', error);
      throw error;
    }
  }
  
  /**
   * Get database status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      dbName: mongoose.connection.db?.databaseName || 'not connected',
      host: mongoose.connection.host || 'not connected',
      connectionType: process.env.DB_TYPE || 'local',
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

module.exports = new DatabaseConnection();