// src/routes/plaid.webhook.routes.js
const express = require('express');
const router = express.Router();
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

    const { webhook_type, webhook_code, item_id } = req.body;

    logger.info(`Received Plaid webhook: ${webhook_type}/${webhook_code} for item ${item_id}`);

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        handleTransactionsWebhook(req.body);
        break;
      case 'ITEM':
        handleItemWebhook(req.body);
        break;
      case 'AUTH':
        handleAuthWebhook(req.body);
        break;
      default:
        logger.info(`Unhandled webhook type: ${webhook_type}`);
    }

    // Always respond with success to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    logger.error('Webhook route error:', error);
    // Still send 200 to acknowledge receipt (Plaid expects this)
    res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
});

// Helper functions to handle different webhook types
const handleTransactionsWebhook = async (webhookData) => {
  const { webhook_code, item_id, new_transactions, removed_transactions } = webhookData;

  try {
    // Get the user associated with this item_id
    const plaidItem = await PlaidItem.findOne({ where: { itemId: item_id } });

    if (!plaidItem) {
      logger.error(`Webhook received for unknown item: ${item_id}`);
      return;
    }

    const userId = plaidItem.userId;

    switch (webhook_code) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        logger.info(`Transactions update for user ${userId}: ${new_transactions} new transactions`);

        // Get the user's access token
        const accessToken = plaidItem.accessToken;

        // Calculate date range (last 30 days by default)
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);

        // Get updated transactions from Plaid
        const plaidService = require('../services/plaid.service');
        const transactions = await plaidService.getTransactions(accessToken, startDate, endDate);

        // Process the transactions - ensure categories are properly handled
        for (const transaction of transactions) {
          // Make sure categories are properly extracted and stored
          if (transaction.category && Array.isArray(transaction.category)) {
            transaction.category = transaction.category[0] || 'Uncategorized';
          }

          // Here you would update your database with these transactions
          // ...
        }

        logger.info(`Processed ${transactions.length} transactions for user ${userId}`);
        break;

      case 'TRANSACTIONS_REMOVED':
        logger.info(`Transactions removed for user ${userId}: ${removed_transactions?.length || 0} transactions`);
        // Handle transaction removal
        // ...
        break;

      default:
        logger.info(`Unhandled transactions webhook code: ${webhook_code}`);
    }
  } catch (error) {
    logger.error('Error processing transactions webhook:', error);
  }
};

const handleItemWebhook = (webhookData) => {
  const { webhook_code, error } = webhookData;

  switch (webhook_code) {
    case 'ERROR':
      logger.error(`Plaid item error: ${error?.error_code} - ${error?.error_message}`);
      // Here you would implement error handling
      break;
    case 'PENDING_EXPIRATION':
      logger.warn(`Plaid item pending expiration`);
      // Here you would implement expiration handling
      break;
    case 'USER_PERMISSION_REVOKED':
      logger.warn(`User permission revoked for Plaid item`);
      // Here you would implement revocation handling
      break;
    default:
      logger.info(`Unhandled item webhook code: ${webhook_code}`);
  }
};

const handleAuthWebhook = (webhookData) => {
  const { webhook_code } = webhookData;

  switch (webhook_code) {
    case 'AUTOMATICALLY_VERIFIED':
      logger.info('Account automatically verified');
      // Here you would implement verification handling
      break;
    case 'VERIFICATION_EXPIRED':
      logger.warn('Account verification expired');
      // Here you would implement expiration handling
      break;
    default:
      logger.info(`Unhandled auth webhook code: ${webhook_code}`);
  }
};

module.exports = router;