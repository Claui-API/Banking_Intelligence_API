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
        email: decoded.email
      });

      return {
        id: decoded.userId,
        email: decoded.email,
        clientId: decoded.clientId
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
        email: credentials.email
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
        localStorage.removeItem('refreshToken');
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