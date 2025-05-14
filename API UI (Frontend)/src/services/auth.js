// src/services/auth.js (Frontend)
import api from './api';
import logger from '../utils/logger';
import { jwtDecode } from 'jwt-decode';

// Note: This is a frontend implementation of the auth service
// It only handles client-side auth operations and API calls

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
        role: decoded.role || 'user'
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
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const errorMessage = error.response.data?.message || 'Registration failed';
        throw new Error(errorMessage);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server. Please check your network connection.');
      } else {
        // Something happened in setting up the request that triggered an Error
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
          // Use either clientId or email for logging
          clientId: credentials.clientId,
          email: credentials.email
        });

        return {
          requiresTokenGeneration: true,
          token: data.token
        };
      }

      // Store tokens
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

      // Enhanced error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 401) {
          // Determine which login method was used
          if (credentials.email) {
            throw new Error('Invalid email or password. Please check your credentials.');
          } else {
            throw new Error('Invalid credentials. Please check your Client ID and Secret.');
          }
        } else if (error.response.status === 403) {
          // This is for pending approval or suspended clients
          throw new Error(error.response.data?.message || 'Your account requires approval. Please contact the administrator.');
        } else {
          const errorMessage = error.response.data?.message || 'Login failed';
          throw new Error(errorMessage);
        }
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server. Please check your network connection.');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error('Error setting up login request');
      }
    }
  },

  // Generate 2FA secret
  generate2FASecret: async () => {
    try {
      const response = await api.post('/auth/generate-2fa');

      if (response.data && response.data.success) {
        logger.info('2FA secret generated');
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to generate 2FA secret');
    } catch (error) {
      logger.logError('2FA Secret Generation Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to generate 2FA secret';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA secret generation request');
      }
    }
  },

  // Enable 2FA
  enable2FA: async (secret, token) => {
    try {
      const response = await api.post('/auth/enable-2fa', {
        secret,
        token
      });

      if (response.data && response.data.success) {
        logger.info('2FA enabled successfully');
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to enable 2FA');
    } catch (error) {
      logger.logError('2FA Enablement Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to enable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA enablement request');
      }
    }
  },

  // Disable 2FA
  disable2FA: async (token) => {
    try {
      const response = await api.post('/auth/disable-2fa', { token });

      if (response.data && response.data.success) {
        logger.info('2FA disabled successfully');
        return true;
      }

      throw new Error(response.data?.message || 'Failed to disable 2FA');
    } catch (error) {
      logger.logError('2FA Disablement Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to disable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA disablement request');
      }
    }
  },

  // Verify 2FA during login
  verify2FA: async (userId, token) => {
    try {
      const response = await api.post('/auth/verify-2fa', {
        userId,
        token
      });

      if (response.data && response.data.success) {
        // Store tokens
        localStorage.setItem('token', response.data.data.accessToken);
        if (response.data.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.data.refreshToken);
        }

        logger.info('2FA verification successful');
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to verify 2FA token');
    } catch (error) {
      logger.logError('2FA Verification Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify 2FA token';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA verification request');
      }
    }
  },

  // Verify 2FA with backup code
  verifyBackupCode: async (userId, backupCode) => {
    try {
      const response = await api.post('/auth/verify-2fa', {
        userId,
        backupCode
      });

      if (response.data && response.data.success) {
        // Store tokens
        localStorage.setItem('token', response.data.data.accessToken);
        if (response.data.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.data.refreshToken);
        }

        logger.info('Backup code verification successful');
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to verify backup code');
    } catch (error) {
      logger.logError('Backup Code Verification Failed', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify backup code';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up backup code verification request');
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

      // Enhanced error handling
      if (error.response) {
        // Check for approval-related errors
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

      // Clear tokens on refresh failure
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');

      // Enhanced error handling
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

    // Keep clientId for convenience on next login

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