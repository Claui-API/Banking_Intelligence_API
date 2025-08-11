// src/models/Account.js - Modified version
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
    allowNull: false
  },
  availableBalance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
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
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
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

// Set up associations
const setupAssociations = () => {
  const { Client } = require('./User');

  if (Client) {
    Client.hasMany(Account, { foreignKey: 'clientId', sourceKey: 'clientId' });
    Account.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
  }

  // Note: We're removing the direct foreign key constraint to BankUser model
  // Instead, we'll rely on application-level validation
};

setupAssociations();

module.exports = Account;