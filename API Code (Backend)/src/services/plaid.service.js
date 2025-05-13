// services/plaid.service.js
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

    // Configure Plaid client based on environment
    const configuration = new Configuration({
      basePath: this._getPlaidEnvironment(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
          'Plaid-Version': '2020-09-14',
        },
      },
    });

    this.client = new PlaidApi(configuration);

    logger.info('Plaid service initialized with environment:', {
      environment: process.env.PLAID_ENV || 'sandbox',
      clientIdSet: !!process.env.PLAID_CLIENT_ID,
      secretSet: !!process.env.PLAID_SECRET
    });
  }

  /**
   * Get Plaid environment based on NODE_ENV
   * @returns {string} - Plaid environment URL
   */
  _getPlaidEnvironment() {
    const env = process.env.PLAID_ENV || 'sandbox';

    switch (env) {
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
      logger.error('Error getting accounts:', error);
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
  async getTransactions(accessToken, startDate, endDate) {
    try {
      const request = {
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          count: 100,
          offset: 0
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

        allTransactions = [...allTransactions, ...response.data.transactions];

        hasMore = response.data.total_transactions > allTransactions.length;
        offset += response.data.transactions.length;
      }

      logger.info(`Retrieved ${allTransactions.length} transactions`);

      // Transform to our transaction model format
      return allTransactions.map(transaction => ({
        transactionId: transaction.transaction_id,
        accountId: transaction.account_id,
        date: transaction.date,
        description: transaction.name,
        amount: -transaction.amount, // Plaid uses positive for withdrawals, we use negative
        category: transaction.category && transaction.category.length > 0 ? transaction.category[0] : 'Uncategorized',
        subCategory: transaction.category && transaction.category.length > 1 ? transaction.category[1] : null,
        type: this._mapTransactionType(transaction),
        merchantName: transaction.merchant_name || transaction.name,
        location: transaction.location.city ? `${transaction.location.city}, ${transaction.location.region}` : null,
        pending: transaction.pending
      }));
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw new Error(`Failed to get transactions: ${error.message}`);
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