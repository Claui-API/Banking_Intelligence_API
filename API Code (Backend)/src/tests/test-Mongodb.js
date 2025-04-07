// test-atlas-connection.js
const dbConnection = require('../utils/db-connection');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const UserProfile = require('../models/UserProfile');
const SpendingPattern = require('../models/SpendingPattern');
const logger = require('../utils/logger');

/**
 * Tests database connection and schema functionality with MongoDB Atlas
 */
process.env.DB_TYPE = 'atlas';

async function testAtlasConnection() {
  try {
    logger.info('Starting Atlas connection test...');
    
    // Connect to database
    await dbConnection.connect();
    logger.info('Connection to database successful');
    
    // Get connection status
    const status = dbConnection.getStatus();
    logger.info('Database connection status:', status);
    
    // Create test user profile
    logger.info('Creating test user profile...');
    const userProfileData = {
      userId: 'test-user-001',
      name: 'Test User',
      email: 'test@example.com',
      age: 35,
      occupation: 'Software Developer',
      riskTolerance: 'moderate',
      financialGoals: [{
        type: 'save',
        name: 'Emergency Fund',
        targetAmount: 10000,
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
        priority: 'high'
      }]
    };
    
    // Check if user already exists
    let userProfile = await UserProfile.findOne({ userId: userProfileData.userId });
    
    if (!userProfile) {
      // Create new user
      userProfile = new UserProfile(userProfileData);
      await userProfile.save();
      logger.info('Created new user profile');
    } else {
      logger.info('Found existing user profile');
    }
    
    // Create test accounts
    logger.info('Creating test accounts...');
    const accountsData = [
      {
        userId: userProfile.userId,
        accountId: 'test-checking-001',
        name: 'Primary Checking',
        type: 'Checking',
        balance: 2500.75,
        currency: 'USD'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-savings-001',
        name: 'Savings Account',
        type: 'Savings',
        balance: 15000.50,
        currency: 'USD'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-credit-001',
        name: 'Credit Card',
        type: 'Credit Card',
        balance: -1250.65,
        currency: 'USD',
        creditLimit: 5000,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        minimumPayment: 35
      }
    ];
    
    for (const accountData of accountsData) {
      let account = await Account.findOne({ accountId: accountData.accountId });
      
      if (!account) {
        account = new Account(accountData);
        await account.save();
        logger.info(`Created new account: ${accountData.name}`);
      } else {
        logger.info(`Found existing account: ${account.name}`);
      }
    }
    
    // Create test transactions
    logger.info('Creating test transactions...');
    const transactionsData = [
      {
        userId: userProfile.userId,
        accountId: 'test-checking-001',
        transactionId: `test-tx-${Date.now()}-1`,
        date: new Date(),
        description: 'Grocery Store',
        amount: -120.35,
        category: 'Food',
        type: 'expense'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-checking-001',
        transactionId: `test-tx-${Date.now()}-2`,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        description: 'Monthly Salary',
        amount: 4000.00,
        category: 'Income',
        type: 'income'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-credit-001',
        transactionId: `test-tx-${Date.now()}-3`,
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        description: 'Amazon.com',
        amount: -67.99,
        category: 'Shopping',
        type: 'expense'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-checking-001',
        transactionId: `test-tx-${Date.now()}-4`,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: 'Transfer to Savings',
        amount: -500.00,
        category: 'Transfer',
        type: 'expense'
      },
      {
        userId: userProfile.userId,
        accountId: 'test-savings-001',
        transactionId: `test-tx-${Date.now()}-5`,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: 'Transfer from Checking',
        amount: 500.00,
        category: 'Transfer',
        type: 'income'
      }
    ];
    
    for (const txData of transactionsData) {
      // Check if transaction with similar description and date already exists
      const existingTx = await Transaction.findOne({
        userId: txData.userId,
        description: txData.description,
        date: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Within the last hour
      });
      
      if (!existingTx) {
        const transaction = new Transaction(txData);
        await transaction.save();
        logger.info(`Created new transaction: ${txData.description}`);
      } else {
        logger.info(`Similar transaction already exists: ${existingTx.description}`);
      }
    }
    
    // Create a test spending pattern
    logger.info('Creating test spending pattern...');
    const transactions = await Transaction.find({
      userId: userProfile.userId,
      category: 'Food'
    });
    
    if (transactions.length > 0) {
      const patternData = {
        userId: userProfile.userId,
        patternName: 'Grocery Shopping',
        transactions: transactions.map(t => t._id),
        category: 'Food',
        averageAmount: 120,
        frequency: 'weekly',
        lastOccurrence: new Date(),
        confidence: 0.85,
        patternType: 'variable_expense'
      };
      
      let pattern = await SpendingPattern.findOne({
        userId: userProfile.userId,
        patternName: patternData.patternName
      });
      
      if (!pattern) {
        pattern = new SpendingPattern(patternData);
        await pattern.save();
        logger.info('Created new spending pattern');
      } else {
        logger.info('Found existing spending pattern');
      }
    }
    
    // Query and display data
    logger.info('\nRunning test queries...');
    
    // Get all accounts for user
    const accounts = await Account.find({ userId: userProfile.userId });
    logger.info(`Found ${accounts.length} accounts for user`);
    
    // Calculate total balance across all accounts
    const totalBalance = accounts.reduce((sum, account) => {
      // For credit cards, only add negative balances if any
      if (account.type === 'Credit Card') {
        return sum + (account.balance < 0 ? account.balance : 0);
      }
      return sum + account.balance;
    }, 0);
    
    logger.info(`Total balance across all accounts: $${totalBalance.toFixed(2)}`);
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ userId: userProfile.userId })
      .sort({ date: -1 })
      .limit(5);
    
    logger.info(`Recent transactions: ${recentTransactions.length}`);
    recentTransactions.forEach(tx => {
      logger.info(`- ${tx.date.toLocaleDateString()}: ${tx.description} ($${tx.amount.toFixed(2)})`);
    });
    
    // Get spending patterns
    const patterns = await SpendingPattern.find({ userId: userProfile.userId });
    logger.info(`Found ${patterns.length} spending patterns`);
    
    // Disconnect from database
    await dbConnection.disconnect();
    logger.info('Test completed successfully');
    
  } catch (error) {
    logger.error('Error during connection test:', error);
    
    // Ensure we disconnect even if there's an error
    try {
      await dbConnection.disconnect();
    } catch (disconnectError) {
      logger.error('Error during disconnect:', disconnectError);
    }
  }
}

// Run the test
testAtlasConnection();