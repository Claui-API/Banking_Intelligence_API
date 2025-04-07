// models/Transaction.js
const mongoose = require('mongoose');

/**
 * Transaction Schema
 * 
 * Stores all financial transactions for users, including:
 * - Deposits
 * - Withdrawals
 * - Transfers
 * - Payments
 * - Subscriptions
 */
const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: false,
    index: true
  },
  subCategory: {
    type: String,
    required: false
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    required: true,
    index: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual', null],
    default: null
  },
  merchantName: {
    type: String,
    required: false
  },
  location: {
    type: String,
    required: false
  },
  notes: {
    type: String,
    required: false
  },
  tags: [{
    type: String
  }],
  patternId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpendingPattern',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for determining if the transaction is a debit or credit
TransactionSchema.virtual('isDebit').get(function() {
  return this.amount < 0;
});

// Virtual for month-year string (useful for aggregation)
TransactionSchema.virtual('monthYear').get(function() {
  const date = new Date(this.date);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

// Pre-save hook to update timestamps
TransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compound index for querying transactions by user and date range
TransactionSchema.index({ userId: 1, date: -1 });

// Compound index for querying transactions by user and category
TransactionSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);