// src/migrations/create-bank-user-tables.js - Updated version
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function createBankUserTables() {
	try {
		logger.info('Creating bank user tables...');

		// First, ensure the UUID extension is available
		await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
		logger.info('UUID extension enabled');

		// Create BankUsers table
		await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "BankUsers" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "clientId" VARCHAR(255) NOT NULL REFERENCES "Clients"("clientId") ON DELETE CASCADE,
        "bankUserId" VARCHAR(255) NOT NULL,
        "name" VARCHAR(255),
        "email" VARCHAR(255),
        "status" VARCHAR(50) DEFAULT 'active',
        "metadata" JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE("clientId", "bankUserId")
      );
    `);

		logger.info('BankUsers table created');

		// Create Accounts table
		await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Accounts" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "clientId" VARCHAR(255) NOT NULL REFERENCES "Clients"("clientId") ON DELETE CASCADE,
        "bankUserId" VARCHAR(255) NOT NULL,
        "accountId" VARCHAR(255) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "subtype" VARCHAR(50),
        "balance" DECIMAL(12, 2) NOT NULL,
        "availableBalance" DECIMAL(12, 2),
        "currency" VARCHAR(3) DEFAULT 'USD',
        "creditLimit" DECIMAL(12, 2),
        "isActive" BOOLEAN DEFAULT TRUE,
        "metadata" JSONB,
        "lastUpdated" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE("clientId", "bankUserId", "accountId"),
        FOREIGN KEY ("clientId", "bankUserId") REFERENCES "BankUsers"("clientId", "bankUserId") ON DELETE CASCADE
      );
    `);

		logger.info('Accounts table created');

		// Create Transactions table
		await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Transactions" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "clientId" VARCHAR(255) NOT NULL REFERENCES "Clients"("clientId") ON DELETE CASCADE,
        "bankUserId" VARCHAR(255) NOT NULL,
        "accountId" VARCHAR(255) NOT NULL,
        "transactionId" VARCHAR(255) NOT NULL,
        "date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "description" TEXT NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "category" VARCHAR(100),
        "type" VARCHAR(50),
        "pending" BOOLEAN DEFAULT FALSE,
        "merchantName" VARCHAR(255),
        "metadata" JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE("clientId", "bankUserId", "transactionId"),
        FOREIGN KEY ("clientId", "bankUserId") REFERENCES "BankUsers"("clientId", "bankUserId") ON DELETE CASCADE
      );
    `);

		logger.info('Transactions table created');

		// Create indexes for better performance
		await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "bankusers_clientId_idx" ON "BankUsers"("clientId");
      CREATE INDEX IF NOT EXISTS "bankusers_bankUserId_idx" ON "BankUsers"("bankUserId");
      CREATE INDEX IF NOT EXISTS "accounts_clientId_idx" ON "Accounts"("clientId");
      CREATE INDEX IF NOT EXISTS "accounts_bankUserId_idx" ON "Accounts"("bankUserId");
      CREATE INDEX IF NOT EXISTS "transactions_clientId_idx" ON "Transactions"("clientId");
      CREATE INDEX IF NOT EXISTS "transactions_bankUserId_idx" ON "Transactions"("bankUserId");
      CREATE INDEX IF NOT EXISTS "transactions_accountId_idx" ON "Transactions"("accountId");
      CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "Transactions"("date");
    `);

		logger.info('Indexes created');

		logger.info('Bank user tables created successfully.');
		return true;
	} catch (error) {
		logger.error('Error creating bank user tables:', error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	createBankUserTables()
		.then(() => {
			logger.info('Bank user tables creation completed');
			process.exit(0);
		})
		.catch(error => {
			logger.error('Bank user tables creation failed:', error);
			process.exit(1);
		});
}

module.exports = createBankUserTables;