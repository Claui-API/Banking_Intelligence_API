// src/controllers/auth.controller.js
const authService = require('../services/auth');
const { User, Client } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Controller for authentication endpoints
 */
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

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result.data
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
      const loginData = await authService.login({
        email,
        password,
        clientId,
        clientSecret
      }, req);

      return res.status(200).json({
        success: true,
        data: loginData
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

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const result = await authService.refreshToken(refreshToken);

      return res.status(200).json({
        success: true,
        data: result
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
   * Logout - revoke tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (token) {
        await authService.revokeToken(token, 'access');
      }
      
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.revokeToken(refreshToken, 'refresh');
      }
      
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Error during logout:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
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

      if (!client || client.userId !== req.auth.userId) {
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

      const result = await authService.generateApiToken(clientId, clientSecret);

      return res.status(200).json({
        success: true,
        data: {
          token: result.token,
          expiresAt: result.expiresAt,
          clientId
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
}

module.exports = new AuthController();