// models/Account.js
const mongoose = require('mongoose');

/**
 * Account Schema
 * 
 * Stores information about user's financial accounts:
 * - Checking accounts
 * - Savings accounts
 * - Credit cards
 * - Investment accounts
 * - Loans
 */
const AccountSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Other'],
    required: true,
    index: true
  },
  subType: {
    type: String,
    required: false
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  availableBalance: {
    type: Number,
    required: false
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  institutionName: {
    type: String,
    required: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Credit card specific fields
  creditLimit: {
    type: Number,
    required: function() {
      return this.type === 'Credit Card';
    },
    default: function() {
      return this.type === 'Credit Card' ? 0 : undefined;
    }
  },
  dueDate: {
    type: Date,
    required: function() {
      return this.type === 'Credit Card' || this.type === 'Loan';
    }
  },
  minimumPayment: {
    type: Number,
    required: function() {
      return this.type === 'Credit Card' || this.type === 'Loan';
    }
  },
  // Loan specific fields
  interestRate: {
    type: Number,
    required: function() {
      return this.type === 'Loan';
    }
  },
  originationDate: {
    type: Date,
    required: function() {
      return this.type === 'Loan';
    }
  },
  maturityDate: {
    type: Date,
    required: function() {
      return this.type === 'Loan';
    }
  }
});

// Virtual for determining if the account has a negative balance
AccountSchema.virtual('isNegativeBalance').get(function() {
  return this.balance < 0;
});

// Virtual for credit utilization (for credit cards)
AccountSchema.virtual('utilizationRate').get(function() {
  if (this.type !== 'Credit Card' || !this.creditLimit || this.creditLimit === 0) {
    return null;
  }
  return Math.abs(Math.min(this.balance, 0)) / this.creditLimit;
});

// Pre-save hook to update lastUpdated
AccountSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Account', AccountSchema);