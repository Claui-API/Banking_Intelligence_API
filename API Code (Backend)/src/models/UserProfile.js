// models/UserProfile.js
const mongoose = require('mongoose');

/**
 * UserProfile Schema
 * 
 * Stores user profile information, preferences, and financial goals.
 * This helps personalize the banking intelligence features.
 */
const UserProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: false
  },
  occupation: {
    type: String,
    required: false
  },
  incomeRange: {
    type: String,
    enum: ['0-25k', '25k-50k', '50k-75k', '75k-100k', '100k-150k', '150k+', 'not_specified'],
    default: 'not_specified'
  },
  financialGoals: [{
    type: {
      type: String,
      enum: ['save', 'invest', 'debt_reduction', 'major_purchase', 'retirement', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    targetAmount: {
      type: Number,
      required: true
    },
    targetDate: {
      type: Date,
      required: false
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  riskTolerance: {
    type: String,
    enum: ['conservative', 'moderate', 'aggressive', 'not_specified'],
    default: 'not_specified'
  },
  financialLiteracyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'not_specified'],
    default: 'not_specified'
  },
  preferences: {
    categories: {
      type: Map,
      of: {
        budget: Number,
        importance: {
          type: String,
          enum: ['low', 'medium', 'high']
        }
      },
      default: {}
    },
    notificationPreferences: {
      lowBalance: {
        type: Boolean,
        default: true
      },
      unusualActivity: {
        type: Boolean,
        default: true
      },
      billReminders: {
        type: Boolean,
        default: true
      },
      savingsOpportunities: {
        type: Boolean,
        default: true
      },
      financialInsights: {
        type: Boolean,
        default: true
      }
    },
    savingRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    }
  },
  financialProfile: {
    monthlyIncomeEstimate: {
      type: Number,
      required: false
    },
    fixedExpensesEstimate: {
      type: Number,
      required: false
    },
    paydayCycle: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'variable', 'unknown'],
      default: 'unknown'
    },
    hasActiveLoans: {
      type: Boolean,
      default: false
    },
    lastFinancialReview: {
      type: Date,
      default: null
    }
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

// Pre-save hook to update timestamps
UserProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);