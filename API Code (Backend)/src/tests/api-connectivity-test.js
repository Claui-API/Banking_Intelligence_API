#!/usr/bin/env node
const api = require('./services/api');
const logger = require('./utils/logger');
const authService = require('./services/auth');

async function testApiConnectivity() {
  try {
    console.log('🔍 Starting API Connectivity Test');
    
    // Test API base connection
    const apiResponse = await api.get('/health');
    console.log('✅ Base API Connection: Successful');
    
    // Test authentication endpoints
    const testCredentials = {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!'
    };
    
    const loginResult = await authService.login(testCredentials);
    console.log('✅ Authentication: Successful');
    
    // Validate login response
    if (!loginResult.accessToken) {
      throw new Error('No access token received');
    }
    
    console.log('🎉 API Connectivity Test Passed!');
  } catch (error) {
    console.error('❌ API Connectivity Test Failed:', error);
    process.exit(1);
  }
}

testApiConnectivity();