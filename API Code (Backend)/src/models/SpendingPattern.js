// models/SpendingPattern.js
const mongoose = require('mongoose');

/**
 * SpendingPattern Schema
 * 
 * Detects and stores recurring spending patterns for users:
 * - Fixed recurring expenses (subscriptions, bills)
 * - Variable recurring expenses (groceries, dining)
 * - Income patterns (salary, freelance work)
 */
const SpendingPatternSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  patternName: {
    type: String,
    required: true
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  category: {
    type: String,
    required: true
  },
  averageAmount: {
    type: Number,
    required: true
  },
  minimumAmount: {
    type: Number,
    required: false
  },
  maximumAmount: {
    type: Number,
    required: false
  },
  standardDeviation: {
    type: Number,
    required: false
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'],
    required: true
  },
  averageInterval: {
    type: Number, // In days
    required: false
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
    required: false
  },
  dayOfWeek: {
    type: Number,
    min: 0, // Sunday
    max: 6, // Saturday
    required: false
  },
  lastOccurrence: {
    type: Date
  },
  nextExpected: {
    type: Date
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  },
  patternType: {
    type: String,
    enum: ['income', 'fixed_expense', 'variable_expense'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  monthlyImpact: {
    type: Number, // Estimated monthly impact on budget
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

// Method to predict next occurrence
SpendingPatternSchema.methods.predictNextOccurrence = function() {
  if (!this.lastOccurrence) return null;
  
  const lastDate = new Date(this.lastOccurrence);
  const nextDate = new Date(lastDate);
  
  switch(this.frequency) {
    case 'daily':
      nextDate.setDate(lastDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(lastDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(lastDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(lastDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(lastDate.getMonth() + 3);
      break;
    case 'annual':
      nextDate.setFullYear(lastDate.getFullYear() + 1);
      break;
    default:
      return null;
  }
  
  this.nextExpected = nextDate;
  return nextDate;
};

// Method to calculate confidence based on pattern consistency
SpendingPatternSchema.methods.calculateConfidence = function() {
  // If we have a standard deviation and average amount
  if (this.standardDeviation !== undefined && this.averageAmount !== undefined && this.averageAmount !== 0) {
    // Calculate coefficient of variation (CV) - lower is better
    const cv = this.standardDeviation / Math.abs(this.averageAmount);
    
    // Convert CV to confidence score (1 - normalized CV)
    // Limit CV to a reasonable range (0.5 is fairly high variation)
    const normalizedCV = Math.min(cv, 0.5) / 0.5;
    const variationConfidence = 1 - normalizedCV;
    
    // Consider the number of samples (more samples = higher confidence)
    const sampleConfidence = Math.min(this.transactions.length / 5, 1);
    
    // Weight the scores (giving more weight to variation consistency)
    this.confidence = (variationConfidence * 0.7) + (sampleConfidence * 0.3);
  } else {
    // Fallback based just on number of samples
    this.confidence = Math.min(this.transactions.length / 10, 0.9);
  }
  
  return this.confidence;
};

// Pre-save hook to update timestamps and predictions
SpendingPatternSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.lastOccurrence && !this.nextExpected) {
    this.predictNextOccurrence();
  }
  
  // Calculate monthly impact
  if (this.averageAmount) {
    let monthlyMultiplier = 0;
    switch(this.frequency) {
      case 'daily': monthlyMultiplier = 30; break;
      case 'weekly': monthlyMultiplier = 4.33; break;
      case 'biweekly': monthlyMultiplier = 2.17; break;
      case 'monthly': monthlyMultiplier = 1; break;
      case 'quarterly': monthlyMultiplier = 1/3; break;
      case 'annual': monthlyMultiplier = 1/12; break;
    }
    this.monthlyImpact = this.averageAmount * monthlyMultiplier;
  }
  
  next();
});

// Compound index for finding patterns by user and category
SpendingPatternSchema.index({ userId: 1, category: 1 });

// Compound index for finding patterns by user and frequency
SpendingPatternSchema.index({ userId: 1, frequency: 1 });

// Compound index for patterns by next expected date (for alerts)
SpendingPatternSchema.index({ userId: 1, nextExpected: 1 });

module.exports = mongoose.model('SpendingPattern', SpendingPatternSchema);