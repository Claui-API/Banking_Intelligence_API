// models/DeviceToken.js
const mongoose = require('mongoose');

/**
 * Device Token Schema
 * 
 * Stores mobile device tokens for push notifications
 */
const DeviceTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  deviceInfo: {
    type: Object,
    default: {}
  },
  active: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for quickly finding tokens by user and platform
DeviceTokenSchema.index({ userId: 1, platform: 1 });

// Method to mark a device token as inactive
DeviceTokenSchema.methods.deactivate = async function() {
  this.active = false;
  await this.save();
  return this;
};

module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);