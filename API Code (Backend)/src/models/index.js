// src/models/index.js - Updated with comprehensive associations
const { sequelize } = require('../config/database');

// Initialize models object
const models = {};

// Try to import and initialize each model safely
const modelFiles = [
	'User',
	'Account',
	'AdminLog',
	'BankUser',
	'ContactSubmission',
	'EmailSuppression',
	'InsightMetrics',
	'NotificationPreference',
	'PlaidItem',
	'RetentionLog',
	'Token',
	'Transaction',
	'UserAnalysis'
];

modelFiles.forEach(modelName => {
	try {
		const modelRequire = require(`./${modelName}`);

		// Handle different export patterns
		if (typeof modelRequire === 'function') {
			// It's a factory function that expects sequelize
			try {
				models[modelName] = modelRequire(sequelize);
			} catch (factoryError) {
				// If factory function fails, it might be an ES6 class
				console.warn(`Factory function failed for ${modelName}, trying as initialized model:`, factoryError.message);
				models[modelName] = modelRequire;
			}
		} else if (modelRequire && typeof modelRequire === 'object') {
			// It's already an initialized model instance
			models[modelName] = modelRequire;
		} else if (modelRequire && modelRequire.default) {
			// Handle ES6 default exports
			if (typeof modelRequire.default === 'function') {
				try {
					models[modelName] = modelRequire.default(sequelize);
				} catch (defaultError) {
					models[modelName] = modelRequire.default;
				}
			} else {
				models[modelName] = modelRequire.default;
			}
		} else {
			console.warn(`Unknown export pattern for ${modelName}, skipping...`);
		}
	} catch (error) {
		console.warn(`Warning: Could not load model ${modelName}:`, error.message);
		// Continue loading other models even if one fails
	}
});

// Set up associations only for successfully loaded models
const setupAssociations = () => {
	const {
		User,
		Token,
		PlaidItem,
		NotificationPreference,
		ContactSubmission,
		EmailSuppression,
		AdminLog,
		BankUser,
		Account,
		Transaction,
		RetentionLog,
		UserAnalysis
	} = models;

	try {
		// Get Client model from User (since it's defined in User.js)
		const Client = User?.Client;

		// User associations
		if (User) {
			// User -> Client
			if (Client) {
				User.hasMany(Client, { foreignKey: 'userId' });
				Client.belongsTo(User, { foreignKey: 'userId' });

				// User -> Client approval associations
				User.hasMany(Client, { foreignKey: 'approvedBy', as: 'ApprovedClients' });
				Client.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });

				User.hasMany(Client, { foreignKey: 'statusChangedBy', as: 'StatusChangedClients' });
				Client.belongsTo(User, { foreignKey: 'statusChangedBy', as: 'StatusChanger' });

				User.hasMany(Client, { foreignKey: 'quotaChangedBy', as: 'QuotaChangedClients' });
				Client.belongsTo(User, { foreignKey: 'quotaChangedBy', as: 'QuotaChanger' });
			}

			// User -> Token
			if (Token && typeof Token.belongsTo === 'function') {
				User.hasMany(Token, { foreignKey: 'userId' });
				Token.belongsTo(User, { foreignKey: 'userId' });
			}

			// User -> PlaidItem
			if (PlaidItem && typeof PlaidItem.belongsTo === 'function') {
				User.hasMany(PlaidItem, { foreignKey: 'userId' });
				PlaidItem.belongsTo(User, { foreignKey: 'userId' });
			}

			// User -> NotificationPreference
			if (NotificationPreference && typeof NotificationPreference.belongsTo === 'function') {
				User.hasOne(NotificationPreference, { foreignKey: 'userId' });
				NotificationPreference.belongsTo(User, { foreignKey: 'userId' });
			}

			// User -> AdminLog
			if (AdminLog && typeof AdminLog.belongsTo === 'function') {
				User.hasMany(AdminLog, { foreignKey: 'adminId' });
				AdminLog.belongsTo(User, { foreignKey: 'adminId' });
			}
		}

		// Client associations
		if (Client) {
			// Client -> Token
			if (Token && typeof Token.belongsTo === 'function') {
				Client.hasMany(Token, { foreignKey: 'clientId', sourceKey: 'clientId' });
				Token.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
			}

			// Client -> BankUser
			if (BankUser && typeof BankUser.belongsTo === 'function') {
				Client.hasMany(BankUser, { foreignKey: 'clientId', sourceKey: 'clientId' });
				BankUser.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
			}

			// Client -> Account
			if (Account && typeof Account.belongsTo === 'function') {
				Client.hasMany(Account, { foreignKey: 'clientId', sourceKey: 'clientId' });
				Account.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
			}

			// Client -> Transaction
			if (Transaction && typeof Transaction.belongsTo === 'function') {
				Client.hasMany(Transaction, { foreignKey: 'clientId', sourceKey: 'clientId' });
				Transaction.belongsTo(Client, { foreignKey: 'clientId', targetKey: 'clientId' });
			}

			// Make Client model available globally
			models.Client = Client;
		}

		// Additional associations can be added here as needed
		// For example, if you want Account -> Transaction relationships:
		if (Account && Transaction) {
			// These would be application-level associations without foreign key constraints
			// Account.hasMany(Transaction, { foreignKey: 'accountId', sourceKey: 'accountId' });
			// Transaction.belongsTo(Account, { foreignKey: 'accountId', targetKey: 'accountId' });
		}

		// UserAnalysis associations
		if (UserAnalysis && User) {
			UserAnalysis.associate(models);
		}

		console.log('Model associations set up successfully');
	} catch (error) {
		console.warn('Warning: Error setting up model associations:', error.message);
	}
};

// Initialize associations
setupAssociations();

// Log successfully loaded models
const loadedModels = Object.keys(models);
console.log(`Successfully loaded models: ${loadedModels.join(', ')}`);
console.log(`Failed to load: ${modelFiles.filter(name => !loadedModels.includes(name)).join(', ') || 'none'}`);

// Export all models and sequelize
module.exports = {
	sequelize,
	...models
};