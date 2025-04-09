// controllers/sync.controller.js - No MongoDB dependency
const logger = require('../utils/logger');
const dataService = require('../services/data.service');
const crypto = require('crypto');

class SyncController {
  constructor() {
    // In-memory store for sync packages
    this.syncPackages = new Map();
    
    // In-memory store for transactions modified by mobile clients
    // In a production environment, you'd use a more persistent storage solution
    this.mobileTransactions = new Map();
  }

  /**
   * Generate a sync package for mobile apps to enable offline usage
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateSyncPackage(req, res) {
    try {
      const { userId } = req.auth;
      const { lastSyncTimestamp } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Convert lastSyncTimestamp to Date if provided
      let lastSync = null;
      if (lastSyncTimestamp) {
        lastSync = new Date(lastSyncTimestamp);
        if (isNaN(lastSync.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid lastSyncTimestamp format'
          });
        }
      }
      
      // Get data for sync
      const userData = await dataService.getUserFinancialData(userId);
      
      // Create sync package
      const syncPackage = this._createSyncPackage(userData, lastSync);
      
      // Generate an ID for this sync package
      const syncId = crypto.randomUUID();
      
      // Store the sync package for tracking
      this.syncPackages.set(syncId, {
        userId,
        timestamp: new Date(),
        packageSize: JSON.stringify(syncPackage).length,
        syncType: lastSync ? 'delta' : 'full',
        deviceInfo: req.headers['user-agent'],
        processed: false
      });
      
      return res.status(200).json({
        success: true,
        data: {
          ...syncPackage,
          syncId
        }
      });
    } catch (error) {
      logger.error('Error generating sync package:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate sync package'
      });
    }
  }
  
  /**
   * Accept changes from mobile app to process after being offline
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processMobileChanges(req, res) {
    try {
      const { userId } = req.auth;
      const { changes, syncId } = req.body;
      
      if (!userId || !changes) {
        return res.status(400).json({
          success: false,
          message: 'User ID and changes are required'
        });
      }
      
      // Process each type of change
      const results = {
        accepted: [],
        rejected: [],
        conflicts: []
      };
      
      // Process changes by type
      if (changes.transactions) {
        const txResults = await this._processTransactionChanges(userId, changes.transactions);
        results.accepted.push(...txResults.accepted);
        results.rejected.push(...txResults.rejected);
        results.conflicts.push(...txResults.conflicts);
      }
      
      // Record sync results
      if (syncId && this.syncPackages.has(syncId)) {
        const syncPackage = this.syncPackages.get(syncId);
        syncPackage.processed = true;
        syncPackage.processedAt = new Date();
        syncPackage.results = {
          accepted: results.accepted.length,
          rejected: results.rejected.length,
          conflicts: results.conflicts.length
        };
        
        this.syncPackages.set(syncId, syncPackage);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Changes processed',
        data: results
      });
    } catch (error) {
      logger.error('Error processing mobile changes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process changes'
      });
    }
  }
  
  /**
   * Create a sync package with all necessary data for offline usage
   * @param {Object} userData - User financial data
   * @param {Date} lastSync - Timestamp of last sync
   * @returns {Object} - Sync package object
   */
  _createSyncPackage(userData, lastSync) {
    const { accounts, transactions } = userData;
    
    // Filter data based on lastSync if provided
    let filteredAccounts = accounts;
    let filteredTransactions = transactions;
    
    if (lastSync) {
      // In a real implementation with actual timestamps, you'd filter by last update time
      // For our mock implementation, we'll include everything since we don't have real timestamps
      // This is a placeholder for the real filtering logic
      logger.info(`Delta sync requested since ${lastSync.toISOString()}`);
    }
    
    // For transactions, only include recent ones for full sync
    if (!lastSync) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      filteredTransactions = transactions.filter(tx => 
        new Date(tx.date) >= ninetyDaysAgo
      );
    }
    
    // Generate checksums for conflict detection
    const accountChecksums = filteredAccounts.map(account => ({
      id: account.accountId,
      checksum: this._generateChecksum(account)
    }));
    
    const transactionChecksums = filteredTransactions.map(transaction => ({
      id: transaction.transactionId,
      checksum: this._generateChecksum(transaction)
    }));
    
    // Create and return the sync package
    return {
      timestamp: new Date().toISOString(),
      accounts: filteredAccounts,
      transactions: filteredTransactions,
      checksums: {
        accounts: accountChecksums,
        transactions: transactionChecksums
      },
      syncType: lastSync ? 'delta' : 'full'
    };
  }
  
  /**
   * Process transaction changes from mobile
   * @param {string} userId - User ID
   * @param {Array} transactions - Transaction changes from mobile
   * @returns {Object} - Processing results
   */
  async _processTransactionChanges(userId, transactions) {
    const results = {
      accepted: [],
      rejected: [],
      conflicts: []
    };
    
    // Get existing transactions from our store
    const userTransactionsKey = `transactions-${userId}`;
    let existingTransactions = this.mobileTransactions.get(userTransactionsKey) || [];
    
    // Process each transaction change
    for (const txChange of transactions) {
      try {
        // Validate that this transaction belongs to the user
        if (txChange.userId && txChange.userId !== userId) {
          results.rejected.push({
            id: txChange.transactionId,
            reason: 'User ID mismatch'
          });
          continue;
        }
        
        // Set the user ID explicitly
        txChange.userId = userId;
        
        // Check if transaction exists in our store
        const existingTxIndex = existingTransactions.findIndex(tx => 
          tx.transactionId === txChange.transactionId
        );
        
        if (existingTxIndex >= 0) {
          // Transaction exists - check for conflicts
          const existingTx = existingTransactions[existingTxIndex];
          const serverChecksum = this._generateChecksum(existingTx);
          const baseChecksum = txChange._baseChecksum;
          
          // If client has an older version than the server's current version
          if (baseChecksum && baseChecksum !== serverChecksum) {
            // We have a conflict
            results.conflicts.push({
              id: txChange.transactionId,
              clientVersion: txChange,
              serverVersion: existingTx
            });
            continue;
          }
          
          // No conflict - update the transaction
          txChange.updatedAt = new Date();
          existingTransactions[existingTxIndex] = txChange;
          
          results.accepted.push({
            id: txChange.transactionId,
            type: 'update'
          });
        } else {
          // Transaction doesn't exist - create it
          const newTx = {
            ...txChange,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          existingTransactions.push(newTx);
          
          results.accepted.push({
            id: newTx.transactionId,
            type: 'create'
          });
        }
      } catch (error) {
        logger.error(`Error processing transaction change for ${txChange.transactionId}:`, error);
        results.rejected.push({
          id: txChange.transactionId,
          reason: error.message
        });
      }
    }
    
    // Save updated transactions back to our store
    this.mobileTransactions.set(userTransactionsKey, existingTransactions);
    
    return results;
  }
  
  /**
   * Generate a checksum for an object to detect changes
   * @param {Object} obj - Object to generate checksum for
   * @returns {string} - Checksum string
   */
  _generateChecksum(obj) {
    // A simple checksum implementation
    // In production, you'd use a more robust hashing algorithm
    const stringValue = JSON.stringify(obj);
    let hash = 0;
    
    for (let i = 0; i < stringValue.length; i++) {
      const char = stringValue.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16);
  }
}

module.exports = new SyncController();