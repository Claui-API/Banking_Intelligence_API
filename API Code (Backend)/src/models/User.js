// src/models/User.js - Updated with 2FA fields

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  markedForDeletionAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the user was marked for deletion'
  },
  inactivityWarningDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the inactivity warning was sent'
  },
  deletionReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason for deletion (user-requested, inactivity, etc.)'
  },
  dataRetentionPreferences: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      transactionRetentionDays: 730, // 24 months
      insightRetentionDays: 365, // 12 months
      emailNotifications: true,
      analyticalDataUse: true
    },
    comment: 'User preferences for data retention'
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING,
    allowNull: true
  },
  backupCodes: {
    type: DataTypes.JSON,
    allowNull: true
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  paranoid: true, // Soft deletes (adds deletedAt)
  hooks: {
    beforeCreate: async (user) => {
      // Hash password if it was changed
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    },
    beforeUpdate: async (user) => {
      // Hash password if it was changed
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    }
  }
});

// Instance method to compare passwords
User.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Client model for API credentials
const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  clientId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  clientSecret: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'suspended', 'revoked'),
    defaultValue: 'pending' // Changed default to pending
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  usageQuota: {
    type: DataTypes.INTEGER,
    defaultValue: 1000, // Default monthly quota
    allowNull: false
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  resetDate: {
    type: DataTypes.DATE,
    defaultValue: () => {
      // Set to the first day of next month
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
    },
    allowNull: false
  }
}, {
  timestamps: true,
  paranoid: true
});

// Create associations
User.hasMany(Client, { foreignKey: 'userId' });
Client.belongsTo(User, { foreignKey: 'userId' });

// Create associations for approvals
User.hasMany(Client, { foreignKey: 'approvedBy', as: 'ApprovedClients' });
Client.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });

// Generate client credentials
Client.generateCredentials = function () {
  return {
    clientId: crypto.randomUUID(),
    clientSecret: crypto.randomBytes(32).toString('hex')
  };
};

module.exports = { User, Client };