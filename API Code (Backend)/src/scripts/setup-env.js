#!/usr/bin/env node
// scripts/setup-env.js

/**
 * Interactive script to set up environment variables
 * Run with: node scripts/setup-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for input with colors
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(colors.blue + question + colors.reset, resolve);
  });
}

// Check if .env file exists in various locations
async function findEnvFile() {
  const locations = [
    '.env',
    path.join('..', '.env'),
    path.join(__dirname, '..', '.env'),
    path.join('src', '.env'),
    path.join('api', '.env'),
    path.join('server', '.env')
  ];
  
  let foundPath = null;
  
  for (const location of locations) {
    if (fs.existsSync(location)) {
      console.log(`${colors.green}Found .env file at: ${location}${colors.reset}`);
      foundPath = location;
      break;
    }
  }
  
  if (!foundPath) {
    console.log(`${colors.yellow}No .env file found in common locations${colors.reset}`);
    const createNew = await prompt('Would you like to create a new .env file? (y/n): ');
    
    if (createNew.toLowerCase() === 'y' || createNew.toLowerCase() === 'yes') {
      const envPath = await prompt('Enter path for new .env file (default: .env): ');
      foundPath = envPath || '.env';
      
      // Create directory if it doesn't exist
      const dir = path.dirname(foundPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create empty file
      fs.writeFileSync(foundPath, '# Environment Variables\n\n');
      console.log(`${colors.green}Created new .env file at: ${foundPath}${colors.reset}`);
    } else {
      console.log(`${colors.red}Setup cancelled${colors.reset}`);
      rl.close();
      return null;
    }
  }
  
  return foundPath;
}

// Read existing .env file
function readEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse content into key-value pairs
    const envVars = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') continue;
      
      // Extract key and value
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        envVars[key.trim()] = value.trim();
      }
    }
    
    return envVars;
  } catch (error) {
    console.log(`${colors.red}Error reading .env file: ${error.message}${colors.reset}`);
    return {};
  }
}

// Write to .env file
function writeEnvFile(filePath, envVars) {
  try {
    let content = '# Environment Variables\n# Updated: ' + new Date().toISOString() + '\n\n';
    
    // Convert key-value pairs to lines
    for (const [key, value] of Object.entries(envVars)) {
      content += `${key}=${value}\n`;
    }
    
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.log(`${colors.red}Error writing .env file: ${error.message}${colors.reset}`);
    return false;
  }
}

// Main setup function
async function setupEnv() {
  console.log(`${colors.blue}=== Environment Setup ====${colors.reset}\n`);
  
  // Find or create .env file
  const envPath = await findEnvFile();
  if (!envPath) return;
  
  // Read existing variables
  const existingVars = readEnvFile(envPath);
  
  console.log(`\n${colors.blue}Setting up required environment variables...${colors.reset}`);
  
  // Configure Cohere API key
  const cohereApiKey = existingVars.COHERE_API_KEY || '';
  console.log(`\n${colors.yellow}Cohere API Key${colors.reset}`);
  console.log('This key is required for generating financial insights using Cohere\'s AI models.');
  
  if (cohereApiKey) {
    console.log(`Current value: ${cohereApiKey.substring(0, 4)}...${cohereApiKey.substring(cohereApiKey.length - 4)}`);
  } else {
    console.log('Current value: Not set');
  }
  
  const updateCohere = await prompt('Would you like to update the Cohere API key? (y/n): ');
  
  let newCohereApiKey = cohereApiKey;
  if (updateCohere.toLowerCase() === 'y' || updateCohere.toLowerCase() === 'yes') {
    newCohereApiKey = await prompt('Enter your Cohere API key: ');
  }
  
  // Update variables
  const updatedVars = {
    ...existingVars,
    COHERE_API_KEY: newCohereApiKey
  };
  
  // Write updated variables
  if (writeEnvFile(envPath, updatedVars)) {
    console.log(`\n${colors.green}Successfully updated environment variables!${colors.reset}`);
    console.log(`Environment file saved at: ${envPath}`);
  } else {
    console.log(`\n${colors.red}Failed to update environment variables${colors.reset}`);
  }
  
  // Test Cohere API key
  if (newCohereApiKey) {
    console.log(`\n${colors.blue}Testing Cohere API key...${colors.reset}`);
    
    try {
      const testScript = `
        const axios = require('axios');
        
        async function testCohereApi() {
          try {
            const response = await axios.get('https://api.cohere.ai/v1/ping', {
              headers: {
                'Authorization': 'Bearer ${newCohereApiKey}',
                'Cohere-Version': '2023-05-24'
              },
              timeout: 5000
            });
            
            console.log('\\x1b[32m✓ Cohere API key is valid!\\x1b[0m');
            console.log('Status: ' + response.status);
            process.exit(0);
          } catch (error) {
            console.log('\\x1b[31m✗ Cohere API key test failed!\\x1b[0m');
            
            if (error.response) {
              console.log('Status: ' + error.response.status);
              console.log('Message: ' + JSON.stringify(error.response.data));
            } else {
              console.log('Error: ' + error.message);
            }
            
            process.exit(1);
          }
        }
        
        testCohereApi();
      `;
      
      // Write test script to temp file
      const tempFile = path.join(os.tmpdir(), 'test-cohere-api.js');
      fs.writeFileSync(tempFile, testScript);
      
      // Execute test script
      exec(`node ${tempFile}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
      });
    } catch (error) {
      console.log(`${colors.red}Error testing Cohere API key: ${error.message}${colors.reset}`);
    }
  }
  
  rl.close();
}

// Run the setup
setupEnv().catch((error) => {
  console.error(`${colors.red}Unhandled error during setup: ${error.message}${colors.reset}`);
  rl.close();
});