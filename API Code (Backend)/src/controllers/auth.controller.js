// src/controllers/auth.controller.js
const authService = require('../services/auth');
const twoFactorService = require('../services/twoFactor.service');
const sessionManager = require('../services/session.service'); // Add this import
const geminiService = require('../services/gemini.service'); // Add if you want to clear gemini data
const { User, Client } = require('../models');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Register a new user with client credentials
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const { clientName, email, password, confirmPassword, description } = req.body;

      // Validate required fields
      if (!clientName || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Client name, email, and password are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password length
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Validate passwords match
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Register user
      const result = await authService.register({
        clientName,
        email,
        password,
        description
      });

      // Create session for newly registered user
      const sessionId = sessionManager.createSession(result.data.userId);

      logger.info('User registered and session created', {
        userId: result.data.userId,
        email: email,
        sessionId: sessionId
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          ...result.data,
          sessionId: sessionId
        }
      });
    } catch (error) {
      logger.error('Error registering user:', error);

      // Handle specific errors
      if (error.message.includes('already in use')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to register user',
        error: error.message
      });
    }
  }

  /**
   * Authenticate a user and issue JWT tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { clientId, clientSecret, email, password } = req.body;

      // Validate at least one auth method is provided
      if ((!email || !password) && (!clientId || !clientSecret)) {
        return res.status(400).json({
          success: false,
          message: 'Either email/password or clientId/clientSecret is required'
        });
      }

      // Attempt login
      const loginResult = await authService.login({
        email,
        password,
        clientId,
        clientSecret
      }, req);

      // Check if 2FA is required
      if (loginResult.requireTwoFactor) {
        logger.info(`2FA required for login: ${loginResult.email || loginResult.userId}`);

        return res.status(200).json({
          success: true,
          data: {
            requireTwoFactor: true,
            userId: loginResult.userId,
            email: loginResult.email,
            clientId: loginResult.clientId
          }
        });
      }

      // Check if this is a first-time login or requires token generation
      if (loginResult.requiresTokenGeneration) {
        return res.status(200).json({
          success: true,
          data: {
            requiresTokenGeneration: true,
            token: loginResult.token
          }
        });
      }

      // Clear any existing sessions for this user
      sessionManager.deleteUserSessions(loginResult.userId);

      // Create new session for logged in user
      const sessionId = sessionManager.createSession(loginResult.userId);

      logger.info('User logged in and session created', {
        userId: loginResult.userId,
        email: loginResult.email,
        sessionId: sessionId
      });

      // Standard login - return tokens with sessionId
      return res.status(200).json({
        success: true,
        data: {
          ...loginResult,
          sessionId: sessionId
        }
      });
    } catch (error) {
      logger.error('Error during login:', error);

      // Determine appropriate status code
      let statusCode = 500;
      if (
        error.message.includes('Invalid email') ||
        error.message.includes('Invalid client') ||
        error.message.includes('Invalid credentials')
      ) {
        statusCode = 401;
      } else if (error.message.includes('pending approval')) {
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const sessionId = req.headers['x-session-id'] || req.body.sessionId;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const result = await authService.refreshToken(refreshToken);

      // Update session if provided
      if (sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          logger.info('Session refreshed on token refresh', {
            userId: session.userId,
            sessionId: sessionId
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          ...result,
          sessionId: sessionId // Maintain sessionId
        }
      });
    } catch (error) {
      logger.error('Error refreshing token:', error);

      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Logout - revoke tokens and delete session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const sessionId = req.headers['x-session-id'] || req.body.sessionId;

      // Get session info before deletion (for logging)
      let userId = null;
      if (sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          userId = session.userId;
        }
      }

      // If no sessionId but we have auth from middleware
      if (!sessionId && req.auth && req.auth.userId) {
        userId = req.auth.userId;
        // Delete all sessions for this user
        sessionManager.deleteUserSessions(userId);
        logger.info('Deleted all sessions for user on logout', {
          userId: userId
        });
      } else if (sessionId) {
        // Delete specific session
        sessionManager.deleteSession(sessionId);
        logger.info('Deleted specific session on logout', {
          userId: userId,
          sessionId: sessionId
        });
      }

      // Revoke tokens
      if (token) {
        await authService.revokeToken(token, 'access');
      }

      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.revokeToken(refreshToken, 'refresh');
      }

      logger.info('User logged out successfully', {
        userId: userId || 'unknown'
      });

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Error during logout:', error);

      // Even on error, try to clear session
      const sessionId = req.headers['x-session-id'] || req.body.sessionId;
      if (sessionId) {
        try {
          sessionManager.deleteSession(sessionId);
        } catch (cleanupError) {
          logger.error('Error clearing session during failed logout:', cleanupError);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Logout failed, but session cleared'
      });
    }
  }

  /**
   * Change user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.auth.userId;
      const sessionId = req.headers['x-session-id'] || req.body.sessionId;

      // Validate passwords
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password, new password, and confirm password are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }

      await authService.changePassword(userId, currentPassword, newPassword);

      // On password change, invalidate all sessions except current one
      if (sessionId) {
        // Get all sessions for this user
        const stats = sessionManager.getStats();

        // Delete all user sessions
        sessionManager.deleteUserSessions(userId);

        // Recreate current session
        const newSessionId = sessionManager.createSession(userId);

        logger.info('Password changed, sessions reset', {
          userId: userId,
          newSessionId: newSessionId
        });

        return res.status(200).json({
          success: true,
          message: 'Password changed successfully. Please log in again.',
          data: {
            sessionId: newSessionId,
            requireReauth: true
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Error changing password:', error);

      // Determine appropriate status code
      let statusCode = 500;
      if (error.message.includes('incorrect')) {
        statusCode = 401;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      }

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Change client secret
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async changeClientSecret(req, res) {
    try {
      const { clientId, currentSecret } = req.body;

      // Validate required fields
      if (!clientId || !currentSecret) {
        return res.status(400).json({
          success: false,
          message: 'Client ID and current secret are required'
        });
      }

      // Verify user has access to this client
      const client = await Client.findOne({
        where: { clientId, clientSecret: currentSecret }
      });

      if (!client || (client.userId !== req.auth.userId && req.auth.role !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to manage this client'
        });
      }

      const result = await authService.changeClientSecret(clientId, currentSecret);

      return res.status(200).json({
        success: true,
        message: 'Client secret updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error changing client secret:', error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Generate an API token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  /**
 * Generate an API token
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client secret
 * @returns {Promise<Object>} API token data
 */
  async generateApiToken(req, res) {
    try {
      const { clientId, clientSecret } = req.body;

      // Validate required fields
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          message: 'Client ID and client secret are required'
        });
      }

      // Find client with the provided credentials
      const client = await Client.findOne({
        where: { clientId }
      });

      if (!client) {
        return res.status(401).json({
          success: false,
          message: 'Invalid client credentials'
        });
      }

      // Verify client secret using bcrypt compare
      const isValidSecret = (clientSecret === client.clientSecret);
      if (!isValidSecret) {
        return res.status(401).json({
          success: false,
          message: 'Invalid client credentials'
        });
      }

      // Check if client is approved
      if (client.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Client is ${client.status}. Cannot generate API token until approved.`
        });
      }

      // Get the associated user
      const user = await User.findByPk(client.userId);
      if (!user || user.status !== 'active') {
        return res.status(404).json({
          success: false,
          message: 'User associated with client not found or inactive'
        });
      }

      // Generate a long-lived token
      const jwt = require('jsonwebtoken');

      const payload = {
        userId: user.id,
        clientId: client.clientId,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        type: 'api' // Explicitly set token type to "api"
      };

      // API tokens have 30 days expiry
      const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key-change-in-production', { expiresIn });

      // Calculate expiration date
      const expiresAt = new Date(Date.now() + (expiresIn * 1000));

      // Store token in database with explicit tokenType
      const { Token } = require('../models');
      await Token.create({
        userId: user.id,
        clientId: client.clientId,
        tokenType: 'api',
        token,
        expiresAt
      });

      // Update client last used timestamp
      client.lastUsedAt = new Date();
      await client.save();

      // Create session for API token if session service is available
      let sessionId = null;
      if (req.sessionManager) {
        try {
          // Delete existing sessions for this user
          req.sessionManager.deleteUserSessions(user.id);

          // Create new session
          sessionId = req.sessionManager.createSession(user.id);
        } catch (sessionError) {
          logger.warn('Session creation failed during token generation', sessionError);
          // Continue without session - not critical
        }
      }

      // Return token data
      return res.status(200).json({
        success: true,
        data: {
          token,
          expiresAt: expiresAt.toISOString(),
          clientId,
          sessionId
        }
      });
    } catch (error) {
      logger.error('Error generating API token:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to generate API token',
        error: error.message
      });
    }
  }

  /**
   * Generate 2FA secret for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generate2FASecret(req, res) {
    try {
      const { userId } = req.auth;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Get user information
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate secret and QR code
      const secretData = await twoFactorService.generateSecret(user);

      return res.status(200).json({
        success: true,
        data: secretData
      });
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate 2FA secret',
        error: error.message
      });
    }
  }

  /**
   * Enable 2FA for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async enable2FA(req, res) {
    try {
      const { userId } = req.auth;
      const { secret, token } = req.body;

      if (!userId || !secret || !token) {
        return res.status(400).json({
          success: false,
          message: 'User ID, secret, and token are required'
        });
      }

      // Verify token before enabling
      const isValid = twoFactorService.verifyToken(token, secret);

      if (!isValid) {
        logger.warn(`Invalid verification token attempt for user ${userId}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Enable 2FA
      await twoFactorService.enable2FA(userId, secret);

      // Get backup codes to return
      const user = await User.findByPk(userId);

      return res.status(200).json({
        success: true,
        message: '2FA enabled successfully',
        data: {
          backupCodes: user.backupCodes || []
        }
      });
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to enable 2FA',
        error: error.message
      });
    }
  }

  /**
   * Disable 2FA for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async disable2FA(req, res) {
    try {
      const { userId } = req.auth;
      const { token } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Get user information
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled for this user'
        });
      }

      // If token provided, verify it before disabling
      if (token) {
        const isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);

        if (!isValid) {
          logger.warn(`Invalid token for 2FA disablement - user ${userId}`);
          return res.status(400).json({
            success: false,
            message: 'Invalid verification code'
          });
        }
      }

      // Disable 2FA
      await twoFactorService.disable2FA(userId);

      return res.status(200).json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
        error: error.message
      });
    }
  }

  /**
   * Verify 2FA token or backup code
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verify2FA(req, res) {
    try {
      const { userId, token, backupCode } = req.body;

      if (!userId || (!token && !backupCode)) {
        return res.status(400).json({
          success: false,
          message: 'User ID and either token or backup code are required'
        });
      }

      let authResult;

      // Use either token or backup code
      if (token) {
        logger.info(`Verifying 2FA token for user ${userId}`);
        authResult = await authService.verify2FA(userId, token);
      } else {
        logger.info(`Verifying backup code for user ${userId}`);
        authResult = await authService.verifyBackupCode(userId, backupCode);
      }

      // After successful 2FA verification, create session
      if (authResult && authResult.accessToken) {
        // Clear existing sessions
        sessionManager.deleteUserSessions(userId);

        // Create new session
        const sessionId = sessionManager.createSession(userId);

        logger.info('Session created after 2FA verification', {
          userId: userId,
          sessionId: sessionId
        });

        authResult.sessionId = sessionId;
      }

      return res.status(200).json({
        success: true,
        data: authResult
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to verify 2FA'
      });
    }
  }

  /**
   * Get current session status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSessionStatus(req, res) {
    try {
      const sessionId = req.headers['x-session-id'] || req.body.sessionId || req.query.sessionId;

      if (!sessionId) {
        return res.status(200).json({
          success: true,
          data: {
            hasSession: false,
            message: 'No session ID provided'
          }
        });
      }

      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(200).json({
          success: true,
          data: {
            hasSession: false,
            message: 'Session not found or expired'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          hasSession: true,
          sessionId: sessionId,
          userId: session.userId,
          createdAt: session.createdAt,
          lastAccessed: session.lastAccessed
        }
      });
    } catch (error) {
      logger.error('Error getting session status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get session status'
      });
    }
  }
}

module.exports = new AuthController();