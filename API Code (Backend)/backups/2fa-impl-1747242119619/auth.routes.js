// src/routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;