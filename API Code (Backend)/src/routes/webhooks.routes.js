// src/routes/webhooks.routes.js
const express = require('express');
const router = express.Router();
const { handleSesNotification } = require('../controllers/webhooks/ses.controller');
const logger = require('../utils/logger');

// Middleware to parse raw body for SNS notifications
const rawBodyParser = express.raw({ type: 'application/json', limit: '10mb' });

// SES notification webhook
router.post('/ses',
	rawBodyParser,
	(req, res, next) => {
		// Convert raw buffer to string for processing
		req.body = req.body.toString();
		logger.info('SES webhook received', {
			contentType: req.get('Content-Type'),
			bodyLength: req.body.length,
			ip: req.ip
		});
		next();
	},
	handleSesNotification
);

module.exports = router;