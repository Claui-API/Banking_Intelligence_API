// src/services/cohere-rag.service.js
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const { DataTypes, Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Service for implementing Cohere's native RAG capabilities with PostgreSQL
 * This service optimizes API usage by managing document storage,
 * caching, and leveraging Cohere's built-in RAG features
 */
class CohereRagService {
  constructor() {
    this.initializeCohere();
    this.initializeModels();
    
    // Document chunking configuration
    this.chunkConfig = {
      chunkSize: parseInt(process.env.COHERE_CHUNK_SIZE) || 512,
      chunkOverlap: parseInt(process.env.COHERE_CHUNK_OVERLAP) || 50,
      maxChunksPerQuery: parseInt(process.env.COHERE_MAX_CHUNKS) || 10
    };
    
    // Tracking metrics for optimization
    this.metrics = {
      totalQueries: 0,
      cachedQueries: 0,
      directApiCalls: 0
    };
    
    // Cache for recent query results to prevent repeated API calls
    // for identical questions in short timeframes
    this.queryCache = new Map();
    
    // Cache expiration in milliseconds (default: 1 hour)
    this.cacheExpiration = parseInt(process.env.COHERE_CACHE_EXPIRATION) || 60 * 60 * 1000;
    
    logger.info('Cohere RAG Service initialized');
  }
  
  /**
   * Initialize Cohere client with retry logic
   */
  async initializeCohere() {
    try {
      // Import cohere client - dynamic import to avoid issues with older Node.js versions
      const cohere = await import('cohere-ai');
      this.cohere = new cohere.CohereClient({
        token: process.env.COHERE_API_KEY
      });
      
      logger.info('Cohere client initialized successfully');
    } catch (error) {
      logger.error('Error initializing Cohere client:', error);
      throw new Error('Failed to initialize Cohere client');
    }
  }
  
  /**
   * Initialize database models for document storage
   */
  async initializeModels() {
    try {
      const schema = process.env.COHERE_RAG_DATABASE_SCHEMA || 'public';
      const tablePrefix = process.env.COHERE_RAG_DATABASE_PREFIX || 'cohere_rag_';
      
      // Model to store financial data chunks
      this.FinancialDocuments = sequelize.define(`${tablePrefix}documents`, {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id'
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        metadata: {
          type: DataTypes.JSONB, // Use JSONB for PostgreSQL
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          field: 'created_at'
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          field: 'updated_at'
        }
      }, {
        schema,
        tableName: `${tablePrefix}documents`,
        underscored: true, // Use snake_case for column names
        indexes: [
          {
            fields: ['user_id']
          }
        ]
      });
      
      // Model to track query history and results
      this.QueryHistory = sequelize.define(`${tablePrefix}query_history`, {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id'
        },
        query: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        queryType: {
          type: DataTypes.STRING,
          allowNull: false,
          field: 'query_type'
        },
        response: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        usedCohereRag: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          field: 'used_cohere_rag'
        },
        documentIds: {
          type: DataTypes.ARRAY(DataTypes.UUID),
          allowNull: true,
          field: 'document_ids'
        },
        metrics: {
          type: DataTypes.JSONB, // Use JSONB for PostgreSQL
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          field: 'created_at'
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          field: 'updated_at'
        }
      }, {
        schema,
        tableName: `${tablePrefix}query_history`,
        underscored: true,
        indexes: [
          {
            fields: ['user_id']
          },
          {
            fields: ['query_type']
          }
        ]
      });
      
      // Sync models with database
      await this.FinancialDocuments.sync();
      await this.QueryHistory.sync();
      
      logger.info('Cohere RAG database models initialized and synced');
    } catch (error) {
      logger.error('Error initializing Cohere RAG database models:', error);
      logger.warn('Will continue with limited functionality');
    }
  }
  
  /**
   * Process user financial data into document chunks for RAG
   * @param {string} userId - The user's ID
   * @param {Object} financialData - User's financial data
   * @returns {Array} - Array of document references
   */
  async processFinancialData(userId, financialData) {
    try {
      logger.info(`Processing financial data for user ${userId}`);
      
      // Extract relevant data from financial data
      const documentChunks = [];
      
      // Process accounts data
      if (financialData.accounts && Array.isArray(financialData.accounts)) {
        const accountsText = this._createAccountsSummary(financialData.accounts);
        documentChunks.push({
          title: 'User Accounts Summary',
          text: accountsText,
          metadata: {
            type: 'accounts',
            timestamp: new Date().toISOString(),
            count: financialData.accounts.length
          }
        });
        
        // Add individual account details
        financialData.accounts.forEach(account => {
          documentChunks.push({
            title: `Account: ${account.name || account.type}`,
            text: this._formatAccountDetails(account),
            metadata: {
              type: 'account',
              accountId: account.accountId,
              accountType: account.type,
              timestamp: new Date().toISOString()
            }
          });
        });
      }
      
      // Process transactions data
      if (financialData.transactions && Array.isArray(financialData.transactions)) {
        // Group transactions by category for better insights
        const categorizedTransactions = this._categorizeTransactions(financialData.transactions);
        
        // Create a summary document for transaction trends
        documentChunks.push({
          title: 'Transaction Trends',
          text: this._createTransactionTrendsSummary(financialData.transactions),
          metadata: {
            type: 'transaction_trends',
            timestamp: new Date().toISOString(),
            count: financialData.transactions.length
          }
        });
        
        // Create documents for each category
        Object.entries(categorizedTransactions).forEach(([category, transactions]) => {
          if (transactions.length > 0) {
            documentChunks.push({
              title: `${category} Transactions`,
              text: this._formatCategoryTransactions(category, transactions),
              metadata: {
                type: 'category_transactions',
                category,
                timestamp: new Date().toISOString(),
                count: transactions.length
              }
            });
          }
        });
      }
      
      // Process user profile if available
      if (financialData.userProfile) {
        documentChunks.push({
          title: 'User Profile Information',
          text: this._formatUserProfile(financialData.userProfile),
          metadata: {
            type: 'user_profile',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Process spending patterns if available
      if (financialData.spendingPatterns && Array.isArray(financialData.spendingPatterns)) {
        documentChunks.push({
          title: 'Spending Patterns',
          text: this._formatSpendingPatterns(financialData.spendingPatterns),
          metadata: {
            type: 'spending_patterns',
            timestamp: new Date().toISOString(),
            count: financialData.spendingPatterns.length
          }
        });
      }
      
      // Add summary statistics
      documentChunks.push({
        title: 'Financial Overview',
        text: this._createFinancialOverview(financialData),
        metadata: {
          type: 'financial_overview',
          timestamp: new Date().toISOString()
        }
      });
      
      // Store document chunks in database
      const storedDocuments = await this._storeDocuments(userId, documentChunks);
      
      return storedDocuments;
    } catch (error) {
      logger.error(`Error processing financial data for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Store document chunks in the database
   * @param {string} userId - User ID
   * @param {Array} documentChunks - Array of document chunks to store
   * @returns {Array} - Array of stored document references
   */
  async _storeDocuments(userId, documentChunks) {
    try {
      // First, delete existing documents for this user to refresh the data
      await this.FinancialDocuments.destroy({
        where: { userId }
      });
      
      // Store new documents (in transaction for consistency)
      const storedDocuments = [];
      const transaction = await sequelize.transaction();
      
      try {
        for (const chunk of documentChunks) {
          const documentId = uuidv4();
          
          const document = await this.FinancialDocuments.create({
            id: documentId,
            userId,
            title: chunk.title,
            text: chunk.text,
            metadata: chunk.metadata
          }, { transaction });
          
          storedDocuments.push({
            id: document.id,
            title: document.title,
            text: document.text
          });
        }
        
        await transaction.commit();
        logger.info(`Stored ${storedDocuments.length} documents for user ${userId}`);
      } catch (error) {
        await transaction.rollback();
        logger.error(`Transaction error storing documents for user ${userId}:`, error);
        throw error;
      }
      
      return storedDocuments;
    } catch (error) {
      logger.error(`Error storing documents for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Generate insights using Cohere's RAG capabilities
   * @param {string} userId - User ID
   * @param {string} query - User query
   * @param {string} queryType - Type of query
   * @returns {Object} - Generated insights
   */
  async generateInsights(userId, query, queryType) {
    try {
      // Check cache first for recent identical queries
      const cacheKey = `${userId}:${query}`;
      if (this.queryCache.has(cacheKey)) {
        const cachedData = this.queryCache.get(cacheKey);
        
        // Check if cache is still valid
        if (Date.now() - cachedData.timestamp < this.cacheExpiration) {
          logger.info(`Cache hit for query: "${query}"`);
          this.metrics.cachedQueries++;
          return cachedData.response;
        }
      }
      
      this.metrics.totalQueries++;
      
      // Retrieve user documents from database
      const documents = await this.FinancialDocuments.findAll({
        where: { userId },
        attributes: ['id', 'title', 'text']
      });
      
      if (!documents || documents.length === 0) {
        logger.warn(`No documents found for user ${userId}`);
        this.metrics.directApiCalls++;
        
        // Call Cohere directly without RAG if no documents are available
        const directResponse = await this._callCohereWithoutRag(query, queryType);
        return directResponse;
      }
      
      // Format documents for Cohere's documents parameter
      const formattedDocuments = documents.map(doc => ({
        id: doc.id.toString(), // Ensure ID is a string
        title: doc.title,
        text: doc.text
      }));
      
      // Select most relevant documents based on query type
      const filteredDocuments = this._filterDocumentsByQueryType(formattedDocuments, queryType);
      
      // Get response using Cohere's RAG capabilities
      const startTime = Date.now();
      
      logger.info(`Calling Cohere chat with RAG for query "${query}"`);
      const cohereResponse = await this.cohere.chat({
        message: query,
        model: process.env.COHERE_MODEL || 'command-r-plus',
        documents: filteredDocuments.slice(0, this.chunkConfig.maxChunksPerQuery),
        preamble: this._generatePreamble(queryType),
        temperature: this._getTemperatureForQueryType(queryType)
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Extract the response and citations
      const responseText = cohereResponse.text || '';
      const citations = cohereResponse.citations || [];
      
      // Format the response
      const insight = {
        insight: responseText,
        citations: citations,
        timestamp: new Date().toISOString(),
        queryType,
        processingTime,
        usedRag: true
      };
      
      // Store in cache for subsequent identical queries
      this.queryCache.set(cacheKey, {
        response: insight,
        timestamp: Date.now()
      });
      
      // Store query in history
      await this._storeQueryHistory(userId, query, queryType, insight, documents);
      
      logger.info(`Generated RAG response for query "${query}" in ${processingTime}ms`);
      
      return insight;
    } catch (error) {
      logger.error(`Error generating insights with Cohere RAG for user ${userId}:`, error);
      
      // Fall back to direct API call without RAG if there's an error
      logger.info(`Falling back to direct API call for query "${query}"`);
      this.metrics.directApiCalls++;
      const fallbackResponse = await this._callCohereWithoutRag(query, queryType);
      return fallbackResponse;
    }
  }
  
  /**
   * Filter documents based on query type for better relevance
   * @param {Array} documents - All user documents
   * @param {string} queryType - Type of query
   * @returns {Array} - Filtered documents
   */
  _filterDocumentsByQueryType(documents, queryType) {
    // For greeting and joke query types, we don't need any documents
    if (queryType === 'greeting' || queryType === 'joke') {
      return [];
    }
    
    // For other query types, prioritize documents based on type
    const typeRelevance = {
      budgeting: ['financial_overview', 'transaction_trends', 'spending_patterns'],
      spending: ['category_transactions', 'transaction_trends', 'spending_patterns'],
      saving: ['financial_overview', 'transaction_trends', 'spending_patterns'],
      investing: ['financial_overview', 'user_profile', 'accounts'],
      debt: ['category_transactions', 'accounts', 'financial_overview'],
      financial: [] // Empty means include all
    };
    
    // Get relevant document types for this query
    const relevantTypes = typeRelevance[queryType] || [];
    
    // If no specific types, return all documents
    if (relevantTypes.length === 0) return documents;
    
    // Create two groups: primary (highest relevance) and secondary (less relevant)
    const primary = [];
    const secondary = [];
    
    for (const doc of documents) {
      // Try to extract the type from metadata
      let docType = null;
      
      try {
        if (typeof doc.metadata === 'string') {
          const metadata = JSON.parse(doc.metadata);
          docType = metadata.type;
        } else if (doc.metadata && typeof doc.metadata === 'object') {
          docType = doc.metadata.type;
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      // Check if document has a relevant type
      if (docType && relevantTypes.includes(docType)) {
        // Sort by relevance (order in the array)
        const relevanceIndex = relevantTypes.indexOf(docType);
        if (relevanceIndex >= 0 && relevanceIndex < 2) { // Top 2 types are primary
          primary.push(doc);
        } else {
          secondary.push(doc);
        }
      } else {
        secondary.push(doc);
      }
    }
    
    // Combine primary and secondary, limiting to max chunks per query
    return [...primary, ...secondary].slice(0, this.chunkConfig.maxChunksPerQuery);
  }
  
  /**
   * Call Cohere directly without using RAG (fallback method)
   * @param {string} query - User query
   * @param {string} queryType - Type of query
   * @returns {Object} - Generated insights
   */
  async _callCohereWithoutRag(query, queryType) {
    try {
      const startTime = Date.now();
      
      const cohereResponse = await this.cohere.chat({
        message: query,
        model: process.env.COHERE_MODEL || 'command-r-plus',
        preamble: this._generatePreamble(queryType),
        temperature: this._getTemperatureForQueryType(queryType)
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      return {
        insight: cohereResponse.text || '',
        timestamp: new Date().toISOString(),
        queryType,
        processingTime,
        usedRag: false
      };
    } catch (error) {
      logger.error(`Error calling Cohere without RAG:`, error);
      throw error;
    }
  }
  
  /**
   * Store query history in database
   * @param {string} userId - User ID
   * @param {string} query - Query text
   * @param {string} queryType - Type of query
   * @param {Object} response - Response from Cohere
   * @param {Array} documents - Documents used for RAG
   */
  async _storeQueryHistory(userId, query, queryType, response, documents) {
    try {
      await this.QueryHistory.create({
        id: uuidv4(),
        userId,
        query,
        queryType,
        response: JSON.stringify(response),
        usedCohereRag: response.usedRag || true,
        documentIds: documents.map(doc => doc.id),
        metrics: {
          processingTime: response.processingTime,
          timestamp: new Date().toISOString(),
          documentsUsed: documents.length
        }
      });
      
      logger.info(`Stored query history for user ${userId} and query "${query}"`);
    } catch (error) {
      logger.error(`Error storing query history for user ${userId}:`, error);
    }
  }
  
  /**
   * Generate appropriate preamble for Cohere based on query type
   * @param {string} queryType - Type of query
   * @returns {string} - Preamble for Cohere
   */
  _generatePreamble(queryType) {
    switch (queryType) {
      case 'greeting':
        return "You're a friendly AI financial assistant named CLAU. Introduce yourself. Keep your responses short, warm, and personable. Use 1-2 emojis for a friendly feel. Don't include any specific financial details in greetings.";
      
      case 'joke':
        return "You're a friendly AI financial assistant named CLAU. If asked for a joke, provide a clean, clever joke related to finance, money, or banking. Keep it light and professional. Add 1-2 emojis for a friendly touch.";
      
      case 'budgeting':
        return "You're a financial advisor specializing in budgeting named CLAU. Provide specific, actionable budgeting advice based on the user's financial data. Include percentage breakdowns, concrete dollar amounts, and practical next steps. Use visuals like bullet points for clarity.";
      
      case 'spending':
        return "You're a spending analyst named CLAU. Provide clear insights into spending patterns with specific numbers and percentages. Identify the top spending categories, unusual expenses, and potential areas for reduction. Be specific with dollar amounts.";
      
      case 'saving':
        return "You're a savings specialist named CLAU. Calculate the user's current savings rate and recommend specific strategies to increase savings, with estimated dollar impacts. Be encouraging but realistic, and provide concrete next steps.";
      
      case 'investing':
        return "You're an investment educator named CLAU. Provide general education about investing principles without specific investment recommendations. Explain concepts like risk/return, diversification, and compound interest in simple terms. Assess if the user is ready to invest based on their financial situation.";
      
      case 'debt':
        return "You're a debt management expert named CLAU. Analyze the user's debt situation, suggest repayment strategies (snowball, avalanche, etc.), and provide a realistic timeline with monthly payment amounts. Be supportive and non-judgmental.";
      
      default:
        return "You're CLAU, an AI financial assistant. Provide helpful, accurate financial insights based on the user's data. Include specific numbers and percentages whenever possible. Be conversational but focused on actionable advice.";
    }
  }
  
  /**
   * Get appropriate temperature setting based on query type
   * @param {string} queryType - Type of query
   * @returns {number} - Temperature setting (0-1)
   */
  _getTemperatureForQueryType(queryType) {
    switch (queryType) {
      case 'greeting':
      case 'joke':
        return 0.7; // More creative for conversational responses
      
      case 'budgeting':
      case 'spending':
      case 'saving':
      case 'debt':
        return 0.3; // More focused for financial advice
      
      case 'investing':
        return 0.4; // Balanced for educational content
      
      default:
        return 0.5; // Default balanced temperature
    }
  }
  
  // Helper methods for formatting financial data into document chunks
  
  /**
   * Create a summary of user accounts
   * @param {Array} accounts - User's financial accounts
   * @returns {string} - Formatted text summary
   */
  _createAccountsSummary(accounts) {
    if (!accounts || accounts.length === 0) return 'No account information available.';
    
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const netWorth = accounts.reduce((sum, acc) => {
      return acc.type === 'Credit Card' 
        ? sum - Math.abs(acc.balance || 0) 
        : sum + (acc.balance || 0);
    }, 0);
    
    const accountTypes = {};
    accounts.forEach(acc => {
      accountTypes[acc.type] = (accountTypes[acc.type] || 0) + 1;
    });
    
    let summary = `Financial Accounts Summary:\n\n`;
    summary += `Total Accounts: ${accounts.length}\n`;
    summary += `Total Balance: $${totalBalance.toFixed(2)}\n`;
    summary += `Net Worth: $${netWorth.toFixed(2)}\n\n`;
    
    summary += `Account Types:\n`;
    Object.entries(accountTypes).forEach(([type, count]) => {
      summary += `- ${type}: ${count} account(s)\n`;
    });
    
    return summary;
  }
  
  /**
   * Format details for a specific account
   * @param {Object} account - Account object
   * @returns {string} - Formatted text
   */
  _formatAccountDetails(account) {
    let details = `Account Details: ${account.name || 'Unnamed Account'}\n\n`;
    details += `Account ID: ${account.accountId}\n`;
    details += `Type: ${account.type}\n`;
    details += `Balance: $${(account.balance || 0).toFixed(2)}\n`;
    
    if (account.type === 'Credit Card') {
      if (account.creditLimit) {
        const availableCredit = account.creditLimit - Math.abs(account.balance || 0);
        details += `Available Credit: $${availableCredit.toFixed(2)}\n`;
        details += `Credit Limit: $${account.creditLimit.toFixed(2)}\n`;
      }
      if (account.dueDate) details += `Payment Due Date: ${new Date(account.dueDate).toLocaleDateString()}\n`;
      if (account.minimumPayment) details += `Minimum Payment: $${account.minimumPayment.toFixed(2)}\n`;
    }
    
    details += `\nThis account represents ${account.type === 'Credit Card' ? 'debt' : 'assets'} `;
    details += `and contributes to the user's overall financial picture.`;
    
    return details;
  }
  
  /**
   * Group transactions by category
   * @param {Array} transactions - User's financial transactions
   * @returns {Object} - Transactions grouped by category
   */
  _categorizeTransactions(transactions) {
    const categories = {};
    
    transactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(transaction);
    });
    
    return categories;
  }
  
  /**
   * Create a summary of transaction trends
   * @param {Array} transactions - User's financial transactions
   * @returns {string} - Formatted text summary
   */
  _createTransactionTrendsSummary(transactions) {
    if (!transactions || transactions.length === 0) return 'No transaction data available.';
    
    // Sort by date
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get income and expenses
    const income = transactions.filter(t => t.amount > 0);
    const expenses = transactions.filter(t => t.amount < 0);
    
    // Calculate totals
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Calculate averages
    const avgIncome = income.length > 0 ? totalIncome / income.length : 0;
    const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;
    
    // Get recent trends
    let recentMonthTotal = 0;
    let prevMonthTotal = 0;
    
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    
    const twoMonthsAgo = new Date(oneMonthAgo);
    twoMonthsAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      if (date >= oneMonthAgo) {
        recentMonthTotal += t.amount;
      } else if (date >= twoMonthsAgo && date < oneMonthAgo) {
        prevMonthTotal += t.amount;
      }
    });
    
    // Format the summary
    let summary = `Transaction Trends Summary:\n\n`;
    summary += `Total Transactions: ${transactions.length}\n`;
    summary += `Recent Transactions: ${sortedTransactions.slice(0, 5).length}\n\n`;
    
    summary += `Income Summary:\n`;
    summary += `- Total Income: $${totalIncome.toFixed(2)}\n`;
    summary += `- Average Income Transaction: $${avgIncome.toFixed(2)}\n\n`;
    
    summary += `Expense Summary:\n`;
    summary += `- Total Expenses: $${totalExpenses.toFixed(2)}\n`;
    summary += `- Average Expense: $${avgExpense.toFixed(2)}\n\n`;
    
    summary += `Monthly Comparison:\n`;
    summary += `- Current Month Net: $${recentMonthTotal.toFixed(2)}\n`;
    summary += `- Previous Month Net: $${prevMonthTotal.toFixed(2)}\n`;
    
    const monthlyChange = recentMonthTotal - prevMonthTotal;
    const changeDirection = monthlyChange > 0 ? 'increase' : 'decrease';
    summary += `- Month-over-Month ${changeDirection}: $${Math.abs(monthlyChange).toFixed(2)}\n`;
    
    return summary;
  }
  
  /**
   * Format transactions for a specific category
   * @param {string} category - Transaction category
   * @param {Array} transactions - Transactions in this category
   * @returns {string} - Formatted text
   */
  _formatCategoryTransactions(category, transactions) {
    if (!transactions || transactions.length === 0) return `No ${category} transactions available.`;
    
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgAmount = totalAmount / transactions.length;
    
    // Sort by date, most recent first
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let formatted = `${category} Transaction Analysis:\n\n`;
    formatted += `Total ${category} Transactions: ${transactions.length}\n`;
    formatted += `Total Spent in ${category}: $${totalAmount.toFixed(2)}\n`;
    formatted += `Average Transaction Amount: $${avgAmount.toFixed(2)}\n\n`;
    
    formatted += `Most Recent ${category} Transactions:\n`;
    sortedTransactions.slice(0, 5).forEach((t, i) => {
      formatted += `${i + 1}. ${new Date(t.date).toLocaleDateString()} - ${t.description}: $${Math.abs(t.amount).toFixed(2)}\n`;
    });
    
    return formatted;
  }
  
  /**
   * Format user profile information
   * @param {Object} profile - User profile object
   * @returns {string} - Formatted text
   */
  _formatUserProfile(profile) {
    let formatted = `User Profile Information:\n\n`;
    
    if (profile.name) formatted += `Name: ${profile.name}\n`;
    if (profile.email) formatted += `Email: ${profile.email}\n`;
    if (profile.age) formatted += `Age: ${profile.age}\n`;
    if (profile.occupation) formatted += `Occupation: ${profile.occupation}\n`;
    if (profile.riskTolerance) formatted += `Investment Risk Tolerance: ${profile.riskTolerance}\n`;
    
    if (profile.financialGoals && Array.isArray(profile.financialGoals)) {
      formatted += `\nFinancial Goals:\n`;
      profile.financialGoals.forEach((goal, i) => {
        formatted += `${i + 1}. Goal: ${goal.name}\n`;
        formatted += `   Type: ${goal.type}\n`;
        if (goal.targetAmount) formatted += `   Target Amount: $${goal.targetAmount.toFixed(2)}\n`;
        if (goal.targetDate) formatted += `   Target Date: ${new Date(goal.targetDate).toLocaleDateString()}\n`;
        if (goal.priority) formatted += `   Priority: ${goal.priority}\n`;
        formatted += `\n`;
      });
    }
    
    return formatted;
  }
  
  /**
   * Format spending patterns information
   * @param {Array} patterns - Spending patterns array
   * @returns {string} - Formatted text
   */
  _formatSpendingPatterns(patterns) {
    if (!patterns || patterns.length === 0) return 'No spending pattern data available.';
    
    let formatted = `Spending Patterns Analysis:\n\n`;
    
    patterns.forEach((pattern, i) => {
      formatted += `Pattern ${i + 1}: ${pattern.patternName}\n`;
      formatted += `Category: ${pattern.category}\n`;
      formatted += `Frequency: ${pattern.frequency}\n`;
      formatted += `Average Amount: $${pattern.averageAmount.toFixed(2)}\n`;
      if (pattern.confidence) formatted += `Confidence: ${(pattern.confidence * 100).toFixed(0)}%\n`;
      formatted += `Last Occurrence: ${new Date(pattern.lastOccurrence).toLocaleDateString()}\n`;
      formatted += `\n`;
    });
    
    return formatted;
  }
  
  /**
   * Create overall financial overview
   * @param {Object} financialData - Complete financial data object
   * @returns {string} - Formatted text summary
   */
  _createFinancialOverview(financialData) {
    // Calculate key metrics
    const totalBalance = this._calculateTotalBalance(financialData);
    const netWorth = this._calculateNetWorth(financialData);
    const monthlyIncome = this._calculateMonthlyIncome(financialData);
    const monthlyExpenses = this._calculateMonthlyExpenses(financialData);
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    // Format the overview
    let overview = `Financial Overview:\n\n`;
    
    overview += `Balance Summary:\n`;
    overview += `- Total Balance: $${totalBalance.toFixed(2)}\n`;
    overview += `- Net Worth: $${netWorth.toFixed(2)}\n\n`;
    
    overview += `Monthly Cash Flow:\n`;
    overview += `- Monthly Income: $${monthlyIncome.toFixed(2)}\n`;
    overview += `- Monthly Expenses: $${monthlyExpenses.toFixed(2)}\n`;
    overview += `- Net Monthly Savings: $${monthlySavings.toFixed(2)}\n`;
    overview += `- Savings Rate: ${savingsRate.toFixed(1)}%\n\n`;
    
    // Add account summary
    const accountCount = financialData.accounts ? financialData.accounts.length : 0;
    overview += `Accounts Summary:\n`;
    overview += `- Total Accounts: ${accountCount}\n`;
    if (financialData.accounts) {
      const accountTypes = {};
      financialData.accounts.forEach(acc => {
        accountTypes[acc.type] = (accountTypes[acc.type] || 0) + 1;
      });
      
      Object.entries(accountTypes).forEach(([type, count]) => {
        overview += `- ${type} Accounts: ${count}\n`;
      });
    }
    
    return overview;
  }
  
  /**
   * Calculate total balance across all accounts
   * @param {Object} financialData - Financial data
   * @returns {number} - Total balance
   */
  _calculateTotalBalance(financialData) {
    if (!financialData.accounts || !Array.isArray(financialData.accounts)) {
      return 0;
    }
    
    return financialData.accounts.reduce((sum, account) => {
      return sum + (account.balance || 0);
    }, 0);
  }
  
  /**
   * Calculate net worth (assets minus liabilities)
   * @param {Object} financialData - Financial data
   * @returns {number} - Net worth
   */
  _calculateNetWorth(financialData) {
    if (!financialData.accounts || !Array.isArray(financialData.accounts)) {
      return 0;
    }
    
    return financialData.accounts.reduce((sum, account) => {
      // Credit card balances are negative, so we adjust for that
      return account.type === 'Credit Card' 
        ? sum - Math.abs(account.balance || 0) 
        : sum + (account.balance || 0);
    }, 0);
  }
  
  /**
   * Calculate monthly income
   * @param {Object} financialData - Financial data
   * @returns {number} - Monthly income
   */
  _calculateMonthlyIncome(financialData) {
    if (!financialData.transactions || !Array.isArray(financialData.transactions)) {
      return 0;
    }
    
    // Filter for income transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    return financialData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }
  
  /**
   * Calculate monthly expenses
   * @param {Object} financialData - Financial data
   * @returns {number} - Monthly expenses
   */
  _calculateMonthlyExpenses(financialData) {
    if (!financialData.transactions || !Array.isArray(financialData.transactions)) {
      return 0;
    }
    
    // Filter for expense transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    return financialData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }
  
  /**
   * Get performance metrics for the RAG system
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    const cacheHitRate = this.metrics.totalQueries > 0 
      ? (this.metrics.cachedQueries / this.metrics.totalQueries) * 100 
      : 0;
    
    const apiCallRate = this.metrics.totalQueries > 0 
      ? (this.metrics.directApiCalls / this.metrics.totalQueries) * 100 
      : 0;
    
    return {
      totalQueries: this.metrics.totalQueries,
      cachedQueries: this.metrics.cachedQueries,
      directApiCalls: this.metrics.directApiCalls,
      cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
      apiCallRate: `${apiCallRate.toFixed(1)}%`,
      estimatedApiSavings: this.metrics.cachedQueries * 0.02, // Assuming $0.02 per API call
      timestamp: new Date().toISOString()
    };
  }
}

// Create a single instance and export it
const cohereRagService = new CohereRagService();

module.exports = cohereRagService;