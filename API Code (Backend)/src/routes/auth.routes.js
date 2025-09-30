// src/routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const { authMiddleware, authorize } = require('../middleware/auth');
const { sessionMiddleware, requireSession } = require('../middleware/session.middleware'); // Add session middleware

const router = express.Router();

// Apply session middleware to all routes
router.use(sessionMiddleware);

/**
 * @route POST /api/auth/register
 * @desc Register a new user with client credentials
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate a user and get token
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public (with refresh token)
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout and revoke tokens
 * @access Private
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', authMiddleware, authController.changePassword);

/**
 * @route POST /api/auth/change-secret
 * @desc Change client secret
 * @access Private
 */
router.post('/change-secret', authMiddleware, authController.changeClientSecret);

/**
 * @route POST /api/auth/generate-token
 * @desc Generate an API token
 * @access Public (with client credentials)
 */
router.post('/generate-token', authController.generateApiToken);

/**
 * @route POST /api/auth/verify-2fa
 * @desc Verify 2FA token and complete authentication
 * @access Public (with userId from initial login)
 */
router.post('/verify-2fa', authController.verify2FA);

/**
 * @route POST /api/auth/generate-2fa
 * @desc Generate 2FA secret for a user
 * @access Private
 */
router.post('/generate-2fa', authMiddleware, authController.generate2FASecret);

/**
 * @route POST /api/auth/enable-2fa
 * @desc Enable 2FA for a user
 * @access Private
 */
router.post('/enable-2fa', authMiddleware, authController.enable2FA);

/**
 * @route POST /api/auth/disable-2fa
 * @desc Disable 2FA for a user
 * @access Private
 */
router.post('/disable-2fa', authMiddleware, authController.disable2FA);

/**
 * @route GET /api/auth/session-status
 * @desc Check current session status
 * @access Public (with session ID)
 */
router.get('/session-status', authController.getSessionStatus);

module.exports = router;