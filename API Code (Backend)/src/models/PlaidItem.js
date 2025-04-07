// models/PlaidItem.js
const mongoose = require('mongoose');

/**
 * PlaidItem Schema
 * 
 * Stores information about a user's connected bank accounts via Plaid
 */
const PlaidItemSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  itemId: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  institutionId: {
    type: String,
    required: false
  },
  institutionName: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'error', 'pending', 'disconnected'],
    default: 'active'
  },
  error: {
    type: Object,
    required: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  lastSuccessfulUpdate: {
    type: Date,
    required: false
  },
  consentExpiresAt: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update lastUpdated
PlaidItemSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('PlaidItem', PlaidItemSchema);