// src/models/Token.js
const { DataTypes, Op } = require('sequelize');  // Import Op directly here
const { sequelize } = require('../config/database');

const Token = sequelize.define('Token', {
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
    allowNull: true,
    references: {
      model: 'Clients',
      key: 'clientId'
    }
  },
  tokenType: {
    type: DataTypes.ENUM('access', 'refresh', 'api'),
    allowNull: false
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['token']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['clientId']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Utility method to find valid tokens
Token.findValidToken = async function (token, type) {
  const { Op } = require('sequelize');
  const now = new Date();

  // Build the token type condition to handle both 'access' and 'api' tokens
  let tokenTypeCondition;
  if (type === 'access') {
    // When checking for access tokens, also accept api tokens
    tokenTypeCondition = {
      [Op.or]: [
        { tokenType: 'access' },
        { tokenType: 'api' }
      ]
    };
  } else {
    // For other types (like refresh), use exact match
    tokenTypeCondition = { tokenType: type };
  }

  return await this.findOne({
    where: {
      token,
      ...tokenTypeCondition,
      expiresAt: {
        [Op.gt]: now
      },
      isRevoked: false
    }
  });
};

// Import model relationships after defining all models
const setupAssociations = () => {
  const { User, Client } = require('./User');

  // Set up associations
  User.hasMany(Token, { foreignKey: 'userId' });
  Token.belongsTo(User, { foreignKey: 'userId' });

  if (Client) {
    Client.hasMany(Token, { foreignKey: 'clientId', targetKey: 'clientId' });
    Token.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
  }
};

// Run associations setup when models are loaded
setupAssociations();

module.exports = Token;