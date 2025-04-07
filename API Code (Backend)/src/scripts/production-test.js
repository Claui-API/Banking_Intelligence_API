// scripts/production-test.js
const axios = require('axios');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

// Configuration
const API_URL = process.env.API_URL || 'https://your-api.com';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN; // JWT token for a test user

async function runProductionTest() {
  try {
    logger.info('Starting production API test...');
    
    // Check health endpoint
    const healthResponse = await axios.get(`${API_URL}/api/health`);
    logger.info('Health check:', healthResponse.data);
    
    // Test authentication
    const authConfig = { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } };
    
    // Test getting financial summary
    logger.info('Testing financial summary endpoint...');
    const summaryResponse = await axios.get(
      `${API_URL}/api/insights/summary`, 
      authConfig
    );
    
    if (summaryResponse.data.success) {
      logger.info('✅ Financial summary test passed');
      // Validate data structure
      const { totalBalance, netWorth, accountCount, recentTransactions } = summaryResponse.data.data;
      logger.info(`Total balance: ${totalBalance}`);
      logger.info(`Net worth: ${netWorth}`);
      logger.info(`Account count: ${accountCount}`);
      logger.info(`Recent transactions: ${recentTransactions.length}`);
    } else {
      logger.error('❌ Financial summary test failed:', summaryResponse.data);
    }
    
    // Test generating insights
    logger.info('Testing insights generation endpoint...');
    const insightsResponse = await axios.post(
      `${API_URL}/api/insights/generate`,
      { query: 'How is my spending this month compared to last month?' },
      authConfig
    );
    
    if (insightsResponse.data.success) {
      logger.info('✅ Insights generation test passed');
      // Check insights content
      logger.info(`Insights response: ${JSON.stringify(insightsResponse.data.data.insights).substring(0, 200)}...`);
    } else {
      logger.error('❌ Insights generation test failed:', insightsResponse.data);
    }
    
    logger.info('✅ All tests completed successfully');
  } catch (error) {
    logger.error('❌ Production test failed:', error.response?.data || error.message);
  }
}

runProductionTest();