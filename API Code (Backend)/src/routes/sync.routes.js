// routes/sync.routes.js
const express = require('express');
const syncController = require('../controllers/sync.controller');
const authMiddleware = require('../middleware/auth');
const mobileOptimizer = require('../middleware/mobile-optimizer');

const router = express.Router();

/**
 * @route GET /api/v1/sync/package
 * @desc Get a sync package for offline use
 * @access Private
 */
router.get('/package', authMiddleware, mobileOptimizer, syncController.generateSyncPackage);

/**
 * @route POST /api/v1/sync/changes
 * @desc Process changes from mobile client after being offline
 * @access Private
 */
router.post('/changes', authMiddleware, syncController.processMobileChanges);

module.exports = router;