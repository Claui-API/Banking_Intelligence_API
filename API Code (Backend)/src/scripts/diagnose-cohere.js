#!/usr/bin/env node
// scripts/diagnose-cohere.js

/**
 * CLI tool to diagnose Cohere API issues
 * Run with: node scripts/diagnose-cohere.js
 */

const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Set up console for better logging
const console = {
  log: (message) => process.stdout.write(message + '\n'),
  error: (message) => process.stderr.write('\x1b[31m' + message + '\x1b[0m\n'),
  warn: (message) => process.stdout.write('\x1b[33m' + message + '\x1b[0m\n'),
  success: (message) => process.stdout.write('\x1b[32m' + message + '\x1b[0m\n'),
  info: (message) => process.stdout.write('\x1b[36m' + message + '\x1b[0m\n'),
};

async function runDiagnostics() {
  console.log('\n=== Cohere API Diagnostics ===\n');
  
  // Check environment variables
  console.log('Checking environment variables...');
  const apiKey = process.env.COHERE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ COHERE_API_KEY environment variable is not set!');
    console.warn('Please set the COHERE_API_KEY in your .env file.');
    return;
  }
  
  console.success('✓ COHERE_API_KEY environment variable is set.');
  console.log(`API key length: ${apiKey.length} characters`);
  
  // Check for common API key format issues
  if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\r')) {
    console.error('❌ API key contains whitespace characters!');
    console.warn('Please check for extra spaces, newlines, or carriage returns in your API key.');
  }
  
  // Check network connectivity
  console.log('\nChecking network connectivity...');
  try {
    console.log('Testing connection to Google...');
    await axios.get('https://www.google.com', { timeout: 5000 });
    console.success('✓ Connection to Google successful');
  } catch (error) {
    console.error('❌ Failed to connect to Google!');
    console.error(`Error: ${error.message}`);
    console.warn('You may have network connectivity issues.');
    return;
  }
  
  // Test Cohere API
  console.log('\nTesting connection to Cohere API...');
  try {
    console.log('Sending a simple test request to Cohere...');
    
    const response = await axios.post('https://api.cohere.ai/v1/chat', 
      {
        model: 'command-r-08-2024',
        message: 'Hello, this is a test message from the diagnostic tool.',
        max_tokens: 20
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Cohere-Version': '2023-05-24'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    console.success('✓ Successfully connected to Cohere API!');
    console.info(`Status code: ${response.status}`);
    
    // Check rate limits
    const rateLimit = response.headers['x-ratelimit-limit'];
    const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
    const rateLimitReset = response.headers['x-ratelimit-reset'];
    
    if (rateLimit && rateLimitRemaining) {
      console.info(`Rate limit: ${rateLimitRemaining}/${rateLimit} requests remaining`);
      
      if (parseInt(rateLimitRemaining) < 10) {
        console.warn(`⚠️ Warning: You're running low on API quota!`);
      }
    }
    
    // Log the response 
    console.log('\nResponse from Cohere:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to connect to Cohere API!');
    
    if (error.response) {
      // The request was made and the server responded with a non-2xx status
      console.error(`Status code: ${error.response.status}`);
      console.error('Response data:');
      console.error(JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.error('Authentication error: Your API key appears to be invalid!');
        console.warn('Please check that your API key is correct and active.');
      } else if (error.response.status === 429) {
        console.error('Rate limit exceeded: You have hit your API usage limit!');
        console.warn('Please wait before making more requests or check your plan limits.');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Cohere API.');
      console.warn('Possible network issue or firewall blocking the connection.');
    } else {
      // Something happened in setting up the request
      console.error(`Error setting up request: ${error.message}`);
    }
    
    return;
  }
  
  // Test with real prompt
  console.log('\nTesting a full prompt...');
  try {
    const testPrompt = `
      As a personal financial advisor, analyze the following user financial data and provide clear, actionable advice.
      
      User Profile: Test User, Age: 35
      Total Balance Across All Accounts: $20000.00
      Monthly Income: $5000.00
      Monthly Expenses: $3500.00
      Top Expense Categories: Housing, Food, Transportation
      
      How can I improve my savings?
    `;
    
    console.log('Sending a financial advice prompt to Cohere...');
    
    const response = await axios.post('https://api.cohere.ai/v1/chat', 
      {
        model: 'command-r-08-2024',
        message: testPrompt,
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Cohere-Version': '2023-05-24'
        },
        timeout: 15000 // 15 second timeout
      }
    );
    
    console.success('✓ Successfully generated financial advice!');
    
    // Sample of the response
    const responseText = response.data.text || 
                        (response.data.generations && response.data.generations[0] ? 
                          response.data.generations[0].text : 
                          JSON.stringify(response.data));
    
    console.log('\nSample response:');
    console.log(responseText.substring(0, 200) + '...');
    
    // Write diagnostic results to file
    const diagResults = {
      timestamp: new Date().toISOString(),
      apiKeyStatus: 'valid',
      connectivity: 'successful',
      testResponse: responseText.substring(0, 200),
      success: true
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'cohere-diagnostic-results.json'), 
      JSON.stringify(diagResults, null, 2)
    );
    
    console.info('\nDiagnostic results saved to cohere-diagnostic-results.json');
  } catch (error) {
    console.error('❌ Failed to test full prompt!');
    
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Response data:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    // Write diagnostic results to file
    const diagResults = {
      timestamp: new Date().toISOString(),
      apiKeyStatus: 'error',
      connectivity: 'failed',
      error: error.message,
      responseData: error.response ? error.response.data : null,
      success: false
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'cohere-diagnostic-results.json'), 
      JSON.stringify(diagResults, null, 2)
    );
    
    console.info('\nDiagnostic results saved to cohere-diagnostic-results.json');
    return;
  }
  
  console.success('\n✓ All diagnostics completed successfully!');
  console.log('\nYour Cohere API integration appears to be working correctly.');
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('Unhandled error during diagnostics:');
  console.error(error);
});