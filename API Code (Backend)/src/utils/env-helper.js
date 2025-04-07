// utils/env-helper.js
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./logger');

/**
 * Utility to help with environment variable management
 */
class EnvHelper {
  /**
   * Load environment variables from .env file
   * Tries multiple common locations for the file
   */
  static loadEnv() {
    const locations = [
      '.env',
      path.join('..', '.env'),
      path.join(__dirname, '..', '.env'),
      path.join(__dirname, '..', '..', '.env'),
      path.join('src', '.env'),
      path.join('api', '.env'),
      path.join('server', '.env')
    ];
    
    let loaded = false;
    
    for (const location of locations) {
      if (fs.existsSync(location)) {
        logger.info(`Loading environment variables from ${location}`);
        dotenv.config({ path: location });
        loaded = true;
        break;
      }
    }
    
    if (!loaded) {
      logger.warn('No .env file found in common locations');
    }
    
    return loaded;
  }
  
  /**
   * Verify that required environment variables are set
   * @param {Array} requiredVars - List of required variable names
   * @returns {Object} - Results with missing variables
   */
  static verifyRequiredVars(requiredVars) {
    const missing = [];
    const present = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
        logger.warn(`Required environment variable ${varName} is not set`);
      } else {
        present.push(varName);
        logger.info(`Found required environment variable ${varName}`);
      }
    }
    
    return {
      success: missing.length === 0,
      missing,
      present
    };
  }
  
  /**
   * Create or update a .env file
   * @param {Object} variables - Key-value pairs to set in the .env file
   * @param {string} filePath - Path to the .env file (defaults to .env in current directory)
   */
  static updateEnvFile(variables, filePath = '.env') {
    try {
      // Read existing .env file if it exists
      let envContent = '';
      if (fs.existsSync(filePath)) {
        envContent = fs.readFileSync(filePath, 'utf8');
      }
      
      // Update or add each variable
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(envContent)) {
          // Update existing variable
          envContent = envContent.replace(regex, newLine);
        } else {
          // Add new variable
          envContent += (envContent.endsWith('\n') ? '' : '\n') + newLine + '\n';
        }
      }
      
      // Write the updated content back to the file
      fs.writeFileSync(filePath, envContent);
      logger.info(`Updated environment variables in ${filePath}`);
      
      return { success: true, filePath };
    } catch (error) {
      logger.error(`Error updating ${filePath}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a copy of the .env file for debugging
   */
  static createEnvDebugFile() {
    try {
      // Get all environment variables
      const envVars = Object.entries(process.env).reduce((acc, [key, value]) => {
        // Skip sensitive variables or system variables
        if (key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD') || key.includes('TOKEN')) {
          acc[key] = '[REDACTED]';
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      // Create a debug file with environment info
      const debugContent = JSON.stringify({
        environmentVariables: envVars,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }, null, 2);
      
      const debugFilePath = path.join(process.cwd(), 'env-debug.json');
      fs.writeFileSync(debugFilePath, debugContent);
      
      logger.info(`Created environment debug file at ${debugFilePath}`);
      return { success: true, filePath: debugFilePath };
    } catch (error) {
      logger.error('Error creating environment debug file:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = EnvHelper;