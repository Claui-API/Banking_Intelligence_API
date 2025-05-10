#!/usr/bin/env node
const plaidService = require('../services/plaid.service');
const dataService = require('../services/data.service');
const cohereService = require('../services/cohere.service');
const logger = require('../utils/logger');

async function testPlaidInsightGeneration() {
  try {
    console.log('🔍 Starting Plaid Data Insight Generation Test');
    
    // Simulate a test user ID
    const testUserId = 'test-plaid-user-001';
    
    // Get Plaid financial data
    const userData = await dataService.getUserFinancialData(testUserId);
    
    console.log('✅ Retrieved User Financial Data');
    console.log('Accounts:', userData.accounts.length);
    console.log('Transactions:', userData.transactions.length);
    
    // Generate insights using Plaid data
    const query = 'How can I optimize my spending based on my recent transactions?';
    const insights = await cohereService.generateInsights({
      ...userData,
      query,
      queryType: 'spending'
    });
    
    console.log('✅ Insights Generated Successfully');
    console.log('Insight Preview:', insights.insight.substring(0, 200) + '...');
    
    // Additional validation
    if (!insights.insight) {
      throw new Error('No insight generated');
    }
    
    console.log('🎉 Plaid Insight Generation Test Passed!');
  } catch (error) {
    console.error('❌ Plaid Insight Generation Test Failed:', error);
    process.exit(1);
  }
}

testPlaidInsightGeneration();