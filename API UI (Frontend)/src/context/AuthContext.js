// src/context/AuthContext.js - Properly fixed logout function for frontend
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { authService } from '../services/auth';
import api from '../services/api'; // Import API service instead
import logger from '../utils/logger';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientStatus, setClientStatus] = useState('unknown');

  // Add a flag to prevent multiple simultaneous status refreshes
  const refreshingStatus = useRef(false);
  // Add a timer reference for debounce
  const statusRefreshTimer = useRef(null);
  // Track last refresh time to prevent too frequent refreshes
  const lastRefreshTime = useRef(0);

  useEffect(() => {
    // Check authentication status on initial load
    const checkAuth = async () => {
      try {
        const auth = authService.isAuthenticated();

        if (auth) {
          // If authenticated, get user info from token
          const userData = authService.getUserFromToken();

          // Store the user ID in localStorage for validation checks
          if (userData && userData.id) {
            localStorage.setItem('userId', userData.id);
          }

          setUser({
            ...userData,
            token: localStorage.getItem('token'),
            twoFactorEnabled: userData.twoFactorEnabled || false // Get from token if available
          });

          // Check if user is admin
          const isUserAdmin = userData.role === 'admin';
          setIsAdmin(isUserAdmin);

          // For admin users, don't worry about client status
          if (isUserAdmin) {
            setClientStatus('active'); // Always treat admin users as having active status
          }
          // For regular users, set initial client status from token if available
          else if (userData.clientId && userData.clientStatus) {
            setClientStatus(userData.clientStatus);

            // Only fetch fresh status if we haven't refreshed recently
            const now = Date.now();
            if (now - lastRefreshTime.current > 30000) { // 30 second cooldown
              // Schedule a status refresh (debounced)
              if (statusRefreshTimer.current) {
                clearTimeout(statusRefreshTimer.current);
              }
              statusRefreshTimer.current = setTimeout(() => {
                refreshClientStatus();
              }, 500); // Debounce for 500ms
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
      setClientStatus('active');
      return;
    }

    // Prevent multiple simultaneous refreshes
    if (refreshingStatus.current) {
      logger.info('Status refresh already in progress, skipping');
      return;
    }

    // Enforce a minimum interval between refreshes
    const now = Date.now();
    if (now - lastRefreshTime.current < 5000) { // 5 second cooldown
      logger.info('Rate limiting status refresh, too many requests');
      return;
    }

    try {
      refreshingStatus.current = true;
      lastRefreshTime.current = now;

      // Make an API call to get the current client status
      const response = await api.get(`/clients/status/${user.clientId}`);

      if (response.data && response.data.success) {
        logger.info(`Client status refreshed: ${response.data.data.status}`);
        setClientStatus(response.data.data.status);
      }
    } catch (error) {
      logger.error('Failed to refresh client status:', error);
      // Don't change the status on error, keep the current value
    } finally {
      refreshingStatus.current = false;
    }
  };

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      // Determine login method based on credentials provided
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

        // Return partial auth info for 2FA verification
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

      // Standard login
      setIsAuthenticated(true);

      // Set user data
      const userData = authService.getUserFromToken();
      const userInfo = {
        ...userData,
        token: loginResult.accessToken,
        // Store email if email login was used
        email: isEmailLogin ? credentials.email : userData.email,
        // Flag for 2FA status
        twoFactorEnabled: userData.twoFactorEnabled || false
      };

      setUser(userInfo);

      // Store the user ID in localStorage for validation
      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      // Check if user is admin
      setIsAdmin(userData.role === 'admin');

      // Set client status
      if (userData.clientId) {
        setClientStatus(loginResult.clientStatus || 'pending');
      }

      setIsLoading(false);
      return loginResult;
    } catch (error) {
      logger.error('Login failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      // Ensure required fields are present
      if (!userData.clientName || !userData.email || !userData.password) {
        throw new Error('Client name, email and password are required');
      }

      const result = await authService.register(userData);
      setIsLoading(false);
      return result;
    } catch (error) {
      logger.error('Registration failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  // Improved logout that properly clears frontend state and notifies backend
  const logout = async () => {
    try {
      // Get the user ID before we clear auth state
      const currentUserId = user?.id;

      // Clear any client-side financial data
      sessionStorage.removeItem('plaidConnected');
      sessionStorage.removeItem('plaidAccounts');
      localStorage.removeItem('financialData');

      // Notify the backend to clear server-side user data (if user is logged in)
      if (currentUserId) {
        try {
          await api.post('/users/session/clear');
          logger.info(`Notified server to clear session data for user ${currentUserId}`);
        } catch (apiError) {
          // Log but continue with logout even if API call fails
          logger.error('Failed to notify server about logout:', apiError);
        }
      }

      // Standard logout actions
      authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setIsAdmin(false);
      setClientStatus('unknown');

      // Remove tokens from local storage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');

      // Remove user ID from local storage
      localStorage.removeItem('userId');

      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Error during logout:', error);
      // Still clear state on error
      setIsAuthenticated(false);
      setUser(null);

      // Force removal of tokens
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
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

      // Store the user ID in localStorage for validation
      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      // Update admin status if needed
      setIsAdmin(userData.role === 'admin');
    }
  };

  // Update user 2FA status
  const updateUser2FAStatus = (enabled) => {
    if (user) {
      setUser({
        ...user,
        twoFactorEnabled: enabled
      });
      logger.info(`Updated user 2FA status to ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  const updateAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token
      });

      // Store the user ID in localStorage for validation
      if (userData && userData.id) {
        localStorage.setItem('userId', userData.id);
      }

      setIsAdmin(userData.role === 'admin');
      setClientStatus(userData.clientStatus || 'active');
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    isAdmin,
    clientStatus,
    refreshClientStatus,
    login,
    register,
    logout,
    updateToken,
    updateUser2FAStatus,
    updateAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;