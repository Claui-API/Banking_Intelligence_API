// server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const notificationRoutes = require('./routes/notification.routes');
const syncRoutes = require('./routes/sync.routes');
const mobileInsightsRoutes = require('./routes/insights.mobile.routes');
const adminRoutes = require('./routes/admin.routes'); // Add admin routes

// Load .env variables
dotenv.config();

// Application logger
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes & middleware
const insightsRoutes = require('./routes/insights.routes');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const plaidRoutes = require('./routes/plaid.routes');
const webhookRoutes = require('./routes/plaid.webhook.routes');
const diagnosticsRoutes = require('./routes/diagnostics.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { authMiddleware } = require('./middleware/auth');
const { validateInsightsRequest } = require('./middleware/validation');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://bankingintelligenceapi.com'
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(requestLogger(logger));

// Apply rate limiting to /api except webhooks
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  return apiLimiter(req, res, next);
});

// Core routes
app.use('/api/auth', authRoutes);
app.use('/api/insights', authMiddleware, insightsRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api', healthRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/admin', adminRoutes); // Add admin routes

// Mobile v1 routes
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/mobile', mobileInsightsRoutes);

// Insights validation
app.use('/api/insights/generate', validateInsightsRequest);

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

// ─── HERE: SERVE YOUR FRONTEND ────────────────────────────────
// only in production, after all /api routes
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(
    __dirname,
    '..',                   // up from "API Code (Backend)"
    'API UI (Frontend)',    // your front-end folder
    'build'
  );

  // serve static assets
  app.use(express.static(clientBuildPath));

  // catch-all (skip any /api requests)
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
  logger.info(
    `Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
  );
});

// Graceful shutdown on unhandled rejections
process.on('unhandledRejection', err => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

module.exports = { app, logger };