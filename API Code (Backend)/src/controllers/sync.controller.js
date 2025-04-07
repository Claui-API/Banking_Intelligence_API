// controllers/sync.controller.js
const SyncPackage = require('../models/SyncPackage');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const logger = require('../utils/logger');

class SyncController {
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
      
      // Get data changed since last sync
      const syncPackage = await this._createSyncPackage(userId, lastSync);
      
      // Save the sync package for tracking
      const packageRecord = new SyncPackage({
        userId,
        timestamp: new Date(),
        packageSize: JSON.stringify(syncPackage).length,
        syncType: lastSync ? 'delta' : 'full',
        deviceInfo: req.headers['user-agent']
      });
      
      await packageRecord.save();
      
      return res.status(200).json({
        success: true,
        data: {
          ...syncPackage,
          syncId: packageRecord._id
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
      if (syncId) {
        await SyncPackage.findByIdAndUpdate(syncId, {
          $set: {
            processed: true,
            processedAt: new Date(),
            results: {
              accepted: results.accepted.length,
              rejected: results.rejected.length,
              conflicts: results.conflicts.length
            }
          }
        });
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
   * @param {string} userId - User ID
   * @param {Date} lastSync - Timestamp of last sync
   * @returns {Object} - Sync package object
   */
  async _createSyncPackage(userId, lastSync) {
    // Query for accounts
    const accountQuery = { userId };
    if (lastSync) {
      accountQuery.lastUpdated = { $gte: lastSync };
    }
    
    const accounts = await Account.find(accountQuery);
    
    // Query for transactions
    const transactionQuery = { userId };
    if (lastSync) {
      transactionQuery.updatedAt = { $gte: lastSync };
    }
    
    // Only get recent transactions (e.g., last 90 days) for full sync
    if (!lastSync) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      transactionQuery.date = { $gte: ninetyDaysAgo };
    }
    
    const transactions = await Transaction.find(transactionQuery);
    
    // Generate checksums for conflict detection
    const accountChecksums = accounts.map(account => ({
      id: account.accountId,
      checksum: this._generateChecksum(account)
    }));
    
    const transactionChecksums = transactions.map(transaction => ({
      id: transaction.transactionId,
      checksum: this._generateChecksum(transaction)
    }));
    
    // Create and return the sync package
    return {
      timestamp: new Date().toISOString(),
      accounts: accounts.map(account => account.toObject()),
      transactions: transactions.map(transaction => transaction.toObject()),
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
        
        // Check if transaction exists
        const existingTx = await Transaction.findOne({ 
          transactionId: txChange.transactionId 
        });
        
        if (existingTx) {
          // Transaction exists - check for conflicts
          const serverChecksum = this._generateChecksum(existingTx);
          const baseChecksum = txChange._baseChecksum;
          
          // If client has an older version than the server's current version
          if (baseChecksum && baseChecksum !== serverChecksum) {
            // We have a conflict
            results.conflicts.push({
              id: txChange.transactionId,
              clientVersion: txChange,
              serverVersion: existingTx.toObject()
            });
            continue;
          }
          
          // No conflict - update the transaction
          const updated = await Transaction.findOneAndUpdate(
            { transactionId: txChange.transactionId },
            { $set: { ...txChange, updatedAt: new Date() } },
            { new: true }
          );
          
          results.accepted.push({
            id: updated.transactionId,
            type: 'update'
          });
        } else {
          // Transaction doesn't exist - create it
          const newTx = new Transaction({
            ...txChange,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          await newTx.save();
          
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