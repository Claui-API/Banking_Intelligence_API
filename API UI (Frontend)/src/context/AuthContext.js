// src/context/AuthContext.js - Enhanced with Session Management
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { authService } from '../services/auth';
import api from '../services/api';
import logger from '../utils/logger';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Initialize state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('sessionId') || null;
  });
  const [clientStatus, setClientStatus] = useState(() => {
    const savedStatus = localStorage.getItem('clientStatus');
    return savedStatus || 'unknown';
  });

  // Add a flag to prevent multiple simultaneous status refreshes
  const refreshingStatus = useRef(false);
  const statusRefreshTimer = useRef(null);
  const lastRefreshTime = useRef(0);

  // Helper function to store client status
  const storeClientStatus = (status) => {
    if (status) {
      localStorage.setItem('clientStatus', status);
      logger.info(`Stored client status in localStorage: ${status}`);
    }
  };

  // Helper function to manage session
  const updateSession = (newSessionId) => {
    if (newSessionId) {
      setSessionId(newSessionId);
      localStorage.setItem('sessionId', newSessionId);
      api.defaults.headers.common['X-Session-Id'] = newSessionId;
      logger.info('Session updated', { sessionId: newSessionId });
    }
  };

  const clearSession = () => {
    setSessionId(null);
    localStorage.removeItem('sessionId');
    delete api.defaults.headers.common['X-Session-Id'];
    logger.info('Session cleared');
  };

  useEffect(() => {
    // Check authentication status on initial load
    const checkAuth = async () => {
      try {
        const auth = authService.isAuthenticated();

        if (auth) {
          // If authenticated, get user info from token
          const userData = authService.getUserFromToken();

          logger.info('User data from token:', {
            userId: userData.id,
            email: userData.email,
            clientId: userData.clientId,
            role: userData.role
          });

          // Store the user ID in localStorage for validation checks
          if (userData && userData.id) {
            localStorage.setItem('userId', userData.id);
          }

          // Check for existing session
          const existingSessionId = localStorage.getItem('sessionId');
          if (existingSessionId) {
            updateSession(existingSessionId);

            // Verify session is still valid
            try {
              const response = await api.get('/auth/session-status');
              if (response.data?.data?.hasSession) {
                logger.info('Existing session validated', { sessionId: existingSessionId });
              } else {
                logger.warn('Existing session invalid, will create new on next request');
                clearSession();
              }
            } catch (error) {
              logger.warn('Could not verify session status', error);
            }
          }

          setUser({
            ...userData,
            token: localStorage.getItem('token'),
            twoFactorEnabled: userData.twoFactorEnabled || false
          });

          // Check if user is admin
          const isUserAdmin = userData.role === 'admin';
          setIsAdmin(isUserAdmin);

          // For admin users, don't worry about client status
          if (isUserAdmin) {
            const adminStatus = 'active';
            setClientStatus(adminStatus);
            storeClientStatus(adminStatus);
          }
          // For regular users, handle client status
          else if (userData.clientId) {
            // Check if we have a stored active client ID
            const activeClientId = localStorage.getItem('activeClientId');

            if (activeClientId) {
              setClientStatus('active');
              storeClientStatus('active');
              logger.info(`Using stored active client: ${activeClientId}`);
            } else {
              const storedStatus = localStorage.getItem('clientStatus');
              if (storedStatus) {
                setClientStatus(storedStatus);
                logger.info(`Using stored client status: ${storedStatus}`);
              } else {
                setClientStatus('pending');
                if (statusRefreshTimer.current) {
                  clearTimeout(statusRefreshTimer.current);
                }
                statusRefreshTimer.current = setTimeout(() => {
                  refreshClientStatus();
                }, 100);
              }
            }
          }
        }

        setIsAuthenticated(auth);
      } catch (error) {
        logger.error('Authentication check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Cleanup timer on unmount
    return () => {
      if (statusRefreshTimer.current) {
        clearTimeout(statusRefreshTimer.current);
      }
    };
  }, []);

  // Add a function to refresh client status
  const refreshClientStatus = async () => {
    if (!user || !user.clientId) return;

    // Admin users always have 'active' status
    if (user.role === 'admin') {
      const adminStatus = 'active';
      setClientStatus(adminStatus);
      storeClientStatus(adminStatus);
      return;
    }

    // Prevent multiple simultaneous refreshes
    if (refreshingStatus.current) {
      logger.info('Status refresh already in progress, skipping');
      return;
    }

    // Enforce a minimum interval between refreshes
    const now = Date.now();
    if (now - lastRefreshTime.current < 5000) {
      logger.info('Rate limiting status refresh, too many requests');
      return;
    }

    try {
      refreshingStatus.current = true;
      lastRefreshTime.current = now;

      // First, try to get all clients for this user
      logger.info('Fetching all clients for user');
      const userClientsResponse = await api.get('/clients/user-client');

      if (userClientsResponse.data && userClientsResponse.data.success) {
        const clients = userClientsResponse.data.data;
        logger.info(`Found ${clients.length} clients for user`);

        // Find the first active client
        const activeClient = clients.find(client => client.status === 'active');

        if (activeClient) {
          logger.info(`Found active client: ${activeClient.clientId}`);
          localStorage.setItem('activeClientId', activeClient.clientId);
          setClientStatus('active');
          storeClientStatus('active');
          return;
        }
      }

      // Fallback to checking the specific client
      logger.info(`Checking specific client status: ${user.clientId}`);
      const response = await api.get(`/clients/status/${user.clientId}`);

      if (response.data && response.data.success) {
        const clientData = response.data.data;
        const newStatus = clientData.status;

        logger.info(`Client status from API: ${newStatus} for client ${clientData.clientId}`);

        if (newStatus === 'active') {
          localStorage.setItem('activeClientId', clientData.clientId);
        }

        setClientStatus(newStatus);
        storeClientStatus(newStatus);
      }
    } catch (error) {
      logger.error('Failed to refresh client status:', error);
      const activeClientId = localStorage.getItem('activeClientId');
      if (activeClientId) {
        logger.info(`Using stored active client after error: ${activeClientId}`);
        setClientStatus('active');
        storeClientStatus('active');
      } else {
        logger.info('Setting fallback active status for client');
        setClientStatus('active');
        storeClientStatus('active');
        if (user.clientId) {
          localStorage.setItem('activeClientId', user.clientId);
        }
      }
    } finally {
      refreshingStatus.current = false;
    }
  };

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const isEmailLogin = credentials.email && credentials.password;
      const isClientIdLogin = credentials.clientId && credentials.clientSecret;

      if (!isEmailLogin && !isClientIdLogin) {
        throw new Error('Invalid credentials format');
      }

      const loginResult = await authService.login(credentials);

      // Check if 2FA verification is required
      if (loginResult.requireTwoFactor) {
        logger.info('2FA verification required');
        setIsLoading(false);

        return {
          requireTwoFactor: true,
          userId: loginResult.userId,
          email: loginResult.email,
          clientId: loginResult.clientId
        };
      }

      // Check if this is a first-time login or requires token generation
      if (loginResult.requiresTokenGeneration) {
        logger.info('First-time login - token generation required');
        setIsLoading(false);

        return {
          requiresTokenGeneration: true,
          token: loginResult.token
        };
      }

      // Standard login - handle session
      if (loginResult.sessionId) {
        updateSession(loginResult.sessionId);
      }

      setIsAuthenticated(true);

      // Set user data
      const userData = authService.getUserFromToken();
      const userInfo = {
        ...userData,
        token: loginResult.accessToken,
        email: isEmailLogin ? credentials.email : userData.email,
        twoFactorEnabled: userData.twoFactorEnabled || false
      };

      setUser(userInfo);

      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      setIsAdmin(userData.role === 'admin');

      // Set client status
      if (userData.clientId) {
        const newStatus = loginResult.clientStatus || (isClientIdLogin ? 'active' : 'pending');
        setClientStatus(newStatus);
        storeClientStatus(newStatus);

        if (newStatus === 'active' || isClientIdLogin) {
          localStorage.setItem('activeClientId', userData.clientId);
        }

        setTimeout(() => {
          refreshClientStatus();
        }, 500);
      }

      setIsLoading(false);
      return loginResult;
    } catch (error) {
      logger.error('Login failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const verify2FA = async (userId, token) => {
    try {
      const result = await authService.verify2FA(userId, token);

      // Handle session from 2FA verification
      if (result.sessionId) {
        updateSession(result.sessionId);
      }

      // Update user state
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token: result.accessToken,
        twoFactorEnabled: true
      });

      setIsAuthenticated(true);
      setIsAdmin(userData.role === 'admin');

      logger.info('2FA verification successful', {
        userId: userData.id,
        sessionId: result.sessionId
      });

      return result;
    } catch (error) {
      logger.error('2FA verification failed:', error);
      throw error;
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      if (!userData.clientName || !userData.email || !userData.password) {
        throw new Error('Client name, email and password are required');
      }

      const result = await authService.register(userData);

      // Handle session from registration if auto-login
      if (result.data?.sessionId) {
        updateSession(result.data.sessionId);
      }

      setIsLoading(false);
      return result;
    } catch (error) {
      logger.error('Registration failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const currentUserId = user?.id;
      const currentSessionId = sessionId;

      // Clear any client-side financial data
      sessionStorage.removeItem('plaidConnected');
      sessionStorage.removeItem('plaidAccounts');
      localStorage.removeItem('financialData');
      localStorage.removeItem('clientStatus');
      localStorage.removeItem('activeClientId');

      // Notify the backend to clear session and conversation history
      if (currentUserId || currentSessionId) {
        try {
          // Call logout endpoint with session ID
          await api.post('/auth/logout', {
            refreshToken: localStorage.getItem('refreshToken'),
            sessionId: currentSessionId
          });
          logger.info(`Server logout successful for user ${currentUserId}`);
        } catch (apiError) {
          logger.error('Failed to notify server about logout:', apiError);
        }
      }

      // Clear session
      clearSession();

      // Standard logout actions
      authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setIsAdmin(false);
      setClientStatus('unknown');

      // Remove tokens from local storage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');

      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Error during logout:', error);
      // Still clear state on error
      clearSession();
      setIsAuthenticated(false);
      setUser(null);

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('clientStatus');
      localStorage.removeItem('activeClientId');
    }
  };

  const updateToken = (token) => {
    if (token) {
      localStorage.setItem('token', token);
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token
      });

      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      setIsAdmin(userData.role === 'admin');

      if (userData.role !== 'admin' && userData.clientId) {
        if (statusRefreshTimer.current) {
          clearTimeout(statusRefreshTimer.current);
        }
        statusRefreshTimer.current = setTimeout(() => {
          refreshClientStatus();
        }, 500);
      }
    }
  };

  const updateUser2FAStatus = (enabled) => {
    if (user) {
      setUser({
        ...user,
        twoFactorEnabled: enabled
      });
      logger.info(`Updated user 2FA status to ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  const clearConversationHistory = async () => {
    try {
      if (!sessionId) {
        logger.warn('No session to clear');
        return;
      }

      const response = await api.delete('/insights/session', {
        data: { sessionId }
      });

      if (response.data?.data?.sessionId) {
        updateSession(response.data.data.sessionId);
        logger.info('Conversation history cleared, new session created', {
          newSessionId: response.data.data.sessionId
        });
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to clear conversation history', error);
      throw error;
    }
  };

  const updateAuth = () => {
    const token = localStorage.getItem('token');
    const storedSessionId = localStorage.getItem('sessionId');

    if (token) {
      setIsAuthenticated(true);
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token
      });

      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      // Restore session if exists
      if (storedSessionId) {
        updateSession(storedSessionId);
      }

      setIsAdmin(userData.role === 'admin');

      if (userData.role === 'admin') {
        setClientStatus('active');
        storeClientStatus('active');
      } else if (userData.clientId) {
        const activeClientId = localStorage.getItem('activeClientId');
        if (activeClientId) {
          setClientStatus('active');
          storeClientStatus('active');
        } else {
          const savedStatus = localStorage.getItem('clientStatus');
          const newStatus = savedStatus || 'active';
          setClientStatus(newStatus);
          storeClientStatus(newStatus);

          if (newStatus === 'active') {
            localStorage.setItem('activeClientId', userData.clientId);
          }

          if (statusRefreshTimer.current) {
            clearTimeout(statusRefreshTimer.current);
          }
          statusRefreshTimer.current = setTimeout(() => {
            refreshClientStatus();
          }, 500);
        }
      }
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    isAdmin,
    clientStatus,
    sessionId,
    hasValidSession: () => !!sessionId,
    refreshClientStatus,
    login,
    verify2FA,
    register,
    logout,
    updateToken,
    updateUser2FAStatus,
    updateAuth,
    clearConversationHistory
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;