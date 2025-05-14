// scripts/implement-2fa.js
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Two-Factor Authentication Implementation Script
 * This script adds 2FA support to your Banking Intelligence API application
 */

// Configuration
const CONFIG = {
  codebaseDir: path.join(__dirname, '..'),
  targetFiles: {
    userModel: path.join(__dirname, '..', 'src', 'models', 'User.js'),
    authService: path.join(__dirname, '..', '..', 'API UI (Frontend)', 'src', 'services', 'auth.js'),
    authController: path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'),
    authRoutes: path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'),
    authMiddleware: path.join(__dirname, '..', 'src', 'middleware', 'auth.js')
  },
  backupFiles: true,
  dryRun: false // Set to true for testing without making changes
};

// Ensure backup directory exists
const backupDir = path.join(CONFIG.codebaseDir, 'backups', `2fa-impl-${Date.now()}`);
if (CONFIG.backupFiles && !CONFIG.dryRun) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Backup a file before modifying it
 */
function backupFile(filePath) {
  if (!CONFIG.backupFiles || CONFIG.dryRun) return;

  try {
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, fileName);

    fs.copyFileSync(filePath, backupPath);
    logger.info(`Backed up ${fileName} to ${backupPath}`);
  } catch (error) {
    logger.error(`Error backing up file ${filePath}:`, error);
  }
}

/**
 * Update User model to add 2FA fields
 */
function updateUserModel() {
  const filePath = CONFIG.targetFiles.userModel;

  if (!fs.existsSync(filePath)) {
    logger.error(`User model file not found: ${filePath}`);
    return false;
  }

  logger.info(`Updating User model: ${filePath}`);

  try {
    // Backup file
    backupFile(filePath);

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if 2FA fields already exist
    if (content.includes('twoFactorEnabled') || content.includes('twoFactorSecret')) {
      logger.info('2FA fields already exist in User model');
      return true;
    }

    // Find the User model definition
    const userModelMatch = content.match(/sequelize\.define\s*\(\s*['"]User['"],\s*{([^}]*)}/);

    if (!userModelMatch) {
      logger.error('Could not find User model definition in the file');
      return false;
    }

    // Add 2FA fields to the model
    const userModelDefinition = userModelMatch[0];
    const updatedUserModel = userModelDefinition.replace(
      /(\s*}\s*)$/,
      `,
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING,
    allowNull: true
  },
  backupCodes: {
    type: DataTypes.JSON,
    allowNull: true
  }$1`
    );

    // Replace the model definition in the content
    content = content.replace(userModelDefinition, updatedUserModel);

    // Write the updated content
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, content);
      logger.info('Updated User model with 2FA fields');
    } else {
      logger.info('Dry run: Would update User model with 2FA fields');
    }

    return true;
  } catch (error) {
    logger.error(`Error updating User model:`, error);
    return false;
  }
}

/**
 * Create 2FA service file
 */
function create2FAService() {
  const serviceDir = path.join(CONFIG.codebaseDir, 'src', 'services');
  const filePath = path.join(serviceDir, 'twoFactor.service.js');

  if (!fs.existsSync(serviceDir)) {
    logger.error(`Services directory not found: ${serviceDir}`);
    return false;
  }

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    logger.info(`2FA service file already exists: ${filePath}`);
    return true;
  }

  logger.info(`Creating 2FA service: ${filePath}`);

  try {
    // Create 2FA service content
    const serviceContent = `// src/services/twoFactor.service.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { User } = require('../models/User');

class TwoFactorService {
  /**
   * Generate a new secret key for 2FA
   * @param {Object} user - User object with email
   * @returns {Object} - Generated secret and QR code URL
   */
  async generateSecret(user) {
    try {
      // Generate a secret using speakeasy
      const secret = speakeasy.generateSecret({
        length: 20,
        name: \`Banking Intelligence API (\${user.email})\`
      });
      
      // Generate QR code URL for the secret
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
      
      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeUrl
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }
  
  /**
   * Verify a 2FA token
   * @param {string} token - Token to verify
   * @param {string} secret - User's secret key
   * @returns {boolean} - Whether the token is valid
   */
  verifyToken(token, secret) {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 1 period before and after current time for clock drift
      });
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }
  
  /**
   * Generate backup codes for 2FA
   * @returns {Array<string>} - Array of backup codes
   */
  generateBackupCodes() {
    try {
      const backupCodes = [];
      
      // Generate 10 backup codes
      for (let i = 0; i < 10; i++) {
        // Generate a random 8-character code
        const code = crypto.randomBytes(4).toString('hex');
        backupCodes.push(code);
      }
      
      return backupCodes;
    } catch (error) {
      logger.error('Error generating backup codes:', error);
      throw new Error('Failed to generate backup codes');
    }
  }
  
  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} secret - 2FA secret
   * @returns {boolean} - Success status
   */
  async enable2FA(userId, secret) {
    try {
      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      
      // Update user record
      const updated = await User.update(
        {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          backupCodes
        },
        { where: { id: userId } }
      );
      
      return updated[0] > 0;
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw new Error('Failed to enable 2FA');
    }
  }
  
  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @returns {boolean} - Success status
   */
  async disable2FA(userId) {
    try {
      // Update user record
      const updated = await User.update(
        {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: null
        },
        { where: { id: userId } }
      );
      
      return updated[0] > 0;
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw new Error('Failed to disable 2FA');
    }
  }
  
  /**
   * Verify a backup code and consume it if valid
   * @param {string} userId - User ID
   * @param {string} backupCode - Backup code to verify
   * @returns {boolean} - Whether the backup code is valid
   */
  async verifyBackupCode(userId, backupCode) {
    try {
      // Get user with backup codes
      const user = await User.findByPk(userId);
      
      if (!user || !user.backupCodes || !Array.isArray(user.backupCodes)) {
        return false;
      }
      
      // Check if the backup code exists
      const codeIndex = user.backupCodes.indexOf(backupCode);
      
      if (codeIndex === -1) {
        return false;
      }
      
      // Remove the used backup code
      const updatedBackupCodes = [...user.backupCodes];
      updatedBackupCodes.splice(codeIndex, 1);
      
      // Update user
      await User.update(
        { backupCodes: updatedBackupCodes },
        { where: { id: userId } }
      );
      
      return true;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  }
}

module.exports = new TwoFactorService();
`;

    // Write the file
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, serviceContent);
      logger.info('Created 2FA service file');
    } else {
      logger.info('Dry run: Would create 2FA service file');
    }

    return true;
  } catch (error) {
    logger.error('Error creating 2FA service:', error);
    return false;
  }
}

/**
 * Update Auth Service to support 2FA
 */
function updateAuthService() {
  const filePath = CONFIG.targetFiles.authService;

  if (!fs.existsSync(filePath)) {
    logger.error(`Auth service file not found: ${filePath}`);
    return false;
  }

  logger.info(`Updating Auth service: ${filePath}`);

  try {
    // Backup file
    backupFile(filePath);

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if 2FA logic already exists
    if (content.includes('twoFactorEnabled') || content.includes('requireTwoFactor')) {
      logger.info('2FA logic already exists in Auth service');
      return true;
    }

    // Update login method to check for 2FA
    const loginMethodMatch = content.match(/login\s*:\s*async\s*\((.*?)\)\s*=>\s*{([\s\S]*?)return\s+({[^;]*});?\s*}/);

    if (!loginMethodMatch) {
      logger.error('Could not find login method in Auth service');
      return false;
    }

    const loginMethod = loginMethodMatch[0];
    const loginParams = loginMethodMatch[1];
    const loginBody = loginMethodMatch[2];
    const loginReturn = loginMethodMatch[3];

    // Update the login method to check for 2FA
    const updatedLoginMethod = `login: async ${loginParams} => {${loginBody}
      // Check if user has 2FA enabled
      if (user.twoFactorEnabled) {
        logger.info(\`User \${user.email} has 2FA enabled, requiring verification\`);
        
        return {
          requireTwoFactor: true,
          userId: user.id,
          email: user.email,
          role: user.role,
          clientId: client?.clientId
        };
      }
      
      return ${loginReturn};
    }`;

    // Replace the login method in the content
    content = content.replace(loginMethod, updatedLoginMethod);

    // Add method to verify 2FA
    const authServiceEndMatch = content.match(/module\.exports\s*=\s*{([\s\S]*)};?\s*$/);

    if (!authServiceEndMatch) {
      logger.error('Could not find end of Auth service');
      return false;
    }

    const authServiceExports = authServiceEndMatch[1];

    const updatedAuthServiceExports = `${authServiceExports},
  
  // Verify 2FA token and complete authentication
  verify2FA: async (userId, token) => {
    try {
      const twoFactorService = require('./twoFactor.service');
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new Error('2FA is not enabled for this user');
      }
      
      // Verify token
      const isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
      
      if (!isValid) {
        throw new Error('Invalid 2FA token');
      }
      
      // Get an active client for this user
      const client = await Client.findOne({
        where: { 
          userId: user.id,
          status: 'active'
        }
      });
      
      if (!client) {
        throw new Error('No active client found for this user');
      }
      
      // Generate tokens
      const accessToken = await authService.generateToken(user, client, 'access');
      const refreshToken = await authService.generateToken(user, client, 'refresh');
      
      return {
        accessToken,
        refreshToken,
        userId: user.id,
        clientId: client.clientId,
        role: user.role,
        expiresIn: parseInt(JWT_EXPIRY) || 3600
      };
    } catch (error) {
      logger.error(\`2FA verification failed: \${error.message}\`, { stack: error.stack });
      throw error;
    }
  },
  
  // Verify 2FA backup code and complete authentication
  verifyBackupCode: async (userId, backupCode) => {
    try {
      const twoFactorService = require('./twoFactor.service');
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.twoFactorEnabled || !user.backupCodes) {
        throw new Error('2FA is not enabled for this user');
      }
      
      // Verify backup code
      const isValid = await twoFactorService.verifyBackupCode(userId, backupCode);
      
      if (!isValid) {
        throw new Error('Invalid backup code');
      }
      
      // Get an active client for this user
      const client = await Client.findOne({
        where: { 
          userId: user.id,
          status: 'active'
        }
      });
      
      if (!client) {
        throw new Error('No active client found for this user');
      }
      
      // Generate tokens
      const accessToken = await authService.generateToken(user, client, 'access');
      const refreshToken = await authService.generateToken(user, client, 'refresh');
      
      return {
        accessToken,
        refreshToken,
        userId: user.id,
        clientId: client.clientId,
        role: user.role,
        expiresIn: parseInt(JWT_EXPIRY) || 3600
      };
    } catch (error) {
      logger.error(\`Backup code verification failed: \${error.message}\`, { stack: error.stack });
      throw error;
    }
  }`;

    // Replace exports in the content
    content = content.replace(authServiceEndMatch[0], `module.exports = {${updatedAuthServiceExports}};`);

    // Write the updated content
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, content);
      logger.info('Updated Auth service with 2FA support');
    } else {
      logger.info('Dry run: Would update Auth service with 2FA support');
    }

    return true;
  } catch (error) {
    logger.error('Error updating Auth service:', error);
    return false;
  }
}

/**
 * Update Auth Controller to support 2FA
 */
function updateAuthController() {
  const filePath = CONFIG.targetFiles.authController;

  if (!fs.existsSync(filePath)) {
    logger.error(`Auth controller file not found: ${filePath}`);
    return false;
  }

  logger.info(`Updating Auth controller: ${filePath}`);

  try {
    // Backup file
    backupFile(filePath);

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if 2FA methods already exist
    if (content.includes('verify2FA') || content.includes('generate2FASecret')) {
      logger.info('2FA methods already exist in Auth controller');
      return true;
    }

    // Add 2FA methods to the Auth controller
    const controllerEndMatch = content.match(/module\.exports\s*=\s*new\s+AuthController\(\);?\s*$/);

    if (!controllerEndMatch) {
      logger.error('Could not find end of Auth controller');
      return false;
    }

    // Find the class definition
    const classDefMatch = content.match(/class\s+AuthController\s*{([\s\S]*?)}/);

    if (!classDefMatch) {
      logger.error('Could not find Auth controller class definition');
      return false;
    }

    const classDefinition = classDefMatch[0];
    const classBody = classDefMatch[1];

    // Add 2FA methods to the class
    const updatedClassDefinition = `class AuthController {${classBody}

  /**
   * Generate 2FA secret for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generate2FASecret(req, res) {
    try {
      const { userId } = req.auth;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Get the two-factor service
      const twoFactorService = require('../services/twoFactor.service');
      
      // Get user information
      const { User } = require('../models/User');
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Generate secret and QR code
      const { secret, qrCodeUrl } = await twoFactorService.generateSecret(user);
      
      return res.status(200).json({
        success: true,
        data: {
          secret,
          qrCodeUrl
        }
      });
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate 2FA secret',
        error: error.message
      });
    }
  }
  
  /**
   * Enable 2FA for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async enable2FA(req, res) {
    try {
      const { userId } = req.auth;
      const { secret, token } = req.body;
      
      if (!userId || !secret || !token) {
        return res.status(400).json({
          success: false,
          message: 'User ID, secret, and token are required'
        });
      }
      
      // Get the two-factor service
      const twoFactorService = require('../services/twoFactor.service');
      
      // Verify token before enabling
      const isValid = twoFactorService.verifyToken(token, secret);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA token'
        });
      }
      
      // Enable 2FA
      const result = await twoFactorService.enable2FA(userId, secret);
      
      if (!result) {
        return res.status(500).json({
          success: false,
          message: 'Failed to enable 2FA'
        });
      }
      
      // Get backup codes to return
      const { User } = require('../models/User');
      const user = await User.findByPk(userId);
      
      return res.status(200).json({
        success: true,
        message: '2FA enabled successfully',
        data: {
          backupCodes: user.backupCodes
        }
      });
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to enable 2FA',
        error: error.message
      });
    }
  }
  
  /**
   * Disable 2FA for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async disable2FA(req, res) {
    try {
      const { userId } = req.auth;
      const { token } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Get the two-factor service
      const twoFactorService = require('../services/twoFactor.service');
      
      // Get user information
      const { User } = require('../models/User');
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled for this user'
        });
      }
      
      // Verify token before disabling
      if (token) {
        const isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
        
        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid 2FA token'
          });
        }
      }
      
      // Disable 2FA
      const result = await twoFactorService.disable2FA(userId);
      
      if (!result) {
        return res.status(500).json({
          success: false,
          message: 'Failed to disable 2FA'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
        error: error.message
      });
    }
  }
  
  /**
   * Verify 2FA token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verify2FA(req, res) {
    try {
      const { userId, token, backupCode } = req.body;
      
      if (!userId || (!token && !backupCode)) {
        return res.status(400).json({
          success: false,
          message: 'User ID and either token or backup code are required'
        });
      }
      
      let authResult;
      
      // Use either token or backup code
      if (token) {
        authResult = await authService.verify2FA(userId, token);
      } else {
        authResult = await authService.verifyBackupCode(userId, backupCode);
      }
      
      return res.status(200).json({
        success: true,
        data: authResult
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to verify 2FA'
      });
    }
  }
}`;

    // Replace the class definition in the content
    content = content.replace(classDefinition, updatedClassDefinition);

    // Write the updated content
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, content);
      logger.info('Updated Auth controller with 2FA methods');
    } else {
      logger.info('Dry run: Would update Auth controller with 2FA methods');
    }

    return true;
  } catch (error) {
    logger.error('Error updating Auth controller:', error);
    return false;
  }
}

/**
 * Update Auth Routes to add 2FA endpoints
 */
function updateAuthRoutes() {
  const filePath = CONFIG.targetFiles.authRoutes;

  if (!fs.existsSync(filePath)) {
    logger.error(`Auth routes file not found: ${filePath}`);
    return false;
  }

  logger.info(`Updating Auth routes: ${filePath}`);

  try {
    // Backup file
    backupFile(filePath);

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if 2FA routes already exist
    if (content.includes('verify-2fa') || content.includes('generate-2fa')) {
      logger.info('2FA routes already exist in Auth routes');
      return true;
    }

    // Find the end of routes
    const endOfRoutesMatch = content.match(/module\.exports\s*=\s*router;?\s*$/);

    if (!endOfRoutesMatch) {
      logger.error('Could not find end of routes in Auth routes file');
      return false;
    }

    // Add 2FA routes before the export
    const newRoutes = `
/**
 * @route POST /api/auth/verify-2fa
 * @desc Verify 2FA token and complete authentication
 * @access Public (with userId from initial login)
 */
router.post('/verify-2fa', authController.verify2FA);

/**
 * @route POST /api/auth/generate-2fa
 * @desc Generate 2FA secret for a user
 * @access Private
 */
router.post('/generate-2fa', authMiddleware, authController.generate2FASecret);

/**
 * @route POST /api/auth/enable-2fa
 * @desc Enable 2FA for a user
 * @access Private
 */
router.post('/enable-2fa', authMiddleware, authController.enable2FA);

/**
 * @route POST /api/auth/disable-2fa
 * @desc Disable 2FA for a user
 * @access Private
 */
router.post('/disable-2fa', authMiddleware, authController.disable2FA);

`;

    // Insert new routes before the export
    content = content.replace(
      endOfRoutesMatch[0],
      newRoutes + endOfRoutesMatch[0]
    );

    // Write the updated content
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, content);
      logger.info('Updated Auth routes with 2FA endpoints');
    } else {
      logger.info('Dry run: Would update Auth routes with 2FA endpoints');
    }

    return true;
  } catch (error) {
    logger.error('Error updating Auth routes:', error);
    return false;
  }
}

/**
 * Install required dependencies for 2FA
 */
function installDependencies() {
  try {
    logger.info('Installing required dependencies for 2FA...');

    if (CONFIG.dryRun) {
      logger.info('Dry run: Would install speakeasy and qrcode packages');
      return true;
    }

    // Install dependencies
    execSync('npm install --save speakeasy qrcode', {
      cwd: CONFIG.codebaseDir,
      stdio: 'inherit'
    });

    logger.info('Successfully installed 2FA dependencies');
    return true;
  } catch (error) {
    logger.error('Error installing dependencies:', error);
    return false;
  }
}

/**
 * Implement 2FA across the application
 */
async function implement2FA() {
  const startTime = Date.now();
  logger.info('Starting 2FA implementation...');

  try {
    // Install dependencies
    const depsInstalled = installDependencies();

    // Update User model
    const modelUpdated = updateUserModel();

    // Create 2FA service
    const serviceCreated = create2FAService();

    // Update Auth service
    const authServiceUpdated = updateAuthService();

    // Update Auth controller
    const controllerUpdated = updateAuthController();

    // Update Auth routes
    const routesUpdated = updateAuthRoutes();

    // Output results
    console.log('\n2FA Implementation Summary:');
    console.log('=========================');
    console.log(`Dependencies: ${depsInstalled ? '✅ Installed' : '❌ Failed'}`);
    console.log(`User Model: ${modelUpdated ? '✅ Updated' : '❌ Failed'}`);
    console.log(`2FA Service: ${serviceCreated ? '✅ Created' : '❌ Failed'}`);
    console.log(`Auth Service: ${authServiceUpdated ? '✅ Updated' : '❌ Failed'}`);
    console.log(`Auth Controller: ${controllerUpdated ? '✅ Updated' : '❌ Failed'}`);
    console.log(`Auth Routes: ${routesUpdated ? '✅ Updated' : '❌ Failed'}`);

    const allSuccessful = depsInstalled && modelUpdated && serviceCreated && authServiceUpdated && controllerUpdated && routesUpdated;
    console.log(`\nOverall status: ${allSuccessful ? '✅ Successfully implemented 2FA' : '❌ Some steps failed'}`);

    if (CONFIG.dryRun) {
      console.log('\nNote: This was a dry run. No actual changes were made.');
    } else if (allSuccessful) {
      console.log('\nNext steps:');
      console.log('1. Run database migrations to update the User model');
      console.log('2. Test the 2FA implementation');
      console.log('3. Update frontend to support 2FA flow');
    }

    logger.info(`2FA implementation completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

    return allSuccessful;
  } catch (error) {
    logger.error('Error implementing 2FA:', error);
    return false;
  }
}

// Run the 2FA implementation
implement2FA();

module.exports = {
  implement2FA,
  updateUserModel,
  create2FAService,
  updateAuthService,
  updateAuthController,
  updateAuthRoutes,
  installDependencies,
  CONFIG
};