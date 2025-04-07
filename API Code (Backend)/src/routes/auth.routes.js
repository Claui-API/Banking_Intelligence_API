// auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const { validateLogin, validateRegister } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new bank client application
 * @access Public
 */
router.post('/register', validateRegister, authController.register.bind(authController));

/**
 * @route POST /api/auth/login
 * @desc Authenticate a client and get token
 * @access Public
 */
router.post('/login', validateLogin, authController.login.bind(authController));

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public (with refresh token)
 */
router.post('/refresh', authController.refreshToken.bind(authController));

module.exports = router;