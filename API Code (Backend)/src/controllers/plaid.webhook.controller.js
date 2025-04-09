// controllers/plaid.webhook.controller.js - No MongoDB dependency
const plaidService = require('../services/plaid.service');
const dataService = require('../services/data.service');
const logger = require('../utils/logger');

/**
 * Controller for Plaid webhook events
 * This version doesn't use MongoDB and instead uses in-memory storage
 */
class PlaidWebhookController {
  constructor() {
    // In-memory store for webhook processing status
    this.webhookProcessingStatus = new Map();
    
    // In-memory store for transactions
    this.transactionsStore = new Map();
    
    // In-memory store for item status
    this.itemStatusStore = new Map();
  }
  
  /**
   * Store transactions in memory
   * @param {string} key - Storage key
   * @param {Array} transactions - Transactions to store
   */
  _storeTransactions(key, transactions) {
    this.transactionsStore.set(key, {
      transactions,
      updatedAt: new Date()
    });
  }

  /**
   * Handle Plaid webhook events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleWebhook(req, res) {
    try {
      const { webhook_type, webhook_code, item_id } = req.body;
      
      logger.info(`Received Plaid webhook: ${webhook_type}/${webhook_code} for item ${item_id}`);
      
      // Generate a webhook processing ID
      const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Store initial status
      this.webhookProcessingStatus.set(webhookId, {
        item_id,
        webhook_type,
        webhook_code,
        startTime: new Date(),
        status: 'received'
      });
      
      // Respond to Plaid immediately to acknowledge receipt
      res.status(200).json({ success: true, message: 'Webhook received', webhookId });
      
      // Process the webhook asynchronously
      this._processWebhook(webhookId, req.body).catch(error => {
        logger.error('Error processing webhook:', error);
        
        // Update processing status
        const status = this.webhookProcessingStatus.get(webhookId);
        if (status) {
          status.status = 'error';
          status.error = error.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
      });
      
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({ success: false, message: 'Error processing webhook' });
    }
  }
  
  /**
   * Process the webhook based on type and code
   * @param {string} webhookId - Webhook processing ID
   * @param {Object} webhookData - Webhook payload
   */
  async _processWebhook(webhookId, webhookData) {
    const { webhook_type, webhook_code, item_id } = webhookData;
    
    // Update status to processing
    const status = this.webhookProcessingStatus.get(webhookId);
    status.status = 'processing';
    this.webhookProcessingStatus.set(webhookId, status);
    
    try {
      // Find the user associated with this Plaid item
      // In a real implementation, you'd look this up in a database
      // For now, we'll simulate finding the user
      let userId = null;
      
      // Try to find the user by simulating a lookup
      const allTokens = await this._getAllPlaidTokens();
      for (const [user, tokens] of allTokens) {
        for (const token of tokens) {
          if (token.itemId === item_id) {
            userId = user;
            break;
          }
        }
        if (userId) break;
      }
      
      if (!userId) {
        logger.error(`Could not find user for Plaid item ${item_id}`);
        status.status = 'error';
        status.error = 'User not found';
        status.endTime = new Date();
        this.webhookProcessingStatus.set(webhookId, status);
        return;
      }
      
      // Process based on webhook type
      switch (webhook_type) {
        case 'TRANSACTIONS':
          await this._handleTransactionsWebhook(webhookId, webhookData, userId, item_id);
          break;
          
        case 'ITEM':
          await this._handleItemWebhook(webhookId, webhookData, userId, item_id);
          break;
          
        case 'AUTH':
          await this._handleAuthWebhook(webhookId, webhookData, userId, item_id);
          break;
          
        default:
          logger.info(`Unhandled webhook type: ${webhook_type}/${webhook_code}`);
          status.status = 'ignored';
          status.reason = 'Unsupported webhook type';
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
      }
    } catch (error) {
      logger.error(`Error processing webhook ${webhookId}:`, error);
      status.status = 'error';
      status.error = error.message;
      status.endTime = new Date();
      this.webhookProcessingStatus.set(webhookId, status);
    }
  }
  
  /**
   * Simulate getting all users' Plaid tokens
   * In a real implementation, this would query a database
   * @returns {Map} - Map of user IDs to token arrays
   */
  async _getAllPlaidTokens() {
    // This is a placeholder - in a real implementation,
    // you'd query your database for all Plaid tokens
    
    // For now, return an empty map which would cause webhook processing
    // to fail gracefully when it can't find a matching user
    return new Map();
  }
  
  /**
   * Handle transaction-related webhooks
   * @param {string} webhookId - Webhook processing ID
   * @param {Object} webhookData - Webhook payload
   * @param {string} userId - User ID
   * @param {string} itemId - Plaid item ID
   */
  async _handleTransactionsWebhook(webhookId, webhookData, userId, itemId) {
    const { webhook_code, new_transactions } = webhookData;
    const status = this.webhookProcessingStatus.get(webhookId);
    logger.info(`Processing transactions webhook for user ${userId}, item ${itemId}`);
    
    switch (webhook_code) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        // Sync transactions
        try {
          status.status = 'syncing';
          status.details = `Syncing ${new_transactions} new transactions`;
          this.webhookProcessingStatus.set(webhookId, status);
          
          // Get the access token for this item
          const tokens = await dataService.getPlaidTokens(userId);
          const tokenInfo = tokens.find(token => token.itemId === itemId);
          
          if (!tokenInfo) {
            throw new Error(`Access token not found for item ${itemId}`);
          }
          
          // Get date range (last 30 days by default)
          const endDate = new Date();
          const startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - 30);
          
          // Get transactions from Plaid
          const transactions = await plaidService.getTransactions(
            tokenInfo.accessToken, 
            startDate, 
            endDate
          );
          
          logger.info(`Retrieved ${transactions.length} transactions for user ${userId}`);
          
          // Store updated transactions in memory or cache
          // In a real implementation, you would save this to a database
          // Here we'll store it temporarily in the controller
          const transactionsKey = `transactions-${userId}-${itemId}`;
          this._storeTransactions(transactionsKey, transactions);
          
          status.status = 'completed';
          status.transactionCount = transactions.length;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (error) {
          logger.error(`Error syncing transactions for webhook ${webhookId}:`, error);
          status.status = 'error';
          status.error = error.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      case 'TRANSACTIONS_REMOVED':
        // Handle removed transactions
        try {
          const { removed_transactions } = webhookData;
          
          if (!removed_transactions || !Array.isArray(removed_transactions)) {
            logger.warn('No removed transactions in webhook data');
            status.status = 'skipped';
            status.reason = 'No transactions to remove';
            status.endTime = new Date();
            this.webhookProcessingStatus.set(webhookId, status);
            return;
          }
          
          status.status = 'removing';
          status.details = `Removing ${removed_transactions.length} transactions`;
          this.webhookProcessingStatus.set(webhookId, status);
          
          // In a real implementation, you would remove these transactions from your database
          // Here we'll just log it
          logger.info(`Would remove ${removed_transactions.length} transactions for user ${userId}`);
          
          status.status = 'completed';
          status.removedCount = removed_transactions.length;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (error) {
          logger.error(`Error removing transactions for webhook ${webhookId}:`, error);
          status.status = 'error';
          status.error = error.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      default:
        logger.info(`Unhandled transactions webhook code: ${webhook_code}`);
        status.status = 'ignored';
        status.reason = 'Unsupported webhook code';
        status.endTime = new Date();
        this.webhookProcessingStatus.set(webhookId, status);
    }
  }
  
  /**
   * Handle item-related webhooks
   * @param {string} webhookId - Webhook processing ID
   * @param {Object} webhookData - Webhook payload
   * @param {string} userId - User ID
   * @param {string} itemId - Plaid item ID
   */
  async _handleItemWebhook(webhookId, webhookData, userId, itemId) {
    const { webhook_code, error } = webhookData;
    const status = this.webhookProcessingStatus.get(webhookId);
    
    switch (webhook_code) {
      case 'ERROR':
        // Update item status to error
        try {
          status.status = 'processing';
          status.details = 'Handling item error';
          this.webhookProcessingStatus.set(webhookId, status);
          
          // Store item error status
          this.itemStatusStore.set(`item-${itemId}`, {
            status: 'error',
            error: error,
            updatedAt: new Date()
          });
          
          logger.error(`Plaid item error for user ${userId}: ${error.error_code} - ${error.error_message}`);
          
          status.status = 'completed';
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (err) {
          logger.error(`Error handling item error webhook ${webhookId}:`, err);
          status.status = 'error';
          status.error = err.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      case 'PENDING_EXPIRATION':
        // Update consent expiration
        try {
          status.status = 'processing';
          status.details = 'Handling pending expiration';
          this.webhookProcessingStatus.set(webhookId, status);
          
          if (webhookData.consent_expiration_time) {
            const consentExpiresAt = new Date(webhookData.consent_expiration_time);
            
            // Store expiration info
            this.itemStatusStore.set(`item-${itemId}`, {
              status: 'expiring',
              consentExpiresAt,
              updatedAt: new Date()
            });
            
            logger.warn(`Plaid item consent expiring on ${consentExpiresAt} for user ${userId}`);
          }
          
          status.status = 'completed';
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (err) {
          logger.error(`Error handling pending expiration webhook ${webhookId}:`, err);
          status.status = 'error';
          status.error = err.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      case 'USER_PERMISSION_REVOKED':
        // Mark item as disconnected
        try {
          status.status = 'processing';
          status.details = 'Handling permission revoked';
          this.webhookProcessingStatus.set(webhookId, status);
          
          // Store status
          this.itemStatusStore.set(`item-${itemId}`, {
            status: 'disconnected',
            updatedAt: new Date()
          });
          
          logger.warn(`User permission revoked for item ${itemId}, user ${userId}`);
          
          status.status = 'completed';
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (err) {
          logger.error(`Error handling permission revoked webhook ${webhookId}:`, err);
          status.status = 'error';
          status.error = err.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      default:
        logger.info(`Unhandled item webhook code: ${webhook_code}`);
        status.status = 'ignored';
        status.reason = 'Unsupported webhook code';
        status.endTime = new Date();
        this.webhookProcessingStatus.set(webhookId, status);
    }
  }
  
  /**
   * Handle auth-related webhooks
   * @param {string} webhookId - Webhook processing ID
   * @param {Object} webhookData - Webhook payload
   * @param {string} userId - User ID
   * @param {string} itemId - Plaid item ID
   */
  async _handleAuthWebhook(webhookId, webhookData, userId, itemId) {
    const { webhook_code } = webhookData;
    const status = this.webhookProcessingStatus.get(webhookId);
    
    switch (webhook_code) {
      case 'AUTOMATICALLY_VERIFIED':
      case 'VERIFICATION_EXPIRED':
        // Sync accounts to update status
        try {
          status.status = 'syncing';
          status.details = `Syncing accounts for auth webhook ${webhook_code}`;
          this.webhookProcessingStatus.set(webhookId, status);
          
          // Get the access token for this item
          const tokens = await dataService.getPlaidTokens(userId);
          const tokenInfo = tokens.find(token => token.itemId === itemId);
          
          if (!tokenInfo) {
            throw new Error(`Access token not found for item ${itemId}`);
          }
          
          // Get accounts from Plaid
          const accounts = await plaidService.getAccounts(tokenInfo.accessToken);
          
          logger.info(`Retrieved ${accounts.length} accounts for user ${userId}`);
          
          // Store updated accounts in memory or cache
          // In a real implementation, you would save this to a database
          const accountsKey = `accounts-${userId}-${itemId}`;
          this.transactionsStore.set(accountsKey, {
            accounts,
            updatedAt: new Date()
          });
          
          status.status = 'completed';
          status.accountCount = accounts.length;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        } catch (error) {
          logger.error(`Error syncing accounts for webhook ${webhookId}:`, error);
          status.status = 'error';
          status.error = error.message;
          status.endTime = new Date();
          this.webhookProcessingStatus.set(webhookId, status);
        }
        break;
        
      default:
        logger.info(`Unhandled auth webhook code: ${webhook_code}`);
        status.status = 'ignored';
        status.reason = 'Unsupported webhook code';
        status.endTime = new Date();
        this.webhookProcessingStatus.set(webhookId, status);
    }
  }
}

module.exports = new PlaidWebhookController();