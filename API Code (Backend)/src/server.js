// server.js - removed MongoDB dependency
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const notificationRoutes = require('./routes/notification.routes');
const syncRoutes = require('./routes/sync.routes');
const mobileInsightsRoutes = require('./routes/insights.mobile.routes');

// Initialize environment variables first
dotenv.config();

// Import the logger
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up Sentry for error tracking in production
const Sentry = process.env.NODE_ENV === 'production' ? require('@sentry/node') : null;

if (Sentry) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
  });
  
  app.use(Sentry.Handlers.requestHandler());
}

// Routes
const insightsRoutes = require('./routes/insights.routes');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const plaidRoutes = require('./routes/plaid.routes');
const webhookRoutes = require('./routes/plaid.webhook.routes');
const diagnosticsRoutes = require('./routes/diagnostics.routes');

// Middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const authMiddleware = require('./middleware/auth');
const { validateInsightsRequest } = require('./middleware/validation');

// Rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Middleware
app.use(helmet()); // Security headers

// Configure CORS properly for your frontend
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com' 
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json()); // Parse JSON bodies
app.use(requestLogger(logger)); // Log all requests

// Apply rate limiting to all routes except webhooks
// Use standard Express middleware chaining instead of regex
app.use('/api', (req, res, next) => {
  // Skip rate limiting for webhook routes
  if (req.path.startsWith('/webhooks')) {
    return next();
  }
  // Apply rate limiting to all other API routes
  return apiLimiter(req, res, next);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/insights', authMiddleware, insightsRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api', healthRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
// API v1 routes for mobile
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/mobile', mobileInsightsRoutes);

// Apply validation middleware to insights route
app.use('/api/insights/generate', validateInsightsRequest);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handler middleware (should be last)
app.use(errorHandler);

// Add compression for mobile clients
const compression = require('compression');

// Add compression middleware conditionally for mobile clients
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  
  if (isMobile) {
    // Apply compression for mobile clients
    compression({
      level: 6, // Medium compression level
      threshold: 0 // Compress all responses for mobile
    })(req, res, next);
  } else {
    next();
  }
});

// Add battery-aware rate limiting for mobile
const mobileRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // Higher limit than the API limiter
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use a combination of IP and user ID for authenticated requests
    return req.auth?.userId 
      ? `${req.ip}-${req.auth.userId}` 
      : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for sync operations when battery is low
    // to allow bulk operations during good battery conditions
    if (req.path.includes('/sync/') && req.headers['x-battery-status'] === 'low') {
      return true;
    }
    return false;
  }
});

// Apply mobile rate limiter to v1 API routes
app.use('/api/v1', mobileRateLimiter);

// Add Sentry error handler before your express error handler
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = { app, logger };