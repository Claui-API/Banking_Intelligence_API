// src/models/Account.js - Fixed to use factory function pattern
const { DataTypes, Op } = require('sequelize');

// Helper function for balance normalization
function normalizeAndValidateBalance(account) {
  const originalBalance = account.balance;
  const originalAvailable = account.availableBalance;
  let qualityFlags = [];

  // Normalize null/undefined to actual numbers
  if (account.balance === null || account.balance === undefined) {
    if (account.availableBalance !== null && account.availableBalance !== undefined) {
      account.balance = account.availableBalance;
      qualityFlags.push('balance_inferred_from_available');
    } else {
      account.balance = 0;
      qualityFlags.push('balance_defaulted_to_zero');
    }
  }

  if (account.availableBalance === null || account.availableBalance === undefined) {
    if (account.balance !== null && account.balance !== undefined) {
      account.availableBalance = account.balance;
      qualityFlags.push('available_inferred_from_balance');
    } else {
      account.availableBalance = 0;
      qualityFlags.push('available_defaulted_to_zero');
    }
  }

  // Store quality flags if any normalization occurred
  if (qualityFlags.length > 0) {
    account.dataQualityFlags = {
      ...account.dataQualityFlags,
      balanceNormalization: qualityFlags,
      normalizedAt: new Date().toISOString(),
      originalValues: {
        balance: originalBalance,
        availableBalance: originalAvailable
      }
    };
  }

  // Convert to proper decimal types
  account.balance = Number(account.balance);
  account.availableBalance = Number(account.availableBalance);
}

// FIXED: Export as factory function
module.exports = (sequelize) => {
  const Account = sequelize.define('Account', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Clients',
        key: 'clientId'
      }
    },
    bankUserId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    accountId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subtype: {
      type: DataTypes.STRING,
      allowNull: true
    },
    balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,  // Changed from true to false after migration
      defaultValue: 0
    },
    availableBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,  // Changed from true to false after migration
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    dataQualityFlags: {  // NEW FIELD
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Tracks any data quality issues like inferred balances'
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    hooks: {
      // Clean data on the way IN
      beforeCreate: (account) => {
        normalizeAndValidateBalance(account);
      },
      beforeUpdate: (account) => {
        normalizeAndValidateBalance(account);
      },
      beforeBulkCreate: (accounts) => {
        accounts.forEach(normalizeAndValidateBalance);
      }
    },
    indexes: [
      {
        fields: ['clientId']
      },
      {
        fields: ['bankUserId']
      },
      {
        unique: true,
        fields: ['clientId', 'bankUserId', 'accountId']
      }
    ]
  });

  // Note: Don't set up associations here - they should be handled in models/index.js
  // to avoid circular dependency issues

  return Account;
};