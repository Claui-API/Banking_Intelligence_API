// src/services/auth.js
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
  register: async (clientData) => {
    try {
      const response = await api.post('/auth/register', clientData);
      
      logger.info('Registration successful', {
        clientName: clientData.clientName
      });

      return response.data;
    } catch (error) {
      logger.logError('Registration Error', error);
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  // Log in an existing client
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { data } = response.data;
      
      // Check if this is a first-time login or requires token generation
      if (data.requiresTokenGeneration) {
        logger.info('First-time login - token generation required', {
          clientId: credentials.clientId
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
      
      logger.info('Login successful', {
        userId: data.userId,
        clientId: data.clientId
      });

      return data;
    } catch (error) {
      logger.logError('Login Error', error);
      throw error.response?.data || { message: 'Login failed' };
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
      throw error.response?.data || { message: 'Token generation failed' };
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
      
      throw error.response?.data || { message: 'Token refresh failed' };
    }
  },

  // Log out - clear tokens
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    
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
  }
};

export default authService;