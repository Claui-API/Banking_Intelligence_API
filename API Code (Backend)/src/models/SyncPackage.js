// models/SyncPackage.js
const mongoose = require('mongoose');

/**
 * SyncPackage Schema
 * 
 * Tracks mobile app sync history for offline mode support
 */
const SyncPackageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  syncType: {
    type: String,
    enum: ['full', 'delta'],
    required: true
  },
  packageSize: {
    type: Number,
    required: true
  },
  deviceInfo: {
    type: String,
    required: false
  },
  // Tracking for when a client submits changes
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  results: {
    accepted: {
      type: Number,
      default: 0
    },
    rejected: {
      type: Number,
      default: 0
    },
    conflicts: {
      type: Number,
      default: 0
    }
  }
});

// Index for finding recent syncs
SyncPackageSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('SyncPackage', SyncPackageSchema);