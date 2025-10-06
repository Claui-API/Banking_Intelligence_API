// src/routes/unsubscribe.routes.js
const express = require('express');
const router = express.Router();
const {
	handleUnsubscribe,
	handleManualUnsubscribe,
	showUnsubscribePage
} = require('../controllers/unsubscribe.controller');

// Show unsubscribe form
router.get('/', showUnsubscribePage);

// Handle unsubscribe from email link
router.get('/confirm', handleUnsubscribe);

// Handle manual unsubscribe form submission
router.post('/submit', handleManualUnsubscribe);

module.exports = router;