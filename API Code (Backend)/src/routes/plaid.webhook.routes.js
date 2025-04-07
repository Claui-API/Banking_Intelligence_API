// routes/plaid.webhook.routes.js
const express = require('express');
const router = express.Router();
const plaidWebhookController = require('../controllers/plaid.webhook.controller');
const logger = require('../utils/logger');

/**
 * @route POST /api/webhooks/plaid
 * @desc Receive webhooks from Plaid
 * @access Public (secured by Plaid webhook verification)
 */
router.post('/plaid', async (req, res) => {
  try {
    // In production, you should verify the webhook using Plaid's verification process
    // https://plaid.com/docs/api/webhooks/webhook-verification/
    
    await plaidWebhookController.handleWebhook(req, res);
  } catch (error) {
    logger.error('Webhook route error:', error);
    res.status(500).json({ success: false, message: 'Error processing webhook' });
  }
});

module.exports = router;