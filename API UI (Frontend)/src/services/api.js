// src/services/api.js - Enhanced with Session Management
import axios from 'axios';
import logger from '../utils/logger';

// Determine API URL
const API_URL = process.env.REACT_APP_API_URL || 'https://bankingintelligenceapi.com';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds
});

// Log API configuration
logger.info('API Configuration', {
  baseURL: API_URL,
  timeout: '60 seconds'
});

// Add request interceptor to handle auth and session
api.interceptors.request.use(
  (config) => {
    // Attach token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;

      logger.debug('Attaching Authorization token to request', {
        url: config.url,
        tokenLength: token.length,
      });
    } else {
      logger.warn('No authentication token found in localStorage', {
        url: config.url
      });
    }

    // Attach session ID if available
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      config.headers['X-Session-Id'] = sessionId;

      logger.debug('Attaching Session ID to request', {
        url: config.url,
        sessionId: sessionId.substring(0, 8) + '...' // Log partial for security
      });
    }

    // Log the complete request
    logger.info('API Request', {
      method: config.method,
      url: config.url,
      hasToken: !!token,
      hasSession: !!sessionId,
      data: config.data ? Object.keys(config.data) : null // Log data keys only
    });

    return config;
  },
  (error) => {
    logger.logError('API Request Error', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common scenarios and session updates
api.interceptors.response.use(
  (response) => {
    // Check for new session ID in response headers
    const newSessionId = response.headers['x-session-id'];
    if (newSessionId) {
      const currentSessionId = localStorage.getItem('sessionId');
      if (newSessionId !== currentSessionId) {
        localStorage.setItem('sessionId', newSessionId);
        api.defaults.headers.common['X-Session-Id'] = newSessionId;

        logger.info('Session ID updated from response', {
          oldSession: currentSessionId ? currentSessionId.substring(0, 8) + '...' : 'none',
          newSession: newSessionId.substring(0, 8) + '...'
        });
      }
    }

    // Check for session ID in response body (for login/register responses)
    if (response.data?.data?.sessionId) {
      const bodySessionId = response.data.data.sessionId;
      const currentSessionId = localStorage.getItem('sessionId');

      if (bodySessionId !== currentSessionId) {
        localStorage.setItem('sessionId', bodySessionId);
        api.defaults.headers.common['X-Session-Id'] = bodySessionId;

        logger.info('Session ID updated from response body', {
          oldSession: currentSessionId ? currentSessionId.substring(0, 8) + '...' : 'none',
          newSession: bodySessionId.substring(0, 8) + '...'
        });
      }
    }

    logger.info('API Response', {
      status: response.status,
      url: response.config.url,
      hasSessionUpdate: !!newSessionId || !!response.data?.data?.sessionId
    });

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Comprehensive error handling
    if (error.response) {
      logger.error('API Error Response', {
        status: error.response.status,
        url: error.config.url,
        data: error.response.data,
        headers: error.response.headers
      });

      switch (error.response.status) {
        case 401: // Unauthorized
          // Check if it's a token expiry vs session issue
          if (error.response.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
              // Try to refresh the token
              const refreshToken = localStorage.getItem('refreshToken');
              const sessionId = localStorage.getItem('sessionId');

              if (refreshToken) {
                logger.info('Attempting token refresh');

                const refreshResponse = await axios.post(
                  `${API_URL}/api/auth/refresh`,
                  {
                    refreshToken,
                    sessionId
                  }
                );

                const { accessToken, sessionId: newSessionId } = refreshResponse.data.data;

                // Update tokens
                localStorage.setItem('token', accessToken);

                // Update session if new one provided
                if (newSessionId) {
                  localStorage.setItem('sessionId', newSessionId);
                  api.defaults.headers.common['X-Session-Id'] = newSessionId;
                }

                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                if (newSessionId || sessionId) {
                  originalRequest.headers['X-Session-Id'] = newSessionId || sessionId;
                }

                logger.info('Token refreshed, retrying original request');
                return api(originalRequest);
              }
            } catch (refreshError) {
              logger.error('Token refresh failed', refreshError);

              // Clear all auth data
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('sessionId');
              localStorage.removeItem('userEmail');
              localStorage.removeItem('clientId');
              localStorage.removeItem('userId');

              // Redirect to login
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
              }

              return Promise.reject(refreshError);
            }
          } else {
            // Regular 401 - redirect to login
            logger.warn('Unauthorized access - redirecting to login', {
              url: error.config.url
            });

            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
              localStorage.removeItem('token');
              localStorage.removeItem('sessionId');
              window.location.href = '/login';
            }
          }
          break;

        case 403: // Forbidden
          // Check if it's a session issue
          if (error.response.data?.code === 'SESSION_REQUIRED' ||
            error.response.data?.code === 'SESSION_INVALID') {
            logger.warn('Session issue detected', {
              code: error.response.data.code,
              url: error.config.url
            });

            // Clear session and let the next request create a new one
            localStorage.removeItem('sessionId');
            delete api.defaults.headers.common['X-Session-Id'];

            // If this is not a retry, try the request again
            if (!originalRequest._sessionRetry) {
              originalRequest._sessionRetry = true;

              // Remove the invalid session header
              delete originalRequest.headers['X-Session-Id'];

              logger.info('Retrying request without session');
              return api(originalRequest);
            }
          } else {
            logger.error('Access forbidden', {
              url: error.config.url
            });
          }
          break;

        case 404: // Not Found
          logger.error('Requested resource not found', {
            url: error.config.url
          });
          break;

        case 429: // Too Many Requests
          logger.warn('Rate limit exceeded - too many requests', {
            url: error.config.url,
            retryAfter: error.response.headers['retry-after']
          });
          break;

        case 500: // Internal Server Error
          logger.error('Server error occurred', {
            url: error.config.url
          });
          break;

        default:
          logger.error(`Unexpected API error (${error.response.status})`, {
            url: error.config.url
          });
      }
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response received', {
        request: error.request,
        url: error.config?.url
      });
    } else {
      // Something happened in setting up the request
      logger.error('Error setting up request', {
        message: error.message,
        url: error.config?.url
      });
    }

    return Promise.reject(error);
  }
);

// Helper function to manually set session ID
api.setSessionId = (sessionId) => {
  if (sessionId) {
    localStorage.setItem('sessionId', sessionId);
    api.defaults.headers.common['X-Session-Id'] = sessionId;
    logger.info('Session ID manually set', {
      sessionId: sessionId.substring(0, 8) + '...'
    });
  }
};

// Helper function to clear session ID
api.clearSessionId = () => {
  localStorage.removeItem('sessionId');
  delete api.defaults.headers.common['X-Session-Id'];
  logger.info('Session ID cleared');
};

// Initialize session on module load if exists
const existingSessionId = localStorage.getItem('sessionId');
if (existingSessionId) {
  api.defaults.headers.common['X-Session-Id'] = existingSessionId;
  logger.info('API initialized with existing session', {
    sessionId: existingSessionId.substring(0, 8) + '...'
  });
}

export default api;