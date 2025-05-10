#!/usr/bin/env node
const dataService = require('./services/data.service');
const cohereService = require('./services/cohere.service');
const logger = require('./utils/logger');

async function testMockInsightGeneration() {
  try {
    console.log('🔍 Starting Mock Data Insight Generation Test');
    
    // Use mock user data generation
    const userData = dataService.getMockUserData('test-mock-user');
    
    console.log('✅ Retrieved Mock User Financial Data');
    console.log('Accounts:', userData.accounts.length);
    console.log('Transactions:', userData.transactions.length);
    
    // Test different query types
    const queries = [
      { text: 'How can I save money?', type: 'saving' },
      { text: 'What are my spending habits?', type: 'spending' },
      { text: 'Can you help me budget?', type: 'budgeting' }
    ];
    
    for (const queryObj of queries) {
      const insights = await cohereService.generateInsights({
        ...userData,
        query: queryObj.text,
        queryType: queryObj.type
      });
      
      console.log(`✅ ${queryObj.type.toUpperCase()} Insights Generated`);
      console.log('Insight Preview:', insights.insight.substring(0, 200) + '...');
      
      if (!insights.insight) {
        throw new Error(`No insight generated for ${queryObj.type} query`);
      }
    }
    
    console.log('🎉 Mock Insight Generation Test Passed!');
  } catch (error) {
    console.error('❌ Mock Insight Generation Test Failed:', error);
    process.exit(1);
  }
}

testMockInsightGeneration();