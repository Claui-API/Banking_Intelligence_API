// scripts/import-test-data.js
const mongoose = require('mongoose');
const dbConnection = require('../utils/db-connection');
const UserProfile = require('../models/UserProfile');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const SpendingPattern = require('../models/SpendingPattern');
const logger = require('../utils/logger');

const testUserId = 'test-user-1';

async function importTestData() {
  try {
    await dbConnection.connect();
    logger.info('Connected to database');
    
    // Clear existing test data
    await UserProfile.deleteMany({ userId: testUserId });
    await Account.deleteMany({ userId: testUserId });
    await Transaction.deleteMany({ userId: testUserId });
    await SpendingPattern.deleteMany({ userId: testUserId });
    
    // Create user profile
    const userProfile = new UserProfile({
      userId: testUserId,
      name: 'Test User',
      email: 'test@example.com',
      age: 35,
      riskTolerance: 'moderate'
    });
    await userProfile.save();
    
    // Create accounts
    const checkingAccount = new Account({
      userId: testUserId,
      accountId: 'acc-checking-1',
      name: 'Primary Checking',
      type: 'Checking',
      balance: 5000,
      currency: 'USD'
    });
    await checkingAccount.save();
    
    const savingsAccount = new Account({
      userId: testUserId,
      accountId: 'acc-savings-1',
      name: 'Savings Account',
      type: 'Savings',
      balance: 15000,
      currency: 'USD'
    });
    await savingsAccount.save();
    
    // Create transactions (20 sample transactions)
    const transactions = [];
    const categories = ['Groceries', 'Dining', 'Transportation', 'Entertainment', 'Utilities', 'Income'];
    
    const today = new Date();
    for (let i = 0; i < 20; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - Math.floor(Math.random() * 90)); // Random date in last 90 days
      
      const category = categories[Math.floor(Math.random() * categories.length)];
      const isIncome = category === 'Income';
      const amount = isIncome ? 
        Math.floor(Math.random() * 2000) + 1000 : 
        -1 * (Math.floor(Math.random() * 200) + 10);
      
      transactions.push(new Transaction({
        userId: testUserId,
        accountId: isIncome ? 'acc-checking-1' : ['acc-checking-1', 'acc-savings-1'][Math.floor(Math.random() * 2)],
        transactionId: `txn-${i + 1}`,
        date,
        description: `Sample ${category} ${i + 1}`,
        amount,
        category,
        type: isIncome ? 'income' : 'expense'
      }));
    }
    
    await Transaction.insertMany(transactions);
    
    logger.info('Test data imported successfully');
    await dbConnection.disconnect();
  } catch (error) {
    logger.error('Error importing test data:', error);
  }
}

importTestData();