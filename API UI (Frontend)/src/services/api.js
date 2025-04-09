// src/services/api.js
import axios from 'axios';
import logger from '../utils/logger';

// Determine API URL, with fallback
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout to prevent hanging requests
  timeout: 60000, // 10 seconds
});

// Log API configuration
logger.info('API Configuration', {
  baseURL: API_URL,
  timeout: '10 seconds'
});

// Add request interceptor to log outgoing requests
api.interceptors.request.use(
  (config) => {
    logger.info('API Request', {
      method: config.method,
      url: config.url,
      data: config.data
    });

    // Attach token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    logger.logError('API Request Error', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common scenarios
api.interceptors.response.use(
  (response) => {
    logger.info('API Response', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Comprehensive error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      logger.error('API Error Response', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });

      switch (error.response.status) {
        case 401: // Unauthorized
          logger.warn('Unauthorized access - redirecting to login');
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
        case 403: // Forbidden
          logger.error('Access forbidden');
          break;
        case 404: // Not Found
          logger.error('Requested resource not found');
          break;
        case 500: // Internal Server Error
          logger.error('Server error occurred');
          break;
        default:
          logger.error('Unexpected API error');
      }
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response received', {
        request: error.request
      });
    } else {
      // Something happened in setting up the request
      logger.error('Error setting up request', {
        message: error.message
      });
    }

    return Promise.reject(error);
  }
);

export default api;