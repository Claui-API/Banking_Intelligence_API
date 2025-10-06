// server.js - Fixed configuration for trust proxy and rate limiting

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Load .env variables FIRST
dotenv.config();

const { sequelize } = require('./config/database');
const dataRetentionService = require('./services/data-retention.service');
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============= CRITICAL CONFIGURATION ORDER =============

// 1. TRUST PROXY CONFIGURATION - MUST BE FIRST
// Set trust proxy based on environment with proper configuration
if (process.env.NODE_ENV === 'production') {
  // In production, trust the first proxy (load balancer/reverse proxy)
  app.set('trust proxy', 1);
  logger.info('Trust proxy enabled for production (trusting 1 proxy)');
} else {
  // In development, don't trust any proxy
  app.set('trust proxy', false);
  logger.info('Trust proxy disabled for development');
}

// 2. BODY PARSING - MUST COME EARLY
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. SECURITY MIDDLEWARE
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// 4. CORS CONFIGURATION
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://bankingintelligenceapi.com', 'https://www.bankingintelligenceapi.com']
    : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// 5. REQUEST LOGGING
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger(logger));

// ============= RATE LIMITING CONFIGURATION =============

// Import our fixed rate limiting middleware
const {
  contactFormRateLimit,
  generalRateLimit,
  authRateLimit,
  spamDetectionMiddleware
} = require('./middleware/rateLimiting');

// General API rate limiter with proper trust proxy handling
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Higher limits for authenticated admin users
    if (req.auth && req.auth.role === 'admin') return 5000;
    // Normal limit for authenticated users
    if (req.auth && req.auth.userId) return 2000;
    // Lower limit for unauthenticated users
    return 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy configuration
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  keyGenerator: (req) => {
    // Use authenticated user ID if available, otherwise IP
    if (req.auth && req.auth.userId) {
      return `user:${req.auth.userId}`;
    }

    // In production with trusted proxy, use the forwarded IP
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
      const forwardedIP = req.headers['x-forwarded-for'].split(',')[0].trim();
      return `ip:${forwardedIP}`;
    }

    return `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip for health checks
    if (req.path === '/health' || req.path === '/api/health') return true;
    // Skip for webhooks
    if (req.path.startsWith('/webhooks')) return true;
    return false;
  },
  handler: (req, res) => {
    const identifier = req.auth ? `user ${req.auth.userId}` : `IP ${req.ip}`;
    logger.warn('API rate limit exceeded', {
      identifier,
      ip: req.ip,
      forwarded: req.headers['x-forwarded-for'],
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      type: 'rate_limit_exceeded',
      retryAfter: 900 // 15 minutes in seconds
    });
  }
});

// ============= MIDDLEWARE IMPORTS =============
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const retentionLoggingMiddleware = require('./middleware/retention-logging.middleware');
const { authMiddleware } = require('./middleware/auth');
const { validateInsightsRequest } = require('./middleware/validation');
const { insightMetricsMiddleware, initializeMetricsModel } = require('./middleware/insights-metrics.middleware');
const mobileOptimizer = require('./middleware/mobile-optimizer');
const { usageNotificationMiddleware } = require('./middleware/usage-notification.middleware');

// ============= DEBUG MIDDLEWARE =============
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path.includes('/api/bank/users')) {
    logger.debug('Bank Users API Debug', {
      url: req.originalUrl,
      contentType: req.get('Content-Type'),
      bodyKeys: Object.keys(req.body),
      hasBankUserId: req.body.bankUserId !== undefined,
      hasClientId: req.body.clientId !== undefined
    });
  }
  next();
});

// ============= SERVICE INITIALIZATION =============

// Initialize data retention service
(async () => {
  try {
    await dataRetentionService.initialize();
    logger.info('Data retention service initialized');
    app.use(retentionLoggingMiddleware(sequelize));
  } catch (error) {
    logger.error('Error initializing data retention service:', error);
  }
})();

// Initialize email notification service
const emailNotificationService = require('./services/email.notification.service');
(async () => {
  try {
    await emailNotificationService.initializeService();
    if (emailNotificationService.initialized) {
      logger.info('Email notification service initialized successfully');
    } else {
      logger.warn('Email notification service failed to initialize');
    }
  } catch (error) {
    logger.error('Error initializing email notification service:', error);
  }
})();

// Initialize metrics
const initializeMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    if (metricsModel) {
      const count = await metricsModel.count();
      logger.info(`Initialized metrics system with ${count} records`);
    }
  } catch (error) {
    logger.error('Error initializing metrics:', error);
  }
};

// ============= ROUTE IMPORTS =============
const contactRoutes = require('./routes/contact.routes');
const notificationPreferencesRoutes = require('./routes/notification-preferences.routes');
const webhookRoutes = require('./routes/webhooks.routes');
const unsubscribeRoutes = require('./routes/unsubscribe.routes');
const dataRetentionRoutes = require('./routes/data-retention.routes');
const adminRetentionRoutes = require('./routes/admin.retention.routes');
const userRoutes = require('./routes/user.routes');
const bankApiRoutes = require('./routes/bank-api.routes');
const bankClientRoutes = require('./routes/bank-client.routes');

// ============= RATE LIMITED ROUTES =============

// Apply specific rate limiters to sensitive endpoints
app.use('/api/auth', authRateLimit);
app.use('/api/contact', contactFormRateLimit, spamDetectionMiddleware);

// Apply general API rate limiting (exclude webhooks)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  return apiLimiter(req, res, next);
});

// ============= ROUTE MOUNTING =============

// Helper function for safe route mounting
function safeMount(path, routeModule, name) {
  try {
    if (!routeModule) {
      logger.error(`${name} routes module is undefined`);
      return false;
    }

    if (typeof routeModule === 'function' || (routeModule && typeof routeModule.use === 'function')) {
      app.use(path, routeModule);
      logger.info(`Mounted ${name} routes at ${path}`);
      return true;
    }

    logger.error(`${name} is not a valid Express router`);
    return false;
  } catch (error) {
    logger.error(`Error mounting ${name} routes:`, error);
    return false;
  }
}

// Mount core routes
safeMount('/api/v1/data', dataRetentionRoutes, 'Data Retention');
safeMount('/api/admin/retention', adminRetentionRoutes, 'Admin Retention');
safeMount('/api/users', userRoutes, 'User Routes');
safeMount('/api/bank-client', bankClientRoutes, 'Bank Client Dashboard');
safeMount('/api/v1/notifications/preferences', notificationPreferencesRoutes, 'Notification Preferences');
safeMount('/api/bank', bankApiRoutes, 'Bank API');
safeMount('/api/contact', contactRoutes, 'Contact');
safeMount('/webhooks', webhookRoutes, 'Webhooks');
safeMount('/unsubscribe', unsubscribeRoutes, 'Unsubscribe');

// Mount other API routes
const routes = [
  { path: '/api/auth', name: 'Auth', importPath: './routes/auth.routes' },
  { path: '/api/insights', name: 'Insights', importPath: './routes/insights.routes' },
  { path: '/api/plaid', name: 'Plaid', importPath: './routes/plaid.routes' },
  { path: '/api/webhooks', name: 'Plaid Webhooks', importPath: './routes/plaid.webhook.routes' },
  { path: '/api', name: 'Health', importPath: './routes/health.routes' },
  { path: '/api/banking-command', name: 'Banking Command', importPath: './routes/banking-command.routes' },
  { path: '/api/diagnostics', name: 'Diagnostics', importPath: './routes/diagnostics.routes' },
  { path: '/api/admin', name: 'Admin', importPath: './routes/admin.routes' },
  { path: '/api/clients', name: 'Clients', importPath: './routes/client.routes' },
  { path: '/api/insights-metrics', name: 'Insight Metrics', importPath: './routes/insights-metrics.routes' },
  { path: '/api/v1/notifications', name: 'Notifications', importPath: './routes/notification.routes' },
  { path: '/api/v1/sync', name: 'Sync', importPath: './routes/sync.routes' },
  { path: '/api/v1/mobile', name: 'Mobile Insights', importPath: './routes/insights.mobile.routes' }
];

routes.forEach(route => {
  try {
    const routeModule = require(route.importPath);
    safeMount(route.path, routeModule, route.name);
  } catch (error) {
    logger.error(`Error loading ${route.name} routes:`, error);
    // Create fallback route
    const router = express.Router();
    router.all('*', (req, res) => {
      res.status(503).json({
        success: false,
        message: `${route.name} service temporarily unavailable`
      });
    });
    safeMount(route.path, router, `${route.name} Fallback`);
  }
});

// ============= ADDITIONAL MIDDLEWARE =============

app.use(insightMetricsMiddleware);
app.use(mobileOptimizer);

// Auth middleware for protected routes
app.use('/api', (req, res, next) => {
  // Skip for certain routes
  if (req.path.startsWith('/webhooks') ||
    req.path === '/health' ||
    req.path.endsWith('/health') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/contact')) {
    return next();
  }

  // Apply auth middleware
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    // Apply usage notification middleware for authenticated routes
    usageNotificationMiddleware(req, res, next);
  });
});

// ============= STATIC FILE SERVING =============

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(__dirname, '..', 'API UI (Frontend)', 'build');

  app.use(express.static(clientBuildPath, {
    maxAge: '1d',
    etag: false
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// ============= ERROR HANDLING =============

// 404 handler for API routes
app.use('/api', notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============= SERVER STARTUP =============

// Initialize scheduled jobs
const { initializeJobs } = require('./jobs/job-scheduler');
initializeJobs();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info('Trust proxy setting:', app.get('trust proxy'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Run initialization
initializeMetrics();

module.exports = { app, server, logger };