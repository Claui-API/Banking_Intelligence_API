// server.js - Updated with user routes and improved security

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { sequelize } = require('./config/database');
const dataRetentionService = require('./services/data-retention.service');
const { usageNotificationMiddleware } = require('./middleware/usage-notification.middleware');
const notificationPreferencesRoutes = require('./routes/notification-preferences.routes');
const { initializeJobs } = require('./jobs/job-scheduler');

// Load .env variables
dotenv.config();

// Application logger
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Body parsing middleware must come FIRST - MOVED FROM BELOW
app.use(express.json({
  verify: (req, res, buf) => {
    // Store the raw body for verification or debugging if needed
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// Add debugging middleware to inspect request bodies
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path.includes('/api/bank/users')) {
    console.log('==== DEBUG REQUEST BODY ====');
    console.log('Request URL:', req.originalUrl);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body:', req.body);
    console.log('Keys:', Object.keys(req.body));
    console.log('Has bankUserId:', req.body.bankUserId !== undefined);
    console.log('===========================');
  }
  next();
});

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const retentionLoggingMiddleware = require('./middleware/retention-logging.middleware');
const requestLogger = require('./middleware/requestLogger');
const { authMiddleware, authorize, protectFinancialData } = require('./middleware/auth');
const { validateInsightsRequest } = require('./middleware/validation');
const { insightMetricsMiddleware, initializeMetricsModel } = require('./middleware/insights-metrics.middleware');
const mobileOptimizer = require('./middleware/mobile-optimizer');

// Helper function to safely mount routes
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

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: function (req, res) {
    return req.auth && req.auth.role === 'admin';
  },
  keyGenerator: function (req) {
    if (req.auth && req.auth.userId) {
      return req.auth.userId;
    }
    return req.ip;
  },
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Initialize email notification service
const emailNotificationService = require('./services/email.notification.service');

// Initialize notification services
(async () => {
  try {
    // Test email service connection
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

// Define twoFactorLimiter here, BEFORE trying to use it
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Stricter limit for 2FA attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many 2FA verification attempts, please try again later.' }
});

// Initialize data retention service
(async () => {
  try {
    // Initialize the data retention service
    await dataRetentionService.initialize();
    logger.info('Data retention service initialized');

    // Apply retention logging middleware
    app.use(retentionLoggingMiddleware(sequelize));

  } catch (error) {
    logger.error('Error initializing data retention service:', error);
  }
})();

// Import data retention routes
const dataRetentionRoutes = require('./routes/data-retention.routes');
const adminRetentionRoutes = require('./routes/admin.retention.routes');

// Import user routes - NEW
const userRoutes = require('./routes/user.routes');
const bankApiRoutes = require('./routes/bank-api.routes');
const bankClientRoutes = require('./routes/bank-client.routes');

// Safely import and mount all routes
const routes = [
  { path: '/api/auth', name: 'Auth', importPath: './routes/auth.routes' },
  { path: '/api/insights', name: 'Insights', importPath: './routes/insights.routes', middleware: authMiddleware },
  { path: '/api/plaid', name: 'Plaid', importPath: './routes/plaid.routes' },
  { path: '/api/users', name: 'Users', importPath: './routes/user.routes' }, // NEW: User routes
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

// Mount data retention routes
safeMount('/api/v1/data', dataRetentionRoutes, 'Data Retention');

// Mount admin retention routes as part of admin routes
safeMount('/api/admin/retention', adminRetentionRoutes, 'Admin Retention');

// Mount user routes - NEW
safeMount('/api/users', userRoutes, 'User Routes');
safeMount('/api/bank-client', bankClientRoutes, 'Bank Client Dashboard');

safeMount('/api/v1/notifications/preferences', notificationPreferencesRoutes, 'Notification Preferences');

// Apply 2FA rate limiter to specific endpoint
app.use('/api/auth/verify-2fa', twoFactorLimiter);
app.use('/api/bank', bankApiRoutes);

// Add debug endpoint for direct testing
app.use('/api/bank-debug/users', (req, res) => {
  console.log('DIRECT BANK USERS DEBUG ENDPOINT');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Raw:', req.rawBody);

  // Echo back what was received
  res.json({
    success: true,
    received: {
      body: req.body,
      contentType: req.get('Content-Type'),
      authorization: req.headers.authorization ? 'Present (hidden)' : 'Missing'
    }
  });
});

// Test insights metrics on startup
const initializeMetrics = async () => {
  try {
    const metricsModel = await initializeMetricsModel();
    if (metricsModel) {
      const count = await metricsModel.count();
      console.log(`✅ Initialized metrics system with ${count} records`);
    } else {
      console.log('⚠️ Metrics model initialization failed');
    }
  } catch (error) {
    console.error('❌ Error initializing metrics:', error);
  }
};

// Make sure auth middleware is applied before usage notification middleware
app.use('/api', (req, res, next) => {
  // Skip webhooks and health checks
  if (req.path.startsWith('/webhooks') ||
    req.path === '/health' ||
    req.path.endsWith('/health')) {
    return next();
  }

  // For auth routes, skip usage monitoring
  if (req.path.startsWith('/auth')) {
    return next();
  }

  // Apply auth middleware
  authMiddleware(req, res, (err) => {
    if (err) return next(err);

    // Then apply usage notification middleware for authenticated routes
    usageNotificationMiddleware(req, res, next);
  });
});

// Initialize scheduled jobs
initializeJobs();

// Run initialization
initializeMetrics();

// Apply middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://bankingintelligenceapi.com'
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// REMOVED: app.use(express.json()); - Already added at the top
app.use(requestLogger(logger));
app.use(insightMetricsMiddleware);
app.use(mobileOptimizer); // Add mobile optimization middleware

// Apply rate limiting to /api except webhooks
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') &&
    !req.path.startsWith('/auth/login') &&
    !req.path.startsWith('/auth/register')) {

    try {
      const token = authHeader.split(' ')[1];
      const decodedToken = jwt.decode(token);
      if (decodedToken && decodedToken.role === 'admin') {
        return next();
      }
    } catch (e) {
      // If token parsing fails, continue with rate limiting
    }
  }

  return apiLimiter(req, res, next);
});

// Mount routes safely
logger.info('Mounting API routes...');
routes.forEach(route => {
  try {
    let routeModule = null;

    try {
      routeModule = require(route.importPath);
    } catch (importError) {
      logger.error(`Failed to import ${route.name} routes:`, importError);
      // Create fallback route
      const router = express.Router();
      router.all('*', (req, res) => {
        res.status(503).json({ success: false, message: `${route.name} routes unavailable` });
      });
      routeModule = router;
    }

    if (route.middleware) {
      safeMount(route.path, route.middleware, `${route.name} Middleware`);
    }

    safeMount(route.path, routeModule, route.name);
  } catch (error) {
    logger.error(`Error processing ${route.name} routes:`, error);
  }
});

// Make sure we still handle insights validation
try {
  app.use('/api/insights/generate', validateInsightsRequest);
  logger.info('Insights validation middleware mounted');
} catch (error) {
  logger.error('Failed to mount insights validation middleware:', error);
}

// 404 handler for API
app.use('/api', notFoundHandler);

// Compression for mobile clients
const compression = require('compression');
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    return compression({ level: 6, threshold: 0 })(req, res, next);
  }
  next();
});

// Battery-aware mobile rate limiter
const mobileRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req =>
    req.auth?.userId ? `${req.ip}-${req.auth.userId}` : req.ip,
  skip: req =>
    req.path.includes('/sync/') && req.headers['x-battery-status'] === 'low'
});
app.use('/api/v1', mobileRateLimiter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(
    __dirname,
    '..',                   // up from "API Code (Backend)"
    'API UI (Frontend)',    // your front-end folder
    'build'
  );

  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Final error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful shutdown on unhandled rejections
process.on('unhandledRejection', err => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

module.exports = { app, logger };