// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/auth';
import logger from '../utils/logger';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

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
            token: localStorage.getItem('token')
          });
        }
        
        setIsAuthenticated(auth);
      } catch (error) {
        logger.error('Authentication check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      // Determine login method based on credentials provided
      const isEmailLogin = credentials.email && credentials.password;
      const isClientIdLogin = credentials.clientId && credentials.clientSecret;
      
      if (!isEmailLogin && !isClientIdLogin) {
        throw new Error('Invalid credentials format');
      }
      
      const data = await authService.login(credentials);
      
      // Save client ID for future use if provided
      if (credentials.clientId) {
        localStorage.setItem('clientId', credentials.clientId);
      }
      
      // Check if this is a first-time login or requires additional steps
      if (data.requiresTokenGeneration) {
        logger.info('First-time login - token generation required');
        return {
          requiresTokenGeneration: true,
          token: data.token
        };
      }
      
      // Standard login
      setIsAuthenticated(true);
      
      // Store token
      localStorage.setItem('token', data.accessToken);
      
      // Set user data
      const userData = authService.getUserFromToken();
      setUser({
        ...userData,
        token: data.accessToken,
        // Store email if email login was used
        email: isEmailLogin ? credentials.email : null
      });
      
      return data;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
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
      return result;
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('token');
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
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    updateToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;