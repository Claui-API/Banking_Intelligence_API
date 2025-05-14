// server.js - Updated with safe route mounting
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Load .env variables
dotenv.config();

// Application logger
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { authMiddleware, authorize } = require('./middleware/auth');
const { validateInsightsRequest } = require('./middleware/validation');
const { insightMetricsMiddleware, initializeMetricsModel } = require('./middleware/insights-metrics.middleware');

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

// Safely import and mount all routes
const routes = [
  { path: '/api/auth', name: 'Auth', importPath: './routes/auth.routes' },
  { path: '/api/insights', name: 'Insights', importPath: './routes/insights.routes', middleware: authMiddleware },
  { path: '/api/plaid', name: 'Plaid', importPath: './routes/plaid.routes' },
  { path: '/api/webhooks', name: 'Plaid Webhooks', importPath: './routes/plaid.webhook.routes' },
  { path: '/api', name: 'Health', importPath: './routes/health.routes' },
  { path: '/api/diagnostics', name: 'Diagnostics', importPath: './routes/diagnostics.routes' },
  { path: '/api/admin', name: 'Admin', importPath: './routes/admin.routes' },
  { path: '/api/clients', name: 'Clients', importPath: './routes/client.routes' },
  { path: '/api/insights-metrics', name: 'Insight Metrics', importPath: './routes/insights-metrics.routes' },
  { path: '/api/v1/notifications', name: 'Notifications', importPath: './routes/notification.routes' },
  { path: '/api/v1/sync', name: 'Sync', importPath: './routes/sync.routes' },
  { path: '/api/v1/mobile', name: 'Mobile Insights', importPath: './routes/insights.mobile.routes' }
];

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

// Run initialization
initializeMetrics();

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
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
app.use(express.json());
app.use(requestLogger(logger));
app.use(insightMetricsMiddleware);

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