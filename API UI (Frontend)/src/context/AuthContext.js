// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { authService } from '../services/auth';
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
      const api = await import('../services/api').then(module => module.default);
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

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setIsAdmin(false);
    setClientStatus('unknown');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    // Don't remove clientId so users can log back in easily
  };

  const updateToken = (token) => {
    if (token) {
      localStorage.setItem('token', token);
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token
      });

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