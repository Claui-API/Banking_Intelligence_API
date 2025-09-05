// src/services/plaid.service.js - Modified to fix environment issues
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

class PlaidService {
  constructor() {
    // Check for required environment variables
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      logger.error('Missing required Plaid API credentials');
    }

    // Determine environment from token prefix
    this.determineEnvironmentFromTokens();

    // Initialize with default environment (will be updated if needed)
    this.initializeClient(process.env.PLAID_ENV || 'sandbox');

    logger.info('Plaid service initialized with environment:', {
      environment: this.environment,
      clientIdSet: !!process.env.PLAID_CLIENT_ID,
      secretSet: !!process.env.PLAID_SECRET
    });
  }

  /**
   * Initialize client with specific environment
   * @param {string} environment - 'sandbox', 'development', or 'production'
   */
  initializeClient(environment) {
    this.environment = environment;

    // Configure Plaid client based on environment
    const configuration = new Configuration({
      basePath: this._getPlaidEnvironment(environment),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
          'Plaid-Version': '2020-09-14',
        },
      },
    });

    this.client = new PlaidApi(configuration);
    logger.info(`Plaid client reconfigured to use ${environment} environment`);
  }

  /**
   * Determine environment based on existing tokens in database
   */
  async determineEnvironmentFromTokens() {
    try {
      // Import models dynamically to avoid circular dependencies
      const PlaidItem = require('../models/PlaidItem');

      // Get the first active token
      const firstItem = await PlaidItem.findOne({
        where: { status: 'active' }
      });

      if (firstItem && firstItem.accessToken) {
        // Detect environment from token prefix
        const tokenPrefix = firstItem.accessToken.split('-')[0];

        if (tokenPrefix === 'access-sandbox') {
          logger.info('Detected sandbox tokens in database, using sandbox environment');
          process.env.PLAID_ENV = 'sandbox';
        } else if (tokenPrefix === 'access-development') {
          logger.info('Detected development tokens in database, using development environment');
          process.env.PLAID_ENV = 'development';
        } else if (tokenPrefix === 'access-production') {
          logger.info('Detected production tokens in database, using production environment');
          process.env.PLAID_ENV = 'production';
        }
      }
    } catch (error) {
      logger.error('Error determining Plaid environment from tokens:', error);
    }
  }

  /**
   * Get Plaid environment based on environment string
   * @param {string} env - Environment name
   * @returns {string} - Plaid environment URL
   */
  _getPlaidEnvironment(env = 'sandbox') {
    switch (env.toLowerCase()) {
      case 'sandbox':
        return PlaidEnvironments.sandbox;
      case 'development':
        return PlaidEnvironments.development;
      case 'production':
        return PlaidEnvironments.production;
      default:
        return PlaidEnvironments.sandbox;
    }
  }

  /**
   * Create a link token for a user
   * @param {string} userId - User ID
   * @param {Array} products - Array of Plaid products to use (e.g., ['transactions', 'auth'])
   * @returns {Object} - Link token response
   */
  async createLinkToken(userId, products = ['transactions']) {
    try {
      const request = {
        user: {
          client_user_id: userId
        },
        client_name: 'Banking Intelligence App',
        products: products,
        language: 'en',
        country_codes: ['US'],
        webhook: process.env.PLAID_WEBHOOK_URL
      };

      const response = await this.client.linkTokenCreate(request);
      logger.info(`Link token created for user: ${userId}`);

      return response.data;
    } catch (error) {
      logger.error('Error creating link token:', error);
      throw new Error(`Failed to create link token: ${error.message}`);
    }
  }

  /**
   * Exchange public token for access token
   * @param {string} publicToken - Public token from Plaid Link
   * @returns {Object} - Access token response
   */
  async exchangePublicToken(publicToken) {
    try {
      const request = {
        public_token: publicToken
      };

      const response = await this.client.itemPublicTokenExchange(request);
      logger.info('Public token exchanged for access token');

      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id
      };
    } catch (error) {
      logger.error('Error exchanging public token:', error);
      throw new Error(`Failed to exchange public token: ${error.message}`);
    }
  }

  /**
   * Get bank account information for a user
   * @param {string} accessToken - Plaid access token
   * @returns {Array} - Array of bank accounts
   */
  async getAccounts(accessToken) {
    try {
      // Check token environment vs client environment and switch if needed
      this._validateTokenEnvironment(accessToken);

      const request = {
        access_token: accessToken
      };

      const response = await this.client.accountsGet(request);
      logger.info(`Retrieved ${response.data.accounts.length} accounts`);

      // Transform to our account model format
      return response.data.accounts.map(account => ({
        accountId: account.account_id,
        name: account.name,
        type: this._mapAccountType(account.type),
        subType: account.subtype,
        balance: account.balances.current,
        availableBalance: account.balances.available,
        currency: account.balances.iso_currency_code,
        mask: account.mask,
        officialName: account.official_name
      }));
    } catch (error) {
      logger.error(`Error getting accounts for token: ${accessToken.substring(0, 10)}...`, error);
      throw new Error(`Failed to get accounts: ${error.message}`);
    }
  }

  /**
 * Get transactions for a user
 * @param {string} accessToken - Plaid access token
 * @param {Date} startDate - Start date for transactions (ISO format)
 * @param {Date} endDate - End date for transactions (ISO format)
 * @returns {Array} - Array of transactions
 */
  // 1. Update plaid.service.js getTransactions method
  async getTransactions(accessToken, startDate, endDate) {
    try {
      // Check token environment vs client environment and switch if needed
      this._validateTokenEnvironment(accessToken);

      const request = {
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          count: 100,
          offset: 0,
          include_personal_finance_category: true // Add this to get enhanced categories
        }
      };

      // Initialize an empty array to store all transactions
      let allTransactions = [];
      let hasMore = true;
      let offset = 0;

      // Paginate through all transactions
      while (hasMore) {
        request.options.offset = offset;
        const response = await this.client.transactionsGet(request);

        // Debug log the raw first transaction to see what Plaid is returning
        if (response.data.transactions && response.data.transactions.length > 0) {
          const sample = response.data.transactions[0];
          logger.debug('Raw Plaid transaction sample:', {
            name: sample.name,
            category: JSON.stringify(sample.category),
            personal_finance_category: sample.personal_finance_category,
            available_keys: Object.keys(sample)
          });
        }

        allTransactions = [...allTransactions, ...response.data.transactions];

        hasMore = response.data.total_transactions > allTransactions.length;
        offset += response.data.transactions.length;
      }

      logger.info(`Retrieved ${allTransactions.length} transactions`);

      // Enhanced transaction mapping with better category handling
      return allTransactions.map(transaction => {
        // Improved category handling logic
        let category = 'Uncategorized';
        let subCategory = null;
        let categoryDetail = null;

        // Try Plaid's category array first
        if (transaction.category && Array.isArray(transaction.category) && transaction.category.length > 0) {
          category = transaction.category[0];
          if (transaction.category.length > 1) {
            subCategory = transaction.category[1];
          }
          categoryDetail = [...transaction.category]; // Store full category array
        }
        // Try personal_finance_category as fallback
        else if (transaction.personal_finance_category && transaction.personal_finance_category.primary) {
          category = transaction.personal_finance_category.primary;
          subCategory = transaction.personal_finance_category.detailed || null;
          categoryDetail = [category, subCategory].filter(Boolean);
        }
        // If still no category, infer from merchant or transaction properties
        else {
          const merchantName = (transaction.merchant_name || transaction.name || '').toLowerCase();

          // Map common merchants to categories
          if (merchantName.includes('uber') && !merchantName.includes('eats')) {
            category = 'Transportation';
          }
          else if (merchantName.includes('uber eats') || merchantName.includes('doordash')) {
            category = 'Food and Drink';
          }
          else if (merchantName.includes('amazon') || merchantName.includes('shop')) {
            category = 'Shopping';
          }
          else if (merchantName.includes('netflix') || merchantName.includes('spotify')) {
            category = 'Entertainment';
          }
          else if (merchantName.includes('airbnb') || merchantName.includes('hotel')) {
            category = 'Travel';
          }

          categoryDetail = [category];
        }

        return {
          transactionId: transaction.transaction_id,
          accountId: transaction.account_id,
          date: transaction.date,
          description: transaction.name,
          amount: -transaction.amount, // Plaid uses positive for withdrawals, we use negative
          category: category,
          subCategory: subCategory,
          type: this._mapTransactionType(transaction),
          merchantName: transaction.merchant_name || transaction.name,
          location: transaction.location && transaction.location.city ?
            `${transaction.location.city}${transaction.location.region ? ', ' + transaction.location.region : ''}` :
            null,
          pending: transaction.pending,
          categoryDetail: categoryDetail
        };
      });
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }

  /**
   * Validate that the token environment matches client environment and switch if needed
   * @param {string} accessToken - Plaid access token
   */
  _validateTokenEnvironment(accessToken) {
    if (!accessToken) return;

    // Extract environment from token
    const parts = accessToken.split('-');
    if (parts.length < 2) return;

    const tokenEnv = parts[1];
    let clientEnv = '';

    // Determine client environment
    if (this.environment === 'sandbox') {
      clientEnv = 'sandbox';
    } else if (this.environment === 'development') {
      clientEnv = 'development';
    } else if (this.environment === 'production') {
      clientEnv = 'production';
    }

    // If mismatch, reconfigure client
    if (tokenEnv !== clientEnv) {
      logger.warn(`Token environment (${tokenEnv}) doesn't match client environment (${clientEnv}), switching client configuration`);

      switch (tokenEnv) {
        case 'sandbox':
          this.initializeClient('sandbox');
          break;
        case 'development':
          this.initializeClient('development');
          break;
        case 'production':
          this.initializeClient('production');
          break;
      }
    }
  }

  /**
   * Map Plaid account type to our account type
   * @param {string} plaidType - Plaid account type
   * @returns {string} - Our account type
   */
  _mapAccountType(plaidType) {
    const typeMap = {
      'depository': 'Checking',
      'credit': 'Credit Card',
      'loan': 'Loan',
      'investment': 'Investment',
      'other': 'Other'
    };

    return typeMap[plaidType] || 'Other';
  }

  /**
   * Map Plaid transaction to our transaction type
   * @param {Object} transaction - Plaid transaction
   * @returns {string} - Our transaction type
   */
  _mapTransactionType(transaction) {
    if (transaction.amount <= 0) {
      return 'income';
    }

    if (transaction.category &&
      (transaction.category.includes('Transfer') ||
        transaction.category.includes('Payment'))) {
      return 'transfer';
    }

    return 'expense';
  }
}

module.exports = new PlaidService();