// src/services/auth.js - Frontend
import api from './api';
import logger from '../utils/logger';
import { jwtDecode } from 'jwt-decode';

export const authService = {
  // Decode and extract user info from token
  getUserFromToken: () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      // Decode the JWT token
      const decoded = jwtDecode(token);

      logger.info('Token decoded', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });

      return {
        id: decoded.userId,
        email: decoded.email,
        clientId: decoded.clientId,
        role: decoded.role || 'user',
        twoFactorEnabled: decoded.twoFactorEnabled || false // Get 2FA status from token
      };
    } catch (error) {
      logger.logError('Token Decoding Failed', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return null;
    }
  },

  // Register a new client
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);

      logger.info('Registration successful', {
        clientName: userData.clientName,
        email: userData.email
      });

      return response.data;
    } catch (error) {
      logger.logError('Registration Error', error);

      // Enhanced error handling
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Registration failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up registration request');
      }
    }
  },

  // Log in - supports both email/password and clientId/clientSecret
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { data } = response.data;

      // Check if 2FA is required
      if (data.requireTwoFactor) {
        logger.info('2FA verification required', {
          userId: data.userId,
          email: data.email
        });

        return {
          requireTwoFactor: true,
          userId: data.userId,
          email: data.email,
          clientId: data.clientId
        };
      }

      // Check if this is a first-time login or requires token generation
      if (data.requiresTokenGeneration) {
        logger.info('First-time login - token generation required', {
          clientId: credentials.clientId,
          email: credentials.email
        });

        return {
          requiresTokenGeneration: true,
          token: data.token
        };
      }

      // Standard login
      localStorage.setItem('token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store client credentials if using clientId login
      if (credentials.clientId) {
        localStorage.setItem('clientId', credentials.clientId);
      }

      // Store email if using email login
      if (credentials.email) {
        localStorage.setItem('userEmail', credentials.email);
      }

      logger.info('Login successful', {
        userId: data.userId,
        clientId: data.clientId,
        email: credentials.email,
        role: data.role
      });

      return data;
    } catch (error) {
      logger.logError('Login Error', error);

      if (error.response) {
        if (error.response.status === 401) {
          if (credentials.email) {
            throw new Error('Invalid email or password. Please check your credentials.');
          } else {
            throw new Error('Invalid credentials. Please check your Client ID and Secret.');
          }
        } else if (error.response.status === 403) {
          throw new Error(error.response.data?.message || 'Your account requires approval. Please contact the administrator.');
        } else {
          const errorMessage = error.response.data?.message || 'Login failed';
          throw new Error(errorMessage);
        }
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up login request');
      }
    }
  },

  // Generate 2FA secret
  generate2FASecret: async () => {
    try {
      const response = await api.post('/auth/generate-2fa');

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to generate 2FA secret');
      }

      logger.info('2FA secret generated successfully');
      return response.data.data;
    } catch (error) {
      logger.logError('2FA Secret Generation Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to generate 2FA secret';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA secret generation request: ' + error.message);
      }
    }
  },

  // Enable 2FA
  enable2FA: async (secret, token) => {
    try {
      if (!secret || !token) {
        throw new Error('Secret and verification token are required');
      }

      const response = await api.post('/auth/enable-2fa', {
        secret,
        token: token.trim() // Clean the token
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to enable 2FA');
      }

      logger.info('2FA enabled successfully');
      return response.data.data;
    } catch (error) {
      logger.logError('2FA Enablement Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to enable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA enablement request: ' + error.message);
      }
    }
  },

  // Disable 2FA
  disable2FA: async (token) => {
    try {
      const response = await api.post('/auth/disable-2fa', {
        token: token ? token.trim() : undefined // Clean the token if provided
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to disable 2FA');
      }

      logger.info('2FA disabled successfully');
      return true;
    } catch (error) {
      logger.logError('2FA Disablement Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to disable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA disablement request: ' + error.message);
      }
    }
  },

  // Verify 2FA during login
  verify2FA: async (userId, token) => {
    try {
      if (!userId || !token) {
        throw new Error('User ID and verification code are required');
      }

      const cleanToken = token.replace(/\s+/g, '');

      const response = await api.post('/auth/verify-2fa', {
        userId,
        token: cleanToken
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to verify 2FA token');
      }

      // Store tokens from the response
      const authData = response.data.data;
      if (authData.accessToken) {
        localStorage.setItem('token', authData.accessToken);
      }

      if (authData.refreshToken) {
        localStorage.setItem('refreshToken', authData.refreshToken);
      }

      logger.info('2FA verification successful');
      return authData;
    } catch (error) {
      logger.logError('2FA Verification Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify 2FA token';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA verification request: ' + error.message);
      }
    }
  },

  // Verify 2FA with backup code
  verifyBackupCode: async (userId, backupCode) => {
    try {
      if (!userId || !backupCode) {
        throw new Error('User ID and backup code are required');
      }

      const cleanBackupCode = backupCode.replace(/\s+/g, '');

      const response = await api.post('/auth/verify-2fa', {
        userId,
        backupCode: cleanBackupCode
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to verify backup code');
      }

      // Store tokens from the response
      const authData = response.data.data;
      if (authData.accessToken) {
        localStorage.setItem('token', authData.accessToken);
      }

      if (authData.refreshToken) {
        localStorage.setItem('refreshToken', authData.refreshToken);
      }

      logger.info('Backup code verification successful');
      return authData;
    } catch (error) {
      logger.logError('Backup Code Verification Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify backup code';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up backup code verification request: ' + error.message);
      }
    }
  },

  // Generate API token
  generateApiToken: async (clientId, clientSecret) => {
    try {
      const response = await api.post('/auth/generate-token', {
        clientId,
        clientSecret
      });

      const { data } = response.data;

      logger.info('API Token generated', {
        clientId: data.clientId
      });

      return data.token;
    } catch (error) {
      logger.logError('API Token Generation Failed', error);

      if (error.response) {
        if (error.response.status === 403) {
          throw new Error(error.response.data?.message || 'Your account requires approval to generate tokens.');
        }

        const errorMessage = error.response.data?.message || 'Token generation failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up token generation request');
      }
    }
  },

  // Refresh the access token
  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      const { data } = response.data;

      localStorage.setItem('token', data.accessToken);

      logger.info('Token refreshed successfully');

      return data.accessToken;
    } catch (error) {
      logger.logError('Token Refresh Failed', error);

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Token refresh failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up token refresh request');
      }
    }
  },

  // Log out - clear tokens
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');

    logger.info('Logout - tokens cleared');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');

    if (!token) {
      logger.warn('No token found');
      return false;
    }

    try {
      const decoded = jwtDecode(token);
      const isExpired = Date.now() >= decoded.exp * 1000;

      if (isExpired) {
        logger.warn('Token has expired');
        localStorage.removeItem('token');
        return false;
      }

      return true;
    } catch (error) {
      logger.logError('Authentication Check Failed', error);
      return false;
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword: newPassword
      });

      logger.info('Password changed successfully');

      return response.data;
    } catch (error) {
      logger.logError('Password Change Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Password change failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up password change request');
      }
    }
  },

  // Change client secret
  changeClientSecret: async (clientId, currentSecret) => {
    try {
      const response = await api.post('/auth/change-secret', {
        clientId,
        currentSecret
      });

      logger.info('Client secret changed successfully');

      return response.data;
    } catch (error) {
      logger.logError('Client Secret Change Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Client secret change failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client secret change request');
      }
    }
  }
};

export default authService;