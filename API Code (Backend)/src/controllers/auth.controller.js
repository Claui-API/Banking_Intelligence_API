// auth.controller.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Path to the client storage file
const CLIENT_STORE_FILE = path.join(__dirname, 'clients.json');

/**
 * Load clients from a JSON file (if it exists)
 * Returns a Map object containing the stored clients
 */
const loadClients = () => {
  if (fs.existsSync(CLIENT_STORE_FILE)) {
    try {
      const fileContent = fs.readFileSync(CLIENT_STORE_FILE, 'utf8');
      // Check if file is empty or contains invalid JSON
      if (!fileContent || fileContent.trim() === '') {
        logger.warn('Client store file exists but is empty. Creating new store.');
        return new Map();
      }
      return new Map(JSON.parse(fileContent));
    } catch (error) {
      logger.error('Error parsing client store file:', error);
      logger.info('Creating a new client store');
      // If file is corrupted, create a new store
      return new Map();
    }
  }
  logger.info('Client store file does not exist. Creating new store.');
  return new Map();
};

/**
 * Save clients to the JSON file
 * @param {Map} store - The client store map
 */
const saveClients = (store) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(CLIENT_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(CLIENT_STORE_FILE, JSON.stringify([...store]), 'utf8');
    logger.info('Client store saved successfully');
  } catch (error) {
    logger.error('Error saving client store:', error);
    throw new Error('Failed to save client data');
  }
};

// Initialize the client store from the file
const clientStore = loadClients();

/**
 * Controller for authentication endpoints
 */
class AuthController {
  /**
   * Register a new bank client application
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const { clientName, description } = req.body;

      // Generate client ID and secret
      const clientId = crypto.randomUUID();
      const clientSecret = crypto.randomBytes(32).toString('hex');

      // Store in the map and persist to file
      clientStore.set(clientId, {
        clientName,
        description,
        clientSecret,
        createdAt: new Date().toISOString()
      });
      saveClients(clientStore);

      return res.status(201).json({
        success: true,
        message: 'Client registered successfully',
        data: {
          clientId,
          clientSecret,
          note: 'Store your client secret securely. It will not be shown again.'
        }
      });
    } catch (error) {
      logger.error('Error registering client:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register client'
      });
    }
  }

  /**
   * Authenticate a client and issue JWT tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { clientId, clientSecret } = req.body;

      // Check if client exists and credentials match
      const client = clientStore.get(clientId);

      if (!client) {
        return res.status(401).json({ success: false, message: 'Client not found' });
      }
      
      if (client.clientSecret !== clientSecret) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Generate tokens
      const accessToken = this._generateAccessToken(clientId);
      const refreshToken = this._generateRefreshToken(clientId);

      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresIn: parseInt(process.env.JWT_EXPIRY) || 7200
        }
      });
    } catch (error) {
      const errorMessage = error ? error.message : 'Unknown error';
      const errorStack = error ? error.stack : '';
      logger.error(`Error authenticating client: ${errorMessage}`, { stack: errorStack });
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  /**
   * Refresh the access token using a refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Check if client exists
      const clientId = decoded.clientId;
      if (!clientStore.has(clientId)) {
        return res.status(401).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Generate new access token
      const accessToken = this._generateAccessToken(clientId);

      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          expiresIn: parseInt(process.env.JWT_EXPIRY) || 7200
        }
      });
    } catch (error) {
      logger.error('Error refreshing token:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }
  }

  /**
   * Generate a JWT access token
   * @param {string} clientId - Client ID
   * @returns {string} - JWT access token
   */
  _generateAccessToken(clientId) {
    return jwt.sign(
      { clientId, type: 'access' },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development',
      { expiresIn: process.env.JWT_EXPIRY || '2h' }
    );
  }

  /**
   * Generate a JWT refresh token
   * @param {string} clientId - Client ID
   * @returns {string} - JWT refresh token
   */
  _generateRefreshToken(clientId) {
    return jwt.sign(
      { clientId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-secret-key-for-development',
      { expiresIn: '7d' }
    );
  }
}

module.exports = new AuthController();