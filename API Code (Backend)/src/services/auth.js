// src/services/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User, Client } = require('../models/User');
const Token = require('../models/Token');
const logger = require('../utils/logger');

// Get environment variables
const {
  JWT_SECRET = 'your-secret-key-change-in-production',
  JWT_REFRESH_SECRET = 'your-refresh-secret-key-change-in-production',
  JWT_EXPIRY = '1h',
  JWT_REFRESH_EXPIRY = '7d',
  NODE_ENV = 'development'
} = process.env;

const authService = {
  // Register a new user with client credentials
  register: async (userData) => {
    const transaction = await User.sequelize.transaction();
    
    try {
      // Validate email uniqueness
      const existingUser = await User.findOne({
        where: { email: userData.email },
        transaction
      });
      
      if (existingUser) {
        await transaction.rollback();
        throw new Error('Email already in use');
      }
      
      // Create the user
      const user = await User.create({
        clientName: userData.clientName,
        email: userData.email,
        passwordHash: userData.password, // Will be hashed by hooks
        description: userData.description
      }, { transaction });
      
      // Generate client credentials
      const credentials = Client.generateCredentials();
      
      // Create the client - status will be 'pending' by default now
      const client = await Client.create({
        userId: user.id,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        description: userData.description
      }, { transaction });
      
      await transaction.commit();
      
      logger.info(`User registered successfully: ${user.email}`);
      
      // Return credentials but not the full user object
      return {
        success: true,
        data: {
          clientId: client.clientId,
          clientSecret: client.clientSecret,
          userId: user.id,
          status: client.status // Include status so client knows they need approval
        }
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Registration failed: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },
  
  // Login with email/password or clientId/clientSecret
  login: async (credentials, req) => {
    try {
      const { email, password, clientId, clientSecret } = credentials;
      let user = null;
      let client = null;
      
      // Determine login method
      if (email && password) {
        // Email/password login
        user = await User.findOne({ 
          where: { email, status: 'active' },
          include: [{ model: Client, where: { status: 'active' }, required: false }]
        });
        
        if (!user) {
          throw new Error('Invalid email or password');
        }
        
        // Verify password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
          throw new Error('Invalid email or password');
        }
        
        // Get the first active client for this user
        client = user.Clients?.[0];
        
        // If user doesn't have any active clients, check for pending ones
        if (!client) {
          const pendingClient = await Client.findOne({
            where: { userId: user.id, status: 'pending' }
          });
          
          if (pendingClient) {
            throw new Error('Your API access is pending approval. Please contact the administrator.');
          }
          
          // If no pending clients either, create one that will need approval
          const credentials = Client.generateCredentials();
          client = await Client.create({
            userId: user.id,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            description: 'Auto-generated client',
            status: 'pending' // Will need admin approval
          });
          
          throw new Error('A new API client has been created for you, but it requires administrator approval.');
        }
      } else if (clientId && clientSecret) {
        // Client credentials login
        client = await Client.findOne({ 
          where: { clientId, clientSecret },
          include: [{ model: User, where: { status: 'active' }, required: true }]
        });
        
        if (!client) {
          throw new Error('Invalid client credentials');
        }
        
        // Check client status
        if (client.status !== 'active') {
          throw new Error(`Your API access is ${client.status}. Please contact the administrator for approval.`);
        }
        
        user = client.User;
      } else {
        throw new Error('Invalid credentials format');
      }
      
      // Update login timestamp
      user.lastLoginAt = new Date();
      await user.save();
      
      client.lastUsedAt = new Date();
      await client.save();
      
      // Generate tokens
      const accessToken = await authService.generateToken(user, client, 'access');
      const refreshToken = await authService.generateToken(user, client, 'refresh');
      
      return {
        accessToken,
        refreshToken,
        userId: user.id,
        clientId: client.clientId,
        role: user.role, // Include user role in response
        expiresIn: parseInt(JWT_EXPIRY) || 3600
      };
    } catch (error) {
      logger.error(`Login failed: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },
  
  // Generate a JWT token and store in database
  generateToken: async (user, client, type = 'access') => {
    // Determine token details based on type
    const secret = type === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
    const expiresIn = type === 'refresh' ? JWT_REFRESH_EXPIRY : JWT_EXPIRY;
    
    // Create token payload
    const payload = {
      userId: user.id,
      email: user.email,
      clientId: client.clientId,
      role: user.role, // Include user role in token
      type
    };
    
    // Sign the token
    const token = jwt.sign(payload, secret, { expiresIn });
    
    // Calculate expiration date
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);
    
    // Store token in database
    await Token.create({
      userId: user.id,
      clientId: client.clientId,
      tokenType: type,
      token,
      expiresAt,
      ipAddress: null, // In a real app, get from request
      userAgent: null  // In a real app, get from request
    });
    
    return token;
  },
  
  // Refresh an access token using a refresh token
  refreshToken: async (refreshToken) => {
    try {
      // Verify token exists and is valid
      const tokenRecord = await Token.findValidToken(refreshToken, 'refresh');
      
      if (!tokenRecord) {
        throw new Error('Invalid or expired refresh token');
      }
      
      // Get associated user and client
      const user = await User.findByPk(tokenRecord.userId);
      const client = await Client.findOne({ where: { clientId: tokenRecord.clientId } });
      
      if (!user || !client || user.status !== 'active' || client.status !== 'active') {
        throw new Error('User or client inactive');
      }
      
      // Generate new access token
      const accessToken = await authService.generateToken(user, client, 'access');
      
      // Update refresh token last used timestamp
      tokenRecord.lastUsedAt = new Date();
      await tokenRecord.save();
      
      return {
        accessToken,
        expiresIn: parseInt(JWT_EXPIRY) || 3600
      };
    } catch (error) {
      logger.error(`Token refresh failed: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },
  
  // Verify a token
  verifyToken: async (token, type = 'access') => {
    try {
      // Find token in database
      const tokenRecord = await Token.findValidToken(token, type);
      
      if (!tokenRecord) {
        return null;
      }
      
      // Verify JWT signature
      const secret = type === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      
      // Update last used timestamp
      tokenRecord.lastUsedAt = new Date();
      await tokenRecord.save();
      
      return decoded;
    } catch (error) {
      logger.error(`Token verification failed: ${error.message}`);
      return null;
    }
  },
  
  // Revoke a token
  revokeToken: async (token, type = 'access') => {
    try {
      const tokenRecord = await Token.findOne({
        where: { token, tokenType: type }
      });
      
      if (!tokenRecord) {
        return false;
      }
      
      tokenRecord.isRevoked = true;
      await tokenRecord.save();
      
      return true;
    } catch (error) {
      logger.error(`Token revocation failed: ${error.message}`);
      throw error;
    }
  },
  
  // Generate a new API token
  generateApiToken: async (clientId, clientSecret) => {
    try {
      // Find client with the provided credentials
      const client = await Client.findOne({
        where: { clientId, clientSecret },
        include: [{ model: User, where: { status: 'active' }, required: true }]
      });
      
      if (!client) {
        throw new Error('Invalid client credentials');
      }
      
      // Check if client is approved
      if (client.status !== 'active') {
        throw new Error(`Client status is ${client.status}. Cannot generate API token until approved.`);
      }
      
      const user = client.User;
      
      // Generate a long-lived token
      const payload = {
        userId: user.id,
        clientId: client.clientId,
        role: user.role,
        type: 'api'
      };
      
      // API tokens could have longer expiry
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
      
      // Calculate expiration date
      const decoded = jwt.decode(token);
      const expiresAt = new Date(decoded.exp * 1000);
      
      // Store token in database
      await Token.create({
        userId: user.id,
        clientId: client.clientId,
        tokenType: 'api',
        token,
        expiresAt
      });
      
      return {
        token,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      logger.error(`API token generation failed: ${error.message}`);
      throw error;
    }
  },
  
  // Change user password
  changePassword: async (userId, currentPassword, newPassword) => {
    const transaction = await User.sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction });
      
      if (!user) {
        await transaction.rollback();
        throw new Error('User not found');
      }
      
      // Verify current password
      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        await transaction.rollback();
        throw new Error('Current password is incorrect');
      }
      
      // Set and hash new password
      user.passwordHash = newPassword;
      await user.save({ transaction });
      
      // Revoke all refresh tokens for this user
      await Token.update(
        { isRevoked: true },
        { 
          where: { userId, tokenType: 'refresh' },
          transaction
        }
      );
      
      await transaction.commit();
      
      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Password change failed: ${error.message}`);
      throw error;
    }
  },
  
  // Change client secret
  changeClientSecret: async (clientId, currentSecret) => {
    const transaction = await Client.sequelize.transaction();
    
    try {
      const client = await Client.findOne({
        where: { clientId, clientSecret: currentSecret },
        transaction
      });
      
      if (!client) {
        await transaction.rollback();
        throw new Error('Invalid client ID or secret');
      }
      
      // Generate new secret
      const newSecret = Client.generateCredentials().clientSecret;
      
      // Update client
      client.clientSecret = newSecret;
      await client.save({ transaction });
      
      // Revoke all existing tokens for this client
      await Token.update(
        { isRevoked: true },
        { 
          where: { clientId, tokenType: ['access', 'refresh', 'api'] },
          transaction
        }
      );
      
      await transaction.commit();
      
      return { clientId, clientSecret: newSecret };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Client secret change failed: ${error.message}`);
      throw error;
    }
  }
};

module.exports = authService;