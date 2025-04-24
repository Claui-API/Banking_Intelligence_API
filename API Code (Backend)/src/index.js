const dbConnection = require('./utils/db-connection');
const logger = require('./utils/logger');

async function testSchemas() {
  try {
    // Connect to database
    await dbConnection.connect();
    
    // Create test data
    const userProfile = new UserProfile({
      userId: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com'
    });
    
    await userProfile.save();
    logger.info('User profile created successfully');
    
    const account = new Account({
      userId: 'test-user-1',
      accountId: 'test-account-1',
      name: 'Test Checking',
      type: 'Checking',
      balance: 1000,
      currency: 'USD'
    });
    
    await account.save();
    logger.info('Account created successfully');
    
    const transaction = new Transaction({
      userId: 'test-user-1',
      accountId: 'test-account-1',
      transactionId: 'test-transaction-1',
      date: new Date(),
      description: 'Test Transaction',
      amount: -50,
      category: 'Dining',
      type: 'expense'
    });
    
    await transaction.save();
    logger.info('Transaction created successfully');
    
    // Query the data
    const transactions = await Transaction.find({ userId: 'test-user-1' });
    logger.info(`Found ${transactions.length} transactions`);
    
    // Disconnect from database
    await dbConnection.disconnect();
  } catch (error) {
    logger.error('Error testing schemas:', error);
  }
}

testSchemas();