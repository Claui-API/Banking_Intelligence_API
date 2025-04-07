// controllers/plaid.webhook.controller.js
const PlaidItem = require('../models/PlaidItem');
const plaidService = require('../services/plaid.service');
const databaseService = require('../services/database.service');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

/**
 * Controller for Plaid webhook events
 */
class PlaidWebhookController {
  /**
   * Handle Plaid webhook events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleWebhook(req, res) {
    try {
      const { webhook_type, webhook_code, item_id } = req.body;
      
      logger.info(`Received Plaid webhook: ${webhook_type}/${webhook_code} for item ${item_id}`);
      
      // Respond to Plaid immediately to acknowledge receipt
      res.status(200).json({ success: true, message: 'Webhook received' });
      
      // Process the webhook asynchronously
      this._processWebhook(req.body).catch(error => {
        logger.error('Error processing webhook:', error);
      });
      
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({ success: false, message: 'Error processing webhook' });
    }
  }
  
  /**
   * Process the webhook based on type and code
   * @param {Object} webhookData - Webhook payload
   */
  async _processWebhook(webhookData) {
    const { webhook_type, webhook_code, item_id } = webhookData;
    
    // Find the Plaid item in our database
    const plaidItem = await PlaidItem.findOne({ itemId: item_id });
    
    if (!plaidItem) {
      logger.error(`Plaid item ${item_id} not found in database`);
      return;
    }
    
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await this._handleTransactionsWebhook(webhookData, plaidItem);
        break;
        
      case 'ITEM':
        await this._handleItemWebhook(webhookData, plaidItem);
        break;
        
      case 'AUTH':
        await this._handleAuthWebhook(webhookData, plaidItem);
        break;
        
      default:
        logger.info(`Unhandled webhook type: ${webhook_type}/${webhook_code}`);
    }
  }
  
  /**
   * Handle transaction-related webhooks
   * @param {Object} webhookData - Webhook payload
   * @param {Object} plaidItem - Plaid item from database
   */
  async _handleTransactionsWebhook(webhookData, plaidItem) {
    const { webhook_code, new_transactions } = webhookData;
    
    switch (webhook_code) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        // Sync transactions
        await this._syncTransactions(plaidItem);
        break;
        
      case 'TRANSACTIONS_REMOVED':
        // Remove transactions that were deleted on the bank's side
        await this._removeTransactions(webhookData, plaidItem);
        break;
        
      default:
        logger.info(`Unhandled transactions webhook code: ${webhook_code}`);
    }
  }
  
  /**
   * Handle item-related webhooks
   * @param {Object} webhookData - Webhook payload
   * @param {Object} plaidItem - Plaid item from database
   */
  async _handleItemWebhook(webhookData, plaidItem) {
    const { webhook_code, error } = webhookData;
    
    switch (webhook_code) {
      case 'ERROR':
        // Update item status to error
        plaidItem.status = 'error';
        plaidItem.error = error;
        await plaidItem.save();
        
        logger.error(`Plaid item error: ${error.error_code} - ${error.error_message}`);
        break;
        
      case 'PENDING_EXPIRATION':
        // Update consent expiration
        if (webhookData.consent_expiration_time) {
          plaidItem.consentExpiresAt = new Date(webhookData.consent_expiration_time);
          await plaidItem.save();
          
          logger.warn(`Plaid item consent expiring on ${plaidItem.consentExpiresAt}`);
        }
        break;
        
      case 'USER_PERMISSION_REVOKED':
        // Mark item as disconnected
        plaidItem.status = 'disconnected';
        await plaidItem.save();
        
        logger.warn(`User permission revoked for item ${plaidItem.itemId}`);
        break;
        
      default:
        logger.info(`Unhandled item webhook code: ${webhook_code}`);
    }
  }
  
  /**
   * Handle auth-related webhooks
   * @param {Object} webhookData - Webhook payload
   * @param {Object} plaidItem - Plaid item from database
   */
  async _handleAuthWebhook(webhookData, plaidItem) {
    const { webhook_code } = webhookData;
    
    switch (webhook_code) {
      case 'AUTOMATICALLY_VERIFIED':
      case 'VERIFICATION_EXPIRED':
        // Sync accounts to update status
        await this._syncAccounts(plaidItem);
        break;
        
      default:
        logger.info(`Unhandled auth webhook code: ${webhook_code}`);
    }
  }
  
  /**
   * Sync transactions for a Plaid item
   * @param {Object} plaidItem - Plaid item from database
   */
  async _syncTransactions(plaidItem) {
    try {
      const { userId, accessToken } = plaidItem;
      
      // Get date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 30);
      
      // Get transactions from Plaid
      const transactions = await plaidService.getTransactions(accessToken, startDate, endDate);
      
      // Save transactions to database
      for (const transaction of transactions) {
        await Transaction.findOneAndUpdate(
          { 
            userId,
            transactionId: transaction.transactionId
          },
          {
            ...transaction,
            userId
          },
          { upsert: true, new: true }
        );
      }
      
      // Update Plaid item
      plaidItem.lastSuccessfulUpdate = new Date();
      await plaidItem.save();
      
      logger.info(`Synced ${transactions.length} transactions for user ${userId}`);
    } catch (error) {
      logger.error('Error syncing transactions:', error);
      
      // Update Plaid item status
      plaidItem.status = 'error';
      plaidItem.error = {
        errorCode: 'SYNC_ERROR',
        errorMessage: error.message
      };
      await plaidItem.save();
    }
  }
  
  /**
   * Remove transactions that were deleted on the bank's side
   * @param {Object} webhookData - Webhook payload
   * @param {Object} plaidItem - Plaid item from database
   */
  async _removeTransactions(webhookData, plaidItem) {
    try {
      const { userId } = plaidItem;
      const { removed_transactions } = webhookData;
      
      if (!removed_transactions || !Array.isArray(removed_transactions)) {
        logger.warn('No removed transactions in webhook data');
        return;
      }
      
      // Delete transactions from database
      await Transaction.deleteMany({
        userId,
        transactionId: { $in: removed_transactions }
      });
      
      logger.info(`Removed ${removed_transactions.length} transactions for user ${userId}`);
    } catch (error) {
      logger.error('Error removing transactions:', error);
    }
  }
  
  /**
   * Sync accounts for a Plaid item
   * @param {Object} plaidItem - Plaid item from database
   */
  async _syncAccounts(plaidItem) {
    try {
      const { userId, accessToken } = plaidItem;
      
      // Get accounts from Plaid
      const accounts = await plaidService.getAccounts(accessToken);
      
      // Save accounts to database
      for (const account of accounts) {
        await Account.findOneAndUpdate(
          { 
            userId,
            accountId: account.accountId
          },
          {
            ...account,
            userId
          },
          { upsert: true, new: true }
        );
      }
      
      // Get institution info if not already stored
      if (!plaidItem.institutionId || !plaidItem.institutionName) {
        try {
          const itemInfo = await plaidService.getItemInfo(accessToken);
          
          plaidItem.institutionId = itemInfo.institutionId;
          plaidItem.institutionName = itemInfo.institutionName;
        } catch (error) {
          logger.warn('Error getting institution info:', error);
        }
      }
      
      // Update Plaid item
      plaidItem.lastSuccessfulUpdate = new Date();
      await plaidItem.save();
      
      logger.info(`Synced ${accounts.length} accounts for user ${userId}`);
    } catch (error) {
      logger.error('Error syncing accounts:', error);
      
      // Update Plaid item status
      plaidItem.status = 'error';
      plaidItem.error = {
        errorCode: 'SYNC_ERROR',
        errorMessage: error.message
      };
      await plaidItem.save();
    }
  }
}

module.exports = new PlaidWebhookController();