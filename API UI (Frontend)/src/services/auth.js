// src/services/auth.js - Frontend with Session Management
import api from './api';
import logger from '../utils/logger';
import { jwtDecode } from 'jwt-decode';

export const authService = {
  // Get current session ID
  getSessionId: () => {
    return localStorage.getItem('sessionId');
  },

  // Set session ID and add to API headers
  setSessionId: (sessionId) => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
      // Update API default headers to include session ID
      api.defaults.headers.common['X-Session-Id'] = sessionId;
      logger.info('Session ID set', { sessionId });
    }
  },

  // Clear session ID
  clearSessionId: () => {
    localStorage.removeItem('sessionId');
    delete api.defaults.headers.common['X-Session-Id'];
    logger.info('Session ID cleared');
  },

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
        twoFactorEnabled: decoded.twoFactorEnabled || false
      };
    } catch (error) {
      logger.logError('Token Decoding Failed', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      authService.clearSessionId(); // Clear session on token failure
      return null;
    }
  },

  // Register a new client
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { data } = response.data;

      // Store session ID if returned
      if (data.sessionId) {
        authService.setSessionId(data.sessionId);
      }

      logger.info('Registration successful', {
        clientName: userData.clientName,
        email: userData.email,
        sessionId: data.sessionId
      });

      return response.data;
    } catch (error) {
      logger.logError('Registration Error', error);

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

      // Standard login - store tokens and session
      localStorage.setItem('token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store session ID
      if (data.sessionId) {
        authService.setSessionId(data.sessionId);
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
        role: data.role,
        sessionId: data.sessionId
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

      // Store session ID if returned
      if (authData.sessionId) {
        authService.setSessionId(authData.sessionId);
      }

      logger.info('2FA verification successful', {
        sessionId: authData.sessionId
      });

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

  // Generate API token
  generateApiToken: async (clientId, clientSecret) => {
    try {
      const response = await api.post('/auth/generate-token', {
        clientId,
        clientSecret
      });

      const { data } = response.data;

      // Validate the token type
      try {
        const { jwtDecode } = require('jwt-decode');
        const tokenData = jwtDecode(data.token);

        // Verify it's actually an API token
        if (tokenData.type !== 'api') {
          logger.error('Security issue: Received non-API token type', {
            tokenType: tokenData.type,
            clientId: clientId
          });
          throw new Error('Invalid token type received. Please contact support.');
        }
      } catch (decodeError) {
        logger.error('Token validation error', decodeError);
        throw new Error('Unable to validate token. Please try again later.');
      }

      // Store session ID if returned
      if (data.sessionId) {
        authService.setSessionId(data.sessionId);
      }

      logger.info('API Token generated and validated');

      return data.token;
    } catch (error) {
      logger.logError('API Token Generation Failed', error);
      throw error;
    }
  },

  // Refresh the access token
  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const sessionId = authService.getSessionId();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', {
        refreshToken,
        sessionId // Include session ID in refresh request
      });

      const { data } = response.data;

      localStorage.setItem('token', data.accessToken);

      // Update session ID if returned
      if (data.sessionId) {
        authService.setSessionId(data.sessionId);
      }

      logger.info('Token refreshed successfully', {
        sessionId: data.sessionId || sessionId
      });

      return data.accessToken;
    } catch (error) {
      logger.logError('Token Refresh Failed', error);

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      authService.clearSessionId();

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

  // Log out - clear tokens and session
  logout: async () => {
    try {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const sessionId = authService.getSessionId();

      // Call logout endpoint to clear server-side session
      if (token || sessionId) {
        try {
          await api.post('/auth/logout', {
            refreshToken,
            sessionId
          }, {
            headers: {
              'Authorization': token ? `Bearer ${token}` : undefined,
              'X-Session-Id': sessionId
            }
          });

          logger.info('Server logout successful');
        } catch (error) {
          // Log error but continue with local cleanup
          logger.warn('Server logout failed, continuing with local cleanup', error);
        }
      }
    } catch (error) {
      logger.warn('Logout error, continuing with cleanup', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('clientId');
      authService.clearSessionId();

      logger.info('Logout - tokens and session cleared');
    }
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
        authService.clearSessionId();
        return false;
      }

      return true;
    } catch (error) {
      logger.logError('Authentication Check Failed', error);
      return false;
    }
  },

  // Check session status
  checkSessionStatus: async () => {
    try {
      const sessionId = authService.getSessionId();

      if (!sessionId) {
        return {
          hasSession: false,
          message: 'No session ID found'
        };
      }

      const response = await api.get('/auth/session-status', {
        params: { sessionId }
      });

      return response.data.data;
    } catch (error) {
      logger.warn('Session status check failed', error);
      return {
        hasSession: false,
        message: 'Session check failed'
      };
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const sessionId = authService.getSessionId();

      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
        sessionId
      });

      // Handle session reset if needed
      if (response.data.data?.sessionId) {
        authService.setSessionId(response.data.data.sessionId);
      }

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

  // Initialize auth service (call on app start)
  initialize: () => {
    const sessionId = authService.getSessionId();
    if (sessionId) {
      api.defaults.headers.common['X-Session-Id'] = sessionId;
      logger.info('Auth service initialized with session', { sessionId });
    }
  }
};

// Initialize on module load
authService.initialize();

export default authService;