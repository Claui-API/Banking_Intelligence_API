// src/services/banking-command.service.js
const nodeFetch = require('node-fetch');
// Set fetch as a global
global.fetch = nodeFetch;
// Import these classes from node-fetch
const { Headers, Request, Response } = nodeFetch;
// Set them as globals
global.Headers = Headers;
global.Request = Request;
global.Response = Response;

const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const BankUser = require('../models/BankUser');
const { Op } = require('sequelize');

/**
 * Rate-limited queue system for Gemini API calls
 */
class GeminiRateLimitedQueue {
	constructor() {
		// Gemini free tier limits: 15 requests per minute, 1500 requests per day
		this.maxRequestsPerMinute = 10; // Conservative limit
		this.maxRequestsPerDay = 1000; // Conservative daily limit
		this.requestQueue = [];
		this.requestHistory = [];
		this.isProcessing = false;
	}

	/**
	 * Add a request to the queue
	 * @param {Function} requestFn - Function that returns a Promise
	 * @param {string} requestId - Unique identifier for logging
	 * @returns {Promise} - Promise that resolves when the request completes
	 */
	async addRequest(requestFn, requestId) {
		return new Promise((resolve, reject) => {
			this.requestQueue.push({
				requestFn,
				requestId,
				resolve,
				reject,
				timestamp: Date.now()
			});

			// Start processing if not already running
			if (!this.isProcessing) {
				this.processQueue();
			}
		});
	}

	/**
	 * Process the request queue with rate limiting
	 * @private
	 */
	async processQueue() {
		if (this.isProcessing || this.requestQueue.length === 0) {
			return;
		}

		this.isProcessing = true;

		while (this.requestQueue.length > 0) {
			// Check if we can make a request
			if (!this.canMakeRequest()) {
				const waitTime = this.getWaitTime();
				logger.info(`Rate limit reached, waiting ${waitTime}ms`, {
					queueLength: this.requestQueue.length
				});
				await this._delay(waitTime);
				continue;
			}

			// Get the next request
			const request = this.requestQueue.shift();

			try {
				logger.info(`Processing request ${request.requestId}`, {
					queueLength: this.requestQueue.length
				});

				const result = await request.requestFn();
				this.recordRequest(true);
				request.resolve(result);

			} catch (error) {
				logger.error(`Request ${request.requestId} failed`, {
					error: error.message
				});
				this.recordRequest(false);
				request.reject(error);
			}

			// Add a small delay between requests to be extra safe
			if (this.requestQueue.length > 0) {
				await this._delay(500); // 500ms between requests
			}
		}

		this.isProcessing = false;
	}

	/**
	 * Check if we can make a request based on rate limits
	 * @returns {boolean} - True if we can make a request
	 * @private
	 */
	canMakeRequest() {
		const now = Date.now();
		const oneMinuteAgo = now - 60 * 1000;
		const oneDayAgo = now - 24 * 60 * 60 * 1000;

		// Clean up old history
		this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneDayAgo);

		// Count requests in the last minute
		const requestsLastMinute = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo).length;

		// Count requests in the last day
		const requestsLastDay = this.requestHistory.length;

		return requestsLastMinute < this.maxRequestsPerMinute && requestsLastDay < this.maxRequestsPerDay;
	}

	/**
	 * Calculate how long to wait before making the next request
	 * @returns {number} - Wait time in milliseconds
	 * @private
	 */
	getWaitTime() {
		const now = Date.now();
		const oneMinuteAgo = now - 60 * 1000;

		// Find the oldest request in the last minute
		const recentRequests = this.requestHistory
			.filter(req => req.timestamp > oneMinuteAgo)
			.sort((a, b) => a.timestamp - b.timestamp);

		if (recentRequests.length >= this.maxRequestsPerMinute) {
			// Wait until the oldest request is more than a minute old
			const oldestRequest = recentRequests[0];
			return (oldestRequest.timestamp + 60 * 1000) - now + 1000; // Add 1 second buffer
		}

		// Default wait time
		return 4000; // 4 seconds
	}

	/**
	 * Record a completed request
	 * @param {boolean} success - Whether the request was successful
	 * @private
	 */
	recordRequest(success) {
		this.requestHistory.push({
			timestamp: Date.now(),
			success
		});
	}

	/**
	 * Utility function to add delay
	 * @param {number} ms - Milliseconds to delay
	 * @returns {Promise} - Promise that resolves after delay
	 * @private
	 */
	_delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Get queue status for monitoring
	 * @returns {Object} - Queue status
	 */
	getStatus() {
		const now = Date.now();
		const oneMinuteAgo = now - 60 * 1000;
		const oneDayAgo = now - 24 * 60 * 60 * 1000;

		const requestsLastMinute = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo).length;
		const requestsLastDay = this.requestHistory.filter(req => req.timestamp > oneDayAgo).length;

		return {
			queueLength: this.requestQueue.length,
			isProcessing: this.isProcessing,
			requestsLastMinute: requestsLastMinute,
			maxRequestsPerMinute: this.maxRequestsPerMinute,
			requestsLastDay: requestsLastDay,
			maxRequestsPerDay: this.maxRequestsPerDay,
			canMakeRequest: this.canMakeRequest()
		};
	}
}

/**
 * Banking Intelligence Command Service
 * Generates comprehensive banking intelligence reports using transaction and account data
 */
class BankingCommandService {
	constructor() {
		this.apiKey = process.env.GEMINI_API_KEY;
		this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
		this.client = null;
		this.initialize();
		this.geminiQueue = new GeminiRateLimitedQueue();
	}

	/**
	 * Initialize Gemini client
	 */
	initialize() {
		if (!this.apiKey) {
			logger.warn('GEMINI_API_KEY not set. Banking Command service will not function.');
			return;
		}

		try {
			// Initialize using the correct constructor
			this.client = new GoogleGenAI({ apiKey: this.apiKey });
			logger.info('Banking Command service initialized successfully', {
				modelName: this.modelName
			});
		} catch (error) {
			logger.error('Failed to initialize Google GenAI client:', error);
		}
	}


	/**
	 * Generate a banking intelligence report
	 * @param {Object} params - Report parameters
	 * @returns {Promise<Object>} - Generated report
	 */
	async generateReport(params) {
		const {
			userId,
			timeframe = '30d',
			requestId = `cmd-${Date.now()}`,
			includeDetailed = true,
			format = 'json',
			statementData = null
		} = params;

		try {
			logger.info('Generating Banking Intelligence Command report', {
				userId,
				timeframe,
				requestId,
				includeDetailed,
				hasStatementData: !!statementData
			});

			// Step 1: Collect financial data
			let financialData = statementData
				? this._processStatementData(statementData)
				: await this._collectFinancialData(userId, timeframe);

			// Ensure all numeric fields are normalized
			financialData = this._normalizeNumericFields(financialData);

			// Step 2: Generate report sections
			const reportSections = await this._generateReportSections(financialData, requestId, includeDetailed);

			// Step 3: Compile final report
			const report = this._compileReport(reportSections, financialData, format);

			logger.info('Banking Intelligence Command report generated successfully', {
				userId,
				requestId,
				format,
				sectionCount: Object.keys(reportSections).length
			});

			return report;
		} catch (error) {
			logger.error('Error generating Banking Intelligence Command report', {
				userId,
				requestId,
				error: error.message,
				stack: error.stack
			});
			throw error;
		}
	}

	/**
	 * Process uploaded statement data
	 * @param {Object} statementData - Statement data
	 * @returns {Object} - Processed financial data
	 * @private
	 */
	_processStatementData(statementData) {
		// Process the statement data
		const processedData = {
			accounts: statementData.accounts || [],
			transactions: statementData.transactions || [],
			dateRange: statementData.dateRange || {
				startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
				endDate: new Date()
			},
			timeframe: statementData.timeframe || '30d',
			user: statementData.user || null
		};

		// Normalize numeric fields
		return this._normalizeNumericFields(processedData);
	}

	/**
 * Normalize numeric fields in financial data
 * @param {Object} data - Financial data object
 * @returns {Object} - Data with normalized numeric fields
 * @private
 */
	_normalizeNumericFields(data) {
		if (!data) return data;

		// Log initial state
		logger.debug('Normalizing numeric fields', {
			hasAccounts: !!data.accounts,
			accountCount: data.accounts?.length || 0,
			hasTransactions: !!data.transactions,
			transactionCount: data.transactions?.length || 0
		});

		// Normalize account numeric fields
		if (data.accounts && Array.isArray(data.accounts)) {
			data.accounts = data.accounts.map(account => {
				if (!account) return account;

				const plainAccount = account.dataValues ? account.dataValues : account;

				// Validate that required fields exist (they should after migration + model hooks)
				if (plainAccount.balance === null || plainAccount.balance === undefined) {
					logger.error('CRITICAL: Account has null balance despite migration/hooks', {
						accountId: plainAccount.accountId,
						bankUserId: plainAccount.bankUserId,
						clientId: plainAccount.clientId
					});
				}

				if (plainAccount.availableBalance === null || plainAccount.availableBalance === undefined) {
					logger.error('CRITICAL: Account has null availableBalance despite migration/hooks', {
						accountId: plainAccount.accountId,
						bankUserId: plainAccount.bankUserId,
						clientId: plainAccount.clientId
					});
				}

				// Convert to numbers with proper validation
				const balance = this._safeNumberConversion(plainAccount.balance, 'balance', plainAccount.accountId);
				const availableBalance = this._safeNumberConversion(plainAccount.availableBalance, 'availableBalance', plainAccount.accountId);
				const creditLimit = plainAccount.creditLimit !== null && plainAccount.creditLimit !== undefined
					? this._safeNumberConversion(plainAccount.creditLimit, 'creditLimit', plainAccount.accountId)
					: null;

				return {
					...plainAccount,
					balance,
					availableBalance,
					creditLimit
				};
			});
		}

		// Normalize transaction numeric fields
		if (data.transactions && Array.isArray(data.transactions)) {
			logger.info(`Normalizing ${data.transactions.length} transactions`);

			// Log sample before normalization
			if (data.transactions.length > 0) {
				const firstTx = data.transactions[0];
				const plainFirstTx = firstTx.dataValues ? firstTx.dataValues : firstTx;
				logger.debug('First transaction before normalization:', {
					category: plainFirstTx.category,
					merchantName: plainFirstTx.merchantName,
					amount: plainFirstTx.amount,
					type: typeof plainFirstTx.amount,
					description: plainFirstTx.description
				});
			}

			data.transactions = data.transactions.map((tx, index) => {
				if (!tx) return tx;

				// Handle Sequelize model instances
				const plainTx = tx.dataValues ? tx.dataValues : tx;

				// Safely convert amount
				const amount = this._safeNumberConversion(plainTx.amount, 'amount', `transaction-${index}`);

				// Safely handle date conversion
				const date = this._safeDateConversion(plainTx.date, `transaction-${index}`);

				// Create a new object preserving ALL fields
				const normalizedTx = {
					...plainTx,
					amount,
					date
				};

				// Log detailed info for first few transactions to verify fields are preserved
				if (index < 3 && (plainTx.category || plainTx.merchantName)) {
					logger.debug(`Normalized transaction ${index + 1} fields:`, {
						category: normalizedTx.category,
						merchantName: normalizedTx.merchantName,
						amount: normalizedTx.amount,
						hasCategory: !!normalizedTx.category,
						hasMerchant: !!normalizedTx.merchantName,
						description: normalizedTx.description
					});
				}

				return normalizedTx;
			});

			logger.info(`After normalization: ${data.transactions.length} transactions`);

			// Log sample after normalization
			if (data.transactions.length > 0) {
				const categories = [...new Set(data.transactions.map(t => t.category).filter(c => c))];
				const merchants = [...new Set(data.transactions.map(t => t.merchantName).filter(m => m))].slice(0, 5);

				logger.info('Post-normalization summary:', {
					transactionCount: data.transactions.length,
					uniqueCategories: categories.length,
					sampleCategories: categories.slice(0, 5),
					uniqueMerchants: merchants.length,
					sampleMerchants: merchants
				});
			}
		}

		return data;
	}

	/**
	 * Safely convert a value to a number with proper error handling
	 * @param {*} value - Value to convert
	 * @param {string} fieldName - Field name for logging
	 * @param {string} recordId - Record identifier for logging
	 * @returns {number} - Converted number
	 * @private
	 */
	_safeNumberConversion(value, fieldName, recordId) {
		// Handle null/undefined
		if (value === null || value === undefined) {
			logger.warn(`${fieldName} is null/undefined for ${recordId} - using 0`, {
				fieldName,
				recordId,
				originalValue: value
			});
			return 0;
		}

		// Already a number
		if (typeof value === 'number') {
			if (isNaN(value) || !isFinite(value)) {
				logger.warn(`${fieldName} is NaN or infinite for ${recordId} - using 0`, {
					fieldName,
					recordId,
					originalValue: value
				});
				return 0;
			}
			return value;
		}

		// Try to convert string to number
		if (typeof value === 'string') {
			const numValue = Number(value);
			if (isNaN(numValue) || !isFinite(numValue)) {
				logger.warn(`Could not convert ${fieldName} to number for ${recordId} - using 0`, {
					fieldName,
					recordId,
					originalValue: value
				});
				return 0;
			}
			return numValue;
		}

		// Other types
		logger.warn(`Unexpected type for ${fieldName} in ${recordId} - using 0`, {
			fieldName,
			recordId,
			originalValue: value,
			type: typeof value
		});
		return 0;
	}

	/**
	 * Safely convert a value to a Date with proper error handling
	 * @param {*} value - Value to convert
	 * @param {string} recordId - Record identifier for logging
	 * @returns {Date} - Converted date
	 * @private
	 */
	_safeDateConversion(value, recordId) {
		// Already a valid Date
		if (value instanceof Date) {
			if (!isNaN(value.getTime())) {
				return value;
			}
			logger.warn(`Invalid Date object for ${recordId} - using epoch`, {
				recordId,
				originalValue: value
			});
			return new Date(0); // Unix epoch instead of current time
		}

		// Try to parse string/number as date
		try {
			const date = new Date(value);
			if (!isNaN(date.getTime())) {
				return date;
			}
		} catch (error) {
			logger.warn(`Could not parse date for ${recordId}`, {
				recordId,
				originalValue: value,
				error: error.message
			});
		}

		// Use Unix epoch as fallback instead of current time
		// This makes it obvious that the date is wrong
		logger.warn(`Using epoch date for ${recordId} due to invalid date value`, {
			recordId,
			originalValue: value
		});
		return new Date(0);
	}

	async _collectFinancialData(userId, timeframe) {
		// Convert timeframe to date range
		const { startDate, endDate } = this._timeframeToDateRange(timeframe);

		try {
			// Fetch bank user
			const bankUser = await BankUser.findOne({
				where: { bankUserId: userId, status: 'active' }
			});

			if (!bankUser) {
				throw new Error(`User with ID ${userId} not found or not active`);
			}

			const clientId = bankUser.clientId;
			const bankUserId = bankUser.bankUserId;

			logger.info(`Collecting financial data for ${bankUserId} (client: ${clientId})`);

			// Fetch accounts for the user
			const accounts = await Account.findAll({
				where: {
					clientId,
					bankUserId,
					isActive: true
				}
			});

			// Log details of the first account to verify field structure and data types
			if (accounts.length > 0) {
				const sampleAccount = accounts[0];
				logger.info('Sample account data:', {
					accountId: sampleAccount.accountId,
					name: sampleAccount.name,
					type: sampleAccount.type,
					balance: sampleAccount.balance,
					balanceType: typeof sampleAccount.balance,
					availableBalance: sampleAccount.availableBalance,
					availableBalanceType: typeof sampleAccount.availableBalance,
					currency: sampleAccount.currency,
					isActive: sampleAccount.isActive
				});
			}

			// Get account IDs for transaction query
			const accountIds = accounts.map(account => account.accountId);
			logger.info(`Looking for transactions with account IDs: ${accountIds.join(', ')}`);

			// First, try to get properly categorized transactions
			let finalTransactions = await Transaction.findAll({
				where: {
					clientId,
					bankUserId,
					accountId: { [Op.in]: accountIds },
					date: {
						[Op.between]: [startDate, endDate]
					},
					category: {
						[Op.not]: null,
						[Op.ne]: 'Uncategorized'
					}
				},
				order: [['date', 'DESC']]
			});

			logger.info(`Found ${finalTransactions.length} categorized transactions`);

			// If we don't have enough categorized transactions, get all transactions
			if (finalTransactions.length < 10) {
				logger.info('Insufficient categorized transactions, fetching all transactions');

				// CRITICAL FIX: Remove 'let' to update the existing variable
				finalTransactions = await Transaction.findAll({
					where: {
						clientId,
						bankUserId,
						accountId: { [Op.in]: accountIds },
						date: {
							[Op.between]: [startDate, endDate]
						}
					},
					order: [['date', 'DESC']]
				});

				logger.info(`Found ${finalTransactions.length} transactions for user ${bankUserId}`, {
					clientId,
					bankUserId,
					transactionCount: finalTransactions.length,
					transactionSample: finalTransactions[0] ? {
						id: finalTransactions[0].id,
						date: finalTransactions[0].date,
						amount: finalTransactions[0].amount,
						category: finalTransactions[0].category,
						merchantName: finalTransactions[0].merchantName,
						description: finalTransactions[0].description
					} : 'No transactions found'
				});

				// Log what we're getting
				logger.info(`Retrieved ${finalTransactions.length} total transactions`, {
					sample: finalTransactions[0] ? {
						date: finalTransactions[0].date,
						category: finalTransactions[0].category,
						merchant: finalTransactions[0].merchantName,
						amount: finalTransactions[0].amount,
						description: finalTransactions[0].description
					} : null
				});
			}

			// Additional logging for debugging
			if (finalTransactions.length > 0) {
				// Get unique categories and merchants for logging
				const categories = [...new Set(finalTransactions.map(t => t.category).filter(c => c))];
				const merchants = [...new Set(finalTransactions.map(t => t.merchantName).filter(m => m))].slice(0, 5);

				logger.info('Transaction data summary:', {
					totalTransactions: finalTransactions.length,
					categories: categories.length > 0 ? categories : ['No categories found'],
					sampleMerchants: merchants.length > 0 ? merchants : ['No merchants found'],
					dateRange: {
						oldest: finalTransactions[finalTransactions.length - 1]?.date,
						newest: finalTransactions[0]?.date
					}
				});

				// Log first 3 transactions for detailed debugging
				logger.debug('First 3 transactions:',
					finalTransactions.slice(0, 3).map(tx => ({
						date: tx.date,
						amount: tx.amount,
						category: tx.category,
						merchant: tx.merchantName,
						description: tx.description
					}))
				);
			}

			// Compile the financial data
			const financialData = {
				user: bankUser,
				accounts,
				transactions: finalTransactions,
				dateRange: { startDate, endDate },
				timeframe
			};

			// Normalize numeric fields
			return this._normalizeNumericFields(financialData);

		} catch (error) {
			logger.error('Error collecting financial data', {
				userId,
				timeframe,
				error: error.message,
				stack: error.stack
			});
			throw error;
		}
	}

	/**
	 * Process sections in truly parallel batches with rate limiting
	 */
	async _processParallelBatch(tasks, sections, batchName, maxConcurrent = 3) {
		logger.info(`Processing ${batchName} sections in parallel`, {
			totalTasks: tasks.length,
			maxConcurrent
		});

		for (let i = 0; i < tasks.length; i += maxConcurrent) {
			const batch = tasks.slice(i, i + maxConcurrent);
			const batchStartTime = Date.now();

			// Execute batch in parallel
			const batchPromises = batch.map(async (task) => {
				try {
					const startTime = Date.now();
					const result = await task.generator();
					const duration = Date.now() - startTime;

					logger.info(`Section ${task.key} completed`, { duration });
					return { key: task.key, result };
				} catch (error) {
					logger.error(`Section ${task.key} failed`, { error: error.message });
					return {
						key: task.key,
						result: {
							title: this._getSectionTitle(task.key),
							content: `Unable to generate ${task.key} section due to API limitations.`,
							error: true
						}
					};
				}
			});

			const batchResults = await Promise.all(batchPromises);
			const batchDuration = Date.now() - batchStartTime;

			// Add results to sections
			batchResults.forEach(({ key, result }) => {
				sections[key] = result;
			});

			// OPTIMIZED DELAY: Only wait if we have more batches AND we're going too fast
			if (i + maxConcurrent < tasks.length) {
				// If this batch completed very quickly, we might need to slow down
				const minBatchTime = 4000; // Minimum 4 seconds between batches for rate limiting
				const waitTime = Math.max(0, minBatchTime - batchDuration);

				if (waitTime > 0) {
					logger.info(`Rate limiting: waiting ${waitTime}ms before next batch`);
					await this._delay(waitTime);
				} else {
					logger.info('No delay needed - proceeding to next batch immediately');
				}
			}
		}
	}

	/**
	 * Generate content using the rate-limited queue
	 * @param {string} prompt - The prompt to send to Gemini
	 * @param {string} requestId - Request ID for logging
	 * @param {string} queryType - Type of query for logging
	 * @returns {Promise<string>} - Generated text
	 * @private
	 */
	async _generateContent(prompt, requestId, queryType) {
		return await this._generateContentDirect(prompt, requestId, queryType);
	}

	/**
	 * Utility function to add delay
	 */
	_delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Get section title for fallback responses
	 */
	_getSectionTitle(sectionKey) {
		const titles = {
			accountSummary: 'Account Summary',
			behaviorPreferences: 'Behavior & Preferences (Frequency Signals)',
			merchantAnalysis: 'Merchant Concentration (Top Descriptors)',
			riskCompliance: 'Risk, Churn & Compliance',
			cadenceRoutines: 'Cadence & Routines',
			recurringSubscriptions: 'Recurring & Subscriptions',
			travelEvents: 'Travel & Events',
			backendRules: 'Appendix — Backend Rules, Triggers & Scoring'
		};
		return titles[sectionKey] || 'Analysis Section';
	}

	/**
	 * Generate content using Google's Gemini API
	 * @param {string} prompt - The prompt to send to Gemini
	 * @param {string} requestId - Request ID for logging
	 * @param {string} queryType - Type of query for logging
	 * @returns {Promise<string>} - Generated text
	 * @private
	 */
	async _generateContentDirect(prompt, requestId, queryType) {
		if (!this.client) {
			this.initialize();
			if (!this.client) {
				logger.warn('Google GenAI client not available, returning fallback response');
				return `Banking intelligence analysis could not be generated. Please try again later.`;
			}
		}

		try {
			logger.info('Generating content with Google GenAI', {
				modelName: this.modelName,
				requestId,
				queryType
			});

			// Configure generation settings - lower temperature for more consistency
			const generationConfig = {
				temperature: 0.1, // Reduced from 0.3 to make output more deterministic
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 800
			};

			// Adjust settings based on query type
			if (queryType === 'education') {
				generationConfig.temperature = 0.1;
				generationConfig.maxOutputTokens = 1500;
			} else if (queryType === 'risk') {
				generationConfig.temperature = 0.1;
			} else if (queryType === 'spending') {
				generationConfig.temperature = 0.1; // Reduced specifically for spending analysis
				generationConfig.maxOutputTokens = 1000;
			} else if (queryType === 'transactions') {
				generationConfig.temperature = 0.1; // Reduced for transaction analysis
			}

			// Define the grounding tool
			const groundingTool = {
				googleSearch: {}
			};

			// Configure request
			const config = {
				tools: [groundingTool]
			};

			// Enhanced system instruction that emphasizes using specific entity names
			const enhancedSystemInstruction = `You are a banking intelligence analysis system. Provide clear, concise financial insights based on transaction and account data. CRITICALLY IMPORTANT: When provided with specific merchants, categories, or other entities in the prompt, you MUST reference those EXACT entities in your analysis rather than using generic examples. NEVER use generic placeholder merchants or categories. ALWAYS use the specific merchant names, transaction categories, and numerical data provided in the prompt. Be informative and data-driven, focusing on patterns, risks, and actionable recommendations.`;

			// Generate content using the correct API structure
			const response = await this.client.models.generateContent({
				model: this.modelName,
				contents: [
					{
						role: "user",
						parts: [{ text: prompt }]
					}
				],
				generationConfig: generationConfig,
				systemInstruction: enhancedSystemInstruction,
				config,
			});

			// Extract generated text
			let generatedText = '';

			if (response && response.text) {
				generatedText = response.text;
			} else if (response && response.response && response.response.text) {
				generatedText = response.response.text;
			} else if (response && response.response && response.response.candidates &&
				response.response.candidates.length > 0 &&
				response.response.candidates[0].content &&
				response.response.candidates[0].content.parts &&
				response.response.candidates[0].content.parts.length > 0) {
				generatedText = response.response.candidates[0].content.parts[0].text || '';
			}

			if (generatedText) {
				logger.info('Google GenAI response received', {
					requestId,
					responseLength: generatedText.length,
					model: this.modelName
				});

				return generatedText;
			} else {
				logger.warn('Empty response from Google GenAI API, returning fallback', {
					requestId
				});
				return `Banking intelligence analysis could not be generated. Please try again later.`;
			}
		} catch (error) {
			logger.error('Error generating content with Google GenAI:', {
				errorMessage: error.message,
				errorName: error.name,
				errorStack: error.stack,
				requestId
			});

			// Return fallback response when API fails
			return `Banking intelligence analysis could not be generated. Error: ${error.message}`;
		}
	}

	/**
	 * Generate report sections using Gemini
	 * @param {Object} financialData - Financial data
	 * @param {string} requestId - Request ID
	 * @param {boolean} includeDetailed - Whether to include detailed sections
	 * @returns {Promise<Object>} - Report sections
	 * @private
	 */
	async _generateReportSections(financialData, requestId, includeDetailed) {
		const financialContext = this._createFinancialContext(financialData);

		// Define all section tasks
		const sectionTasks = [
			{
				key: 'accountSummary',
				priority: 1,
				generator: () => this._generateAccountSummary(financialData, financialContext, requestId)
			},
			{
				key: 'behaviorPreferences',
				priority: 1,
				generator: () => this._generateBehaviorPreferences(financialData, [], requestId)
			},
			{
				key: 'merchantAnalysis',
				priority: 1,
				generator: () => this._generateMerchantAnalysis(financialData, [], requestId)
			},
			{
				key: 'riskCompliance',
				priority: 1,
				generator: () => this._generateRiskCompliance(financialData, financialContext, requestId)
			}
		];

		// Add detailed sections if requested
		if (includeDetailed) {
			sectionTasks.push(
				{
					key: 'cadenceRoutines',
					priority: 2,
					generator: () => this._generateCadenceRoutines(financialData, financialContext, requestId)
				},
				{
					key: 'recurringSubscriptions',
					priority: 2,
					generator: () => this._generateRecurringSubscriptions(financialData, financialContext, requestId)
				},
				{
					key: 'travelEvents',
					priority: 2,
					generator: () => this._generateTravelEvents(financialData, financialContext, requestId)
				},
				{
					key: 'backendRules',
					priority: 2,
					generator: () => this._generateBackendRules(financialData, financialContext, requestId)
				}
			);
		}

		// Group by priority for smart batching
		const priority1Tasks = sectionTasks.filter(task => task.priority === 1);
		const priority2Tasks = sectionTasks.filter(task => task.priority === 2);

		const sections = {};

		try {
			// Process Priority 1 sections in true parallel batches
			await this._processParallelBatch(priority1Tasks, sections, 'Priority 1', 3); // Max 3 concurrent

			// Small delay between priority groups
			if (priority2Tasks.length > 0) {
				await this._delay(2000);
				await this._processParallelBatch(priority2Tasks, sections, 'Priority 2', 2); // Max 2 concurrent
			}

			logger.info('All report sections generated successfully', {
				sectionsGenerated: Object.keys(sections).length,
				requestId
			});

			return sections;

		} catch (error) {
			logger.error('Error in parallel section generation', {
				error: error.message,
				sectionsCompleted: Object.keys(sections),
				requestId
			});
			throw error;
		}
	}

	/**
	 * Generate Account Summary section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateAccountSummary(data, financialContext, requestId) {
		// Calculate basic metrics
		const accounts = data.accounts || [];
		const transactions = data.transactions || [];

		// Calculate total balances
		const totalBalance = accounts.reduce((sum, account) => {
			const balance = typeof account.balance === 'number' ? account.balance : Number(account.balance || 0);
			return sum + balance;
		}, 0);

		// Calculate income and expenses
		const income = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount > 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + amount;
			}, 0);

		const expenses = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);

		// Calculate net change
		const netChange = income - expenses;

		// Calculate date range in days
		const startDate = data.dateRange.startDate;
		const endDate = data.dateRange.endDate;
		const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 30;

		// Calculate average daily spend
		const averageDailySpend = expenses / daysInPeriod;

		// Create prompt with explicit few-shot example
		const prompt = `
      Generate a professional Banking Intelligence 'Account Summary' analysis section based on this data:
      
      Total Balance: $${totalBalance.toFixed(2)}
      Income: $${income.toFixed(2)}
      Expenses: $${expenses.toFixed(2)}
      Net Change: $${netChange.toFixed(2)}
      Time Period: ${daysInPeriod} days
      Average Daily Spend: $${averageDailySpend.toFixed(2)}/day
      
      Format your response with an Observation, Logic, and Bank Actions sections, similar to this example:
      "Observation: End-of-cycle liquidity fell to $301.04 from $10,766.75; net −$10,465.71. Monthly outflows ≈ $25,099.59.
      Logic: Low residual balances with high discretionary activity elevates short-term liquidity risk and churn propensity if external wallets/cards provide smoother buffers.
      Bank Actions:
      1 Proactively enable overdraft protection with soft-limit alerts (e.g., 70% utilization).
      2 Offer small revolving LOC (e.g., $1,500–$5,000) with auto-repayment from next deposits.
      3 Weekly savings 'sweep-back' rule: move surplus above a dynamic floor (2× avg daily spend)."
      
      Your response MUST include the exact financial values provided to you ($${totalBalance.toFixed(2)}, $${income.toFixed(2)}, $${expenses.toFixed(2)}, $${netChange.toFixed(2)}, ${daysInPeriod} days, $${averageDailySpend.toFixed(2)}/day).
      
      Tone should be analytical, data-driven, and geared toward financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-account-summary`,
				'banking'
			);

			// Return formatted section
			return {
				title: 'Account Summary',
				content,
				metrics: {
					totalBalance,
					income,
					expenses,
					netChange,
					averageDailySpend,
					daysInPeriod
				}
			};
		} catch (error) {
			logger.error('Error generating Account Summary section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Account Summary',
				content: `Observation: Account has a total balance of $${totalBalance.toFixed(2)} with net change of $${netChange.toFixed(2)} over ${daysInPeriod} days. Average daily spend is $${averageDailySpend.toFixed(2)}.`,
				metrics: {
					totalBalance,
					income,
					expenses,
					netChange,
					averageDailySpend,
					daysInPeriod
				}
			};
		}
	}

	/**
 * Generate Behavior & Preferences section with improved entity inclusion
 * @param {Object} data - Financial data
 * @param {Array} topCategories - Top categories
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} - Generated section
 * @private
 */
	async _generateBehaviorPreferences(data, topCategories, requestId) {
		const transactions = data.transactions || [];

		// Enhanced input data logging
		logger.info('Behavior Preferences - Input data check:', {
			transactionCount: transactions.length,
			firstThreeTransactions: transactions.slice(0, 3).map(tx => ({
				category: tx.category,
				merchant: tx.merchantName,
				amount: tx.amount,
				description: tx.description
			})),
			hasCategories: transactions.some(tx => tx.category && tx.category !== 'Uncategorized'),
			hasMerchants: transactions.some(tx => tx.merchantName && tx.merchantName !== 'Unknown')
		});

		// Get ALL transactions for complete visibility
		const allTransactionDetails = transactions.slice(0, 10).map(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			const type = amount > 0 ? 'Income' : amount < 0 ? 'Expense' : 'Transfer';

			// Ensure date is valid before formatting
			let dateStr = 'Invalid Date';
			try {
				const txDate = new Date(tx.date);
				if (!isNaN(txDate.getTime())) {
					dateStr = txDate.toLocaleDateString();
				}
			} catch (e) {
				logger.warn('Date parsing error for transaction', { date: tx.date });
			}

			return `  - Date: ${dateStr}, Amount: $${Math.abs(amount).toFixed(2)}, Type: ${type}, Category: ${tx.category || 'Uncategorized'}, Merchant: ${tx.merchantName || 'Unknown'}, Description: ${tx.description || 'N/A'}`;
		}).join('\n');

		// Get only expense transactions
		const expenseTransactions = transactions.filter(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			return amount < 0;
		});

		// Log what we're finding
		logger.info('Behavior analysis data:', {
			totalTransactions: transactions.length,
			expenseTransactions: expenseTransactions.length,
			expenseSample: expenseTransactions.slice(0, 3).map(tx => ({
				amount: tx.amount,
				category: tx.category,
				merchant: tx.merchantName
			}))
		});

		// If we have real expense data with categories, use it directly
		if (expenseTransactions.length > 0) {
			const realCategories = {};
			expenseTransactions.forEach(tx => {
				const category = tx.category || 'Uncategorized';
				const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0));

				if (!realCategories[category]) {
					realCategories[category] = {
						count: 0,
						total: 0,
						merchants: []
					};
				}

				realCategories[category].count++;
				realCategories[category].total += amount;
				if (tx.merchantName && !realCategories[category].merchants.includes(tx.merchantName)) {
					realCategories[category].merchants.push(tx.merchantName);
				}
			});

			// Log the categories we found
			logger.info('Categories found for behavior analysis:', {
				categories: Object.keys(realCategories),
				categoryDetails: Object.entries(realCategories).map(([name, data]) => ({
					name,
					count: data.count,
					total: data.total,
					merchants: data.merchants
				}))
			});

			// Format the real category data
			const realCategoriesText = Object.entries(realCategories).map(([name, data]) => {
				const percent = (data.count / expenseTransactions.length) * 100;
				let text = `- ${name}: ${data.count} transactions, $${data.total.toFixed(2)} (${percent.toFixed(1)}%)`;
				if (data.merchants.length > 0) {
					text += `\n  Merchants: ${data.merchants.join(', ')}`;
				}
				return text;
			}).join('\n');

			// Rest of the function remains the same...
			const prompt = `
Generate a professional Banking Intelligence 'Behavior & Preferences' analysis based on this ACTUAL transaction data:

ALL TRANSACTIONS IN THE DATASET:
${allTransactionDetails}

EXPENSE CATEGORIES BREAKDOWN (from actual data):
${realCategoriesText}

CRITICAL REQUIREMENTS:
1. You MUST analyze the EXACT categories and merchants shown in the data above
2. If you see "Food & Dining" with "Whole Foods" and "Fine Dining Restaurant", discuss THESE SPECIFIC entities
3. DO NOT say everything is "Uncategorized" if the data shows specific categories
4. DO NOT say merchants are "Unknown" if specific merchant names are provided

Provide a professional analysis that:
- References the specific categories from the data (e.g., "Food & Dining" if present)
- Mentions the actual merchants by name (e.g., "Whole Foods", "Fine Dining Restaurant")
- Assesses elasticity for each real category found
- Avoids generic placeholders or examples not in the data

Tone should be analytical, data-driven, and geared toward financial professionals.
`;

			try {
				const content = await this._generateContent(
					prompt,
					`${requestId}-behavior`,
					'spending'
				);

				return {
					title: 'Behavior & Preferences (Frequency Signals)',
					content,
					categories: Object.entries(realCategories).map(([name, data]) => ({
						name,
						count: data.count,
						total: data.total,
						percent: (data.count / expenseTransactions.length) * 100
					}))
				};
			} catch (error) {
				logger.error('Error generating Behavior & Preferences section', {
					requestId,
					error: error.message
				});

				return {
					title: 'Behavior & Preferences (Frequency Signals)',
					content: `Based on actual transaction data:\n\n${realCategoriesText}`,
					categories: []
				};
			}
		}

		// Fallback if no expense transactions
		return {
			title: 'Behavior & Preferences (Frequency Signals)',
			content: 'No expense transactions found in the dataset for behavior analysis.',
			categories: []
		};
	}

	/**
 * Generate Merchant Analysis section with improved entity inclusion
 * @param {Object} data - Financial data
 * @param {Array} topMerchants - Top merchants (can be empty array now)
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} - Generated section
 * @private
 */
	async _generateMerchantAnalysis(data, topMerchants, requestId) {
		const transactions = data.transactions || [];

		// Get ALL transactions for complete visibility
		const allTransactionDetails = transactions.slice(0, 10).map(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			const type = amount > 0 ? 'Income' : amount < 0 ? 'Expense' : 'Transfer';
			return `  - ${tx.merchantName || 'N/A'}: $${Math.abs(amount).toFixed(2)}, Type: ${type}, Category: ${tx.category || 'Uncategorized'}, Date: ${new Date(tx.date).toLocaleDateString()}`;
		}).join('\n');

		// Get only expense transactions
		const expenseTransactions = transactions.filter(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			return amount < 0;
		});

		// Log what we're finding
		logger.info('Merchant analysis data:', {
			totalTransactions: transactions.length,
			expenseTransactions: expenseTransactions.length,
			expenseSample: expenseTransactions.slice(0, 3).map(tx => ({
				amount: tx.amount,
				merchant: tx.merchantName,
				category: tx.category
			}))
		});

		// Process merchant data directly from transactions
		if (expenseTransactions.length > 0) {
			const realMerchants = {};

			expenseTransactions.forEach(tx => {
				const merchant = tx.merchantName || 'Unknown';
				const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0));

				if (!realMerchants[merchant]) {
					realMerchants[merchant] = {
						count: 0,
						total: 0,
						categories: [],
						dates: []
					};
				}

				realMerchants[merchant].count++;
				realMerchants[merchant].total += amount;

				const category = tx.category || 'Uncategorized';
				if (!realMerchants[merchant].categories.includes(category)) {
					realMerchants[merchant].categories.push(category);
				}

				realMerchants[merchant].dates.push(new Date(tx.date).toLocaleDateString());
			});

			// Format the real merchant data
			const realMerchantsText = Object.entries(realMerchants)
				.sort(([, a], [, b]) => b.total - a.total) // Sort by total amount
				.map(([name, data]) => {
					let text = `- ${name}: ${data.count} transaction${data.count > 1 ? 's' : ''}, $${data.total.toFixed(2)}`;
					if (data.categories.length > 0) {
						text += `\n  Categories: ${data.categories.join(', ')}`;
					}
					if (data.dates.length <= 3) {
						text += `\n  Dates: ${data.dates.join(', ')}`;
					}
					return text;
				}).join('\n');

			// Create the prompt with actual data
			const prompt = `
Generate a professional Banking Intelligence 'Merchant Concentration' analysis based on this ACTUAL transaction data:

ALL TRANSACTIONS IN THE DATASET:
${allTransactionDetails}

EXPENSE MERCHANTS BREAKDOWN (from actual data):
${realMerchantsText}

CRITICAL REQUIREMENTS:
1. You MUST analyze the EXACT merchants shown in the data above
2. If you see "Whole Foods", "Fine Dining Restaurant", etc., discuss THESE SPECIFIC merchants
3. DO NOT say merchants are "Unknown" if specific merchant names are provided in the data
4. DO NOT use generic examples - only discuss the merchants actually present in the data

Format your response as:
"**Merchant Concentration Analysis: Specific Spending Patterns**

Analysis of customer spending with specific merchants:

* [Use actual merchant names from the data above]
* [Provide insights based on the actual spending patterns shown]

[Summary of what these specific merchant patterns reveal about the customer]"

Tone should be analytical, data-driven, and geared toward financial professionals.
`;

			try {
				const content = await this._generateContent(
					prompt,
					`${requestId}-merchants`,
					'transactions'
				);

				return {
					title: 'Merchant Concentration (Top Descriptors)',
					content,
					merchants: Object.entries(realMerchants)
						.sort(([, a], [, b]) => b.total - a.total)
						.slice(0, 5)
						.map(([name, data]) => ({
							name,
							count: data.count,
							total: data.total
						}))
				};
			} catch (error) {
				logger.error('Error generating Merchant Analysis section', {
					requestId,
					error: error.message
				});

				return {
					title: 'Merchant Concentration (Top Descriptors)',
					content: `Based on actual transaction data:\n\n${realMerchantsText}`,
					merchants: []
				};
			}
		}

		// Fallback if no expense transactions
		return {
			title: 'Merchant Concentration (Top Descriptors)',
			content: 'No expense transactions found in the dataset for merchant analysis.',
			merchants: []
		};
	}

	/**
	 * Generate Risk & Compliance section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateRiskCompliance(data, financialContext, requestId) {
		// Analyze accounts and transactions for risk factors
		const accounts = data.accounts || [];
		const transactions = data.transactions || [];

		// Calculate total balance
		const totalBalance = accounts.reduce((sum, account) => {
			const balance = typeof account.balance === 'number' ? account.balance : Number(account.balance || 0);
			return sum + balance;
		}, 0);

		// Calculate expenses
		const expenses = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);

		// Calculate date range in days
		const startDate = data.dateRange.startDate;
		const endDate = data.dateRange.endDate;
		const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 30;

		// Calculate average daily spend
		const averageDailySpend = expenses / daysInPeriod;

		// Calculate days of runway (how long balance will last at current spend rate)
		const daysOfRunway = averageDailySpend > 0 ? totalBalance / averageDailySpend : 999;

		// Identify potential risk factors
		const risks = [];

		// Check for liquidity risk
		if (daysOfRunway < 30) {
			risks.push({
				type: 'liquidity',
				severity: daysOfRunway < 14 ? 'high' : 'medium',
				description: `Low balance relative to spending rate (${daysOfRunway.toFixed(1)} days of runway)`
			});
		}

		// Check for gambling transactions
		const gamblingKeywords = ['CASINO', 'POKER', 'BETTING', 'GAMBLE', 'DRAFTKINGS', 'FANDUEL'];
		const gamblingTransactions = transactions.filter(tx => {
			return gamblingKeywords.some(keyword =>
				(tx.description || '').toUpperCase().includes(keyword)
			);
		});

		if (gamblingTransactions.length > 0) {
			const gamblingTotal = gamblingTransactions.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);
			const gamblingPercentage = expenses > 0 ? (gamblingTotal / expenses) * 100 : 0;

			if (gamblingPercentage > 10) {
				risks.push({
					type: 'gambling',
					severity: gamblingPercentage > 25 ? 'high' : 'medium',
					description: `High gambling activity (${gamblingPercentage.toFixed(1)}% of expenses)`
				});
			}
		}

		// Format risks for prompt
		const risksText = risks.length > 0
			? risks.map(r => `- ${r.type}: ${r.description}, severity: ${r.severity}`).join('\n')
			: '- No significant risks detected';

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Risk, Churn & Compliance' analysis section based on this data:
      
      Balance Information:
      - Total balance: $${totalBalance.toFixed(2)}
      - Average daily spend: $${averageDailySpend.toFixed(2)}/day
      - Days of runway: ${daysOfRunway.toFixed(1)} days
      
      Risk Information:
      ${risksText}
      
      Format your response with Observation, Logic, and Bank Actions sections, as in this example:
      "Observation: Low residual balances; high discretionary outflows; cross-state activity.
      Logic: Elevated churn risk if competing fintechs offer superior rewards/overdraft UX; AML watch due to rapid gambling movements.
      Bank Actions:
      1 Retention stack: auto-enroll in overdraft grace; boost rewards on top-3 categories next 60 days.
      2 Churn trigger: if end-bal < 1.2× avg daily spend for 2 consecutive cycles, launch save-offer.
      3 AML: rule to review when gambling debits > 40% of 'Other subtractions' or 25% of total outflows."
      
      Your response MUST include the exact financial values provided to you ($${totalBalance.toFixed(2)}, $${averageDailySpend.toFixed(2)}/day, ${daysOfRunway.toFixed(1)} days).
      
      Tone should be analytical, data-driven, and focused on risk mitigation strategies for financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-risk`,
				'risk'
			);

			// Return formatted section
			return {
				title: 'Risk, Churn & Compliance',
				content,
				risks: risks,
				hasCriticalRisks: risks.some(r => r.severity === 'high'),
				riskCount: risks.length
			};
		} catch (error) {
			logger.error('Error generating Risk & Compliance section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Risk, Churn & Compliance',
				content: `Observation: Account has ${risks.length > 0 ? 'several risk factors' : 'no significant risks'} with ${daysOfRunway.toFixed(1)} days of runway based on current spending patterns.`,
				risks: risks,
				hasCriticalRisks: risks.some(r => r.severity === 'high'),
				riskCount: risks.length
			};
		}
	}

	/**
	 * Generate Cadence & Routines section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateCadenceRoutines(data, financialContext, requestId) {
		// Analyze transaction patterns by day of week and time of day
		const transactions = data.transactions || [];

		// Skip if not enough transactions
		if (transactions.length < 5) {
			return {
				title: 'Cadence & Routines',
				content: 'Insufficient transaction data to analyze spending patterns.',
				data: { weekday: 0, weekend: 0 }
			};
		}

		// Initialize counters
		let weekdayCount = 0;
		let weekendCount = 0;
		let morningCount = 0;
		let afternoonCount = 0;
		let eveningCount = 0;

		// Analyze transactions
		transactions.forEach(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			if (amount < 0) { // Only count expenses
				try {
					const date = new Date(tx.date);
					const day = date.getDay(); // 0 = Sunday, 6 = Saturday
					const hour = date.getHours();

					// Day of week
					if (day === 0 || day === 6) {
						weekendCount++;
					} else {
						weekdayCount++;
					}

					// Time of day
					if (hour >= 5 && hour < 12) {
						morningCount++;
					} else if (hour >= 12 && hour < 18) {
						afternoonCount++;
					} else {
						eveningCount++;
					}
				} catch (e) {
					// Skip if date parsing fails
				}
			}
		});

		// Calculate percentages
		const totalCount = weekdayCount + weekendCount;
		const weekdayPercent = totalCount > 0 ? (weekdayCount / totalCount) * 100 : 0;
		const weekendPercent = totalCount > 0 ? (weekendCount / totalCount) * 100 : 0;

		const totalTimeCount = morningCount + afternoonCount + eveningCount;
		const morningPercent = totalTimeCount > 0 ? (morningCount / totalTimeCount) * 100 : 0;
		const afternoonPercent = totalTimeCount > 0 ? (afternoonCount / totalTimeCount) * 100 : 0;
		const eveningPercent = totalTimeCount > 0 ? (eveningCount / totalTimeCount) * 100 : 0;

		// Format data for prompt
		const cadenceText = `
      Weekday vs Weekend:
      - Weekday: ${weekdayCount} transactions (${weekdayPercent.toFixed(1)}%)
      - Weekend: ${weekendCount} transactions (${weekendPercent.toFixed(1)}%)
      
      Time of Day:
      - Morning (5am-12pm): ${morningCount} transactions (${morningPercent.toFixed(1)}%)
      - Afternoon (12pm-6pm): ${afternoonCount} transactions (${afternoonPercent.toFixed(1)}%)
      - Evening/Night (6pm-5am): ${eveningCount} transactions (${eveningPercent.toFixed(1)}%)
    `;

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Cadence & Routines' analysis section based on this spending pattern data:
      
      ${cadenceText}
      
      Format your response with an observed pattern and implications, as in this example:
      "Observed pattern: clustered spend around travel/event windows; consistent small-ticket activity (coffee, transit) during non-travel days.
      Implications: Daily anchors (inelastic categories) support reliable rewards hooks; travel/event clusters suitable for seasonal or pre-trip limit increases and insurance cross-sell."
      
      Your response MUST include the exact percentage values provided to you (Weekday: ${weekdayPercent.toFixed(1)}%, Weekend: ${weekendPercent.toFixed(1)}%, Morning: ${morningPercent.toFixed(1)}%, Afternoon: ${afternoonPercent.toFixed(1)}%, Evening: ${eveningPercent.toFixed(1)}%).
      
      Tone should be analytical, data-driven, and focused on actionable insights for financial marketing professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-cadence`,
				'spending'
			);

			// Return formatted section
			return {
				title: 'Cadence & Routines',
				content,
				data: {
					weekday: weekdayPercent,
					weekend: weekendPercent,
					morning: morningPercent,
					afternoon: afternoonPercent,
					evening: eveningPercent
				}
			};
		} catch (error) {
			logger.error('Error generating Cadence & Routines section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Cadence & Routines',
				content: `Observed pattern: ${weekdayPercent > weekendPercent ? 'Primarily weekday' : 'Balanced weekday/weekend'} spending with highest activity during the ${morningPercent > afternoonPercent && morningPercent > eveningPercent ? 'morning' :
					afternoonPercent > morningPercent && afternoonPercent > eveningPercent ? 'afternoon' : 'evening'
					} hours.`,
				data: {
					weekday: weekdayPercent,
					weekend: weekendPercent,
					morning: morningPercent,
					afternoon: afternoonPercent,
					evening: eveningPercent
				}
			};
		}
	}

	/**
	 * Generate Recurring & Subscriptions section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateRecurringSubscriptions(data, financialContext, requestId) {
		// Find potential subscriptions and recurring payments
		const transactions = data.transactions || [];

		// Skip if not enough transactions
		if (transactions.length < 5) {
			return {
				title: 'Recurring & Subscriptions',
				content: 'Insufficient transaction data to identify recurring patterns.',
				subscriptions: []
			};
		}

		// Common subscription services
		const subscriptionKeywords = [
			'NETFLIX', 'SPOTIFY', 'APPLE', 'AMAZON', 'PRIME', 'HBO', 'DISNEY',
			'HULU', 'YOUTUBE', 'SUBSCRIPTION', 'MONTHLY', 'ANNUAL'
		];

		// Find potential subscriptions
		const subscriptions = [];
		const merchantMap = new Map();

		// Group transactions by merchant
		transactions.forEach(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			if (amount < 0) { // Only expenses
				const merchant = tx.merchantName || this._extractMerchantName(tx.description) || 'Unknown';

				if (!merchantMap.has(merchant)) {
					merchantMap.set(merchant, []);
				}

				merchantMap.get(merchant).push({
					date: new Date(tx.date),
					amount: Math.abs(amount)
				});
			}
		});

		// Analyze each merchant's transactions
		merchantMap.forEach((txList, merchant) => {
			// Skip if fewer than 2 transactions
			if (txList.length < 2) return;

			// Sort by date
			txList.sort((a, b) => a.date - b.date);

			// Check if amounts are consistent (subscription-like)
			const amounts = txList.map(t => t.amount);
			const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
			const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avgAmount) / avgAmount));

			// Check if it's a known subscription service
			const isKnownSubscription = subscriptionKeywords.some(keyword =>
				merchant.toUpperCase().includes(keyword)
			);

			// If amounts are consistent (less than 10% variation) or it's a known service
			if (maxDeviation < 0.1 || isKnownSubscription) {
				subscriptions.push({
					merchant,
					averageAmount: avgAmount,
					frequency: txList.length > 2 ? 'monthly' : 'periodic',
					lastDate: txList[txList.length - 1].date,
					count: txList.length,
					type: maxDeviation < 0.1 ? 'subscription' : 'recurring'
				});
			}
		});

		// Sort subscriptions by average amount
		subscriptions.sort((a, b) => b.averageAmount - a.averageAmount);

		// Format subscriptions for prompt
		const subscriptionsText = subscriptions.length > 0
			? subscriptions.map(s => `- ${s.merchant} (${s.frequency}, avg $${s.averageAmount.toFixed(2)})`).join('\n')
			: '- No clear subscription patterns detected';

		// Identify tech/utility subscriptions
		const techKeywords = ['APPLE', 'GOOGLE', 'AMAZON', 'MICROSOFT', 'ADOBE', 'GITHUB', 'AWS', 'CLOUD', 'HOSTING', 'DOMAIN'];
		const techSubscriptions = subscriptions.filter(s =>
			techKeywords.some(keyword => s.merchant.toUpperCase().includes(keyword))
		);

		const techText = techSubscriptions.length > 0
			? `Detected tech/utility merchants: ${techSubscriptions.map(s => s.merchant).join(', ')}.`
			: 'No tech/utility subscription merchants detected.';

		// Create prompt with requirement to include actual merchant names
		const prompt = `
      Generate a professional Banking Intelligence 'Recurring & Subscriptions' analysis section based on this data:
      
      ${subscriptionsText}
      
      ${techText}
      
      Format your response with detected merchants and a signal analysis, as in this example:
      "Detected recurring tech/utility merchants: Apple.com/Bill, GoDaddy, AWS (Amazon Web Services).
      Signal: tech-forward user with entrepreneurial patterns (domain + cloud + app store). Fit for business/creator bundles, bookkeeping add-ons, and SaaS-linked credit."
      
      If no clear subscription patterns are detected, analyze what this absence might indicate about the customer's financial behavior.
      
      You MUST include all merchant names if any are detected. Be specific and avoid generic references.
      
      Tone should be analytical, data-driven, and focused on product recommendation opportunities for financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-subscriptions`,
				'subscriptions'
			);

			// Return formatted section
			return {
				title: 'Recurring & Subscriptions',
				content,
				subscriptions: subscriptions,
				techSubscriptions: techSubscriptions
			};
		} catch (error) {
			logger.error('Error generating Recurring & Subscriptions section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Recurring & Subscriptions',
				content: techText,
				subscriptions: subscriptions,
				techSubscriptions: techSubscriptions
			};
		}
	}

	/**
	 * Generate Travel & Events section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateTravelEvents(data, financialContext, requestId) {
		// Analyze transactions for travel patterns
		const transactions = data.transactions || [];

		// Skip if not enough transactions
		if (transactions.length < 5) {
			return {
				title: 'Travel & Events',
				content: 'Insufficient transaction data to analyze travel patterns.',
				travelPeriods: []
			};
		}

		// Travel-related keywords
		const travelKeywords = [
			'AIRLINE', 'FLIGHT', 'HOTEL', 'MOTEL', 'AIRBNB', 'VRBO', 'BOOKING',
			'EXPEDIA', 'TRIP', 'TRAVEL', 'CAR RENTAL', 'HERTZ', 'AVIS', 'UBER', 'LYFT'
		];

		// Find travel-related transactions
		const travelTxs = transactions.filter(tx =>
			travelKeywords.some(keyword =>
				(tx.description || '').toUpperCase().includes(keyword) ||
				(tx.category || '').toUpperCase().includes('TRAVEL')
			)
		);

		// Format travel data for prompt
		let travelText = 'No significant travel activity detected.';

		if (travelTxs.length > 0) {
			// Calculate total travel spend
			const travelSpend = travelTxs.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);

			// Group by approximate time periods
			const periods = [];
			let currentPeriod = null;

			// Sort by date
			const sortedTravelTxs = [...travelTxs].sort((a, b) => new Date(a.date) - new Date(b.date));

			sortedTravelTxs.forEach(tx => {
				const txDate = new Date(tx.date);

				// If no current period or this tx is more than 5 days after the last one
				if (!currentPeriod || (txDate - currentPeriod.endDate) > (5 * 24 * 60 * 60 * 1000)) {
					if (currentPeriod) {
						periods.push(currentPeriod);
					}

					currentPeriod = {
						startDate: txDate,
						endDate: txDate,
						transactions: [tx]
					};
				} else {
					// Extend current period
					currentPeriod.endDate = txDate;
					currentPeriod.transactions.push(tx);
				}
			});

			// Add the last period
			if (currentPeriod) {
				periods.push(currentPeriod);
			}

			// Format periods for text
			if (periods.length > 0) {
				const periodTexts = periods.map(p => {
					const durationDays = Math.ceil((p.endDate - p.startDate) / (1000 * 60 * 60 * 24)) + 1;
					const totalSpend = p.transactions.reduce((sum, tx) => {
						const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
						return sum + Math.abs(amount);
					}, 0);
					return `- ${p.startDate.toLocaleDateString()} to ${p.endDate.toLocaleDateString()}: ${durationDays} days, $${totalSpend.toFixed(2)} total`;
				});

				travelText = `Travel periods detected:\n${periodTexts.join('\n')}\n\nTotal travel spend: $${travelSpend.toFixed(2)}`;
			}
		}

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Travel & Events' analysis section based on this data:
      
      ${travelText}
      
      Format your response with an observation, logic, and bank actions sections, as in this example:
      "Observation: Spirit Airlines, Hard Rock Stadium, Florida trip clusters.
      Logic: Seasonal travel propensity; event-driven cash spikes; higher fraud false-positive risk across geos.
      Bank Actions:
      1 Pre-trip smart limits (temporary +20% credit line) + travel notification nudge.
      2 Cross-sell: miles/points card; event ticket perks; micro travel insurance.
      3 Fraud model feature: geo-hopping with stadium/airline tokens → reduce false positives."
      
      If no travel activity is detected, analyze what this absence suggests about the customer's lifestyle and appropriate banking strategies.
      
      Tone should be analytical, data-driven, and focused on travel-related banking opportunities for financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-travel`,
				'travel'
			);

			// Return formatted section
			return {
				title: 'Travel & Events',
				content,
				travelTxCount: travelTxs.length,
				travelSpend: travelTxs.reduce((sum, tx) => {
					const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
					return sum + Math.abs(amount);
				}, 0)
			};
		} catch (error) {
			logger.error('Error generating Travel & Events section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Travel & Events',
				content: travelText,
				travelTxCount: travelTxs.length,
				travelSpend: travelTxs.reduce((sum, tx) => {
					const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
					return sum + Math.abs(amount);
				}, 0)
			};
		}
	}

	/**
	 * Generate Backend Rules & Triggers section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateBackendRules(data, financialContext, requestId) {
		// Create example rules based on the data
		const rules = [];
		const actions = [];

		// Get account and transaction data
		const accounts = data.accounts || [];
		const transactions = data.transactions || [];

		// Calculate total balance
		const totalBalance = accounts.reduce((sum, account) => {
			const balance = typeof account.balance === 'number' ? account.balance : Number(account.balance || 0);
			return sum + balance;
		}, 0);

		// Calculate expenses
		const expenses = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);

		// Calculate average daily spend
		const daysInPeriod = Math.ceil((data.dateRange.endDate - data.dateRange.startDate) / (1000 * 60 * 60 * 24)) || 30;
		const averageDailySpend = expenses / daysInPeriod;

		// Calculate days of runway
		const daysOfRunway = averageDailySpend > 0 ? totalBalance / averageDailySpend : 999;

		// Rule 1: Liquidity guardrail
		if (daysOfRunway < 30) {
			rules.push(`{ "liquidity_guardrail": { "if": "end_balance < 1.5 * avg_daily_spend", "then": ["enable_overdraft_grace", "offer_loc_1500"] } }`);
			actions.push(`${actions.length + 1}) Liquidity guardrail (overdraft grace + LOC) — prevents attrition.`);
		}

		// Rule 2: Analyze categories for targeted rules
		const categoryMap = new Map();
		transactions.forEach(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			if (amount < 0) {
				const category = tx.category || 'Uncategorized';
				if (!categoryMap.has(category)) {
					categoryMap.set(category, {
						count: 0,
						total: 0
					});
				}

				const categoryData = categoryMap.get(category);
				categoryData.count++;
				categoryData.total += Math.abs(amount);
			}
		});

		// Convert categoryMap to an array of categories - ADD THIS LINE TO FIX THE ERROR
		const categories = Array.from(categoryMap.entries())
			.map(([name, data]) => ({
				name,
				count: data.count,
				total: data.total
			}))
			.sort((a, b) => b.count - a.count);

		// Check for coffee category
		const coffeeCategory = categories.find(c =>
			c.name.toUpperCase().includes('COFFEE') || c.name.toUpperCase().includes('CAFE')
		);

		if (coffeeCategory && coffeeCategory.count >= 3) {
			rules.push(`{ "coffee_rewards": { "if": "coffee_freq >= 5", "then": ["activate_5pct_cafe_cashback", "boost_favorite_brands_8pct_90d"] } }`);
			actions.push(`${actions.length + 1}) Coffee rewards activation — daily engagement anchor.`);
		}

		// Check for transit category
		const transitCategory = categories.find(c =>
			c.name.toUpperCase().includes('TRANSIT') || c.name.toUpperCase().includes('TRANSPORTATION')
		);

		if (transitCategory && transitCategory.count >= 3) {
			rules.push(`{ "transit_bundle": { "if": "transit_freq >= 5", "then": ["activate_transit_rewards", "offer_commuter_benefits"] } }`);
			actions.push(`${actions.length + 1}) Transit & rideshare bundle — inelastic + convenience value.`);
		}

		// Check for gambling
		const gamblingKeywords = ['CASINO', 'POKER', 'BETTING', 'GAMBLE', 'DRAFTKINGS', 'FANDUEL'];
		const gamblingTransactions = transactions.filter(tx => {
			return gamblingKeywords.some(keyword =>
				(tx.description || '').toUpperCase().includes(keyword)
			);
		});

		if (gamblingTransactions.length > 0) {
			rules.push(`{ "gambling_cap": { "if": "gambling_ratio > 0.15", "then": ["set_betting_cap", "alerts@[50,75,100]"] } }`);
			actions.push(`${actions.length + 1}) Gambling cap & alerts — risk mitigation and wellness.`);
		}

		// Format rules and actions for prompt
		const rulesText = rules.length > 0 ? rules.join(',\n') : '{ "example_rule": { "if": "condition", "then": ["action1", "action2"] } }';
		const actionsText = actions.length > 0 ? actions.join('\n') : '1) Default action — placeholder.';

		// Create prompt with examples and explicit formatting
		const prompt = `
      Generate a professional Banking Intelligence 'Appendix — Backend Rules, Triggers & Scoring' section based on this data:
      
      Example Rules (JSON-like):
      ${rulesText}
      
      Next-Best-Action (Priority Stack):
      ${actionsText}
      
      Format your response with feature definitions, example rules, scoring sketch, and next-best-action priority stack, similar to this example:
      "Feature Definitions
      - avg_daily_spend = total_outflows / 33
      - liquidity_floor = 2 × avg_daily_spend (dynamic, per cycle)
      - dk_ratio_other = |dk_debits| / |other_subtractions|
      - dk_ratio_total = |dk_debits| / total_outflows
      - coffee_freq, transit_freq, rideshare_freq = keyword counts per cycle
      
      Example Rules (JSON-like)
      { "liquidity_guardrail": { "if": "end_balance < 1.5 * avg_daily_spend", "then": ["enable_overdraft_grace", "offer_loc_1500"] } }
      
      Scoring Sketch
      propensity_auto_loan = sigmoid(0.8*transit_freq + 0.5*rideshare_freq - 1.2*has_auto_loan)
      propensity_coffee_rewards = sigmoid(0.7*coffee_freq + 0.3*restaurants_freq)
      
      Next-Best-Action (Priority Stack)
      1) Liquidity guardrail (overdraft grace + LOC) — prevents attrition.
      2) Coffee rewards activation — daily engagement anchor."
      
      Use the EXACT rules and actions from the provided data in your response.
      
      Tone should be technical, concise, and focused on actionable rules for banking systems.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-backend-rules`,
				'planning'
			);

			// Return formatted section
			return {
				title: 'Appendix — Backend Rules, Triggers & Scoring',
				content,
				rules: rules,
				actions: actions
			};
		} catch (error) {
			logger.error('Error generating Backend Rules section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Appendix — Backend Rules, Triggers & Scoring',
				content: `Feature Definitions\n- avg_daily_spend = total_outflows / ${daysInPeriod}\n- liquidity_floor = 2 × avg_daily_spend\n\nExample Rules (JSON-like)\n${rulesText}\n\nNext-Best-Action (Priority Stack)\n${actionsText}`,
				rules: rules,
				actions: actions
			};
		}
	}

	/**
	 * Compile final report from all sections
	 * @param {Object} sections - Generated report sections
	 * @param {Object} data - Financial data
	 * @param {string} format - Output format
	 * @returns {Object} - Compiled report
	 * @private
	 */
	_compileReport(sections, data, format) {
		// Basic report structure
		const report = {
			generated: new Date().toISOString(),
			title: 'Banking Intelligence Command — Benchmark Report',
			format,
			period: `${data.dateRange.startDate.toLocaleDateString()} to ${data.dateRange.endDate.toLocaleDateString()}`,
			sections: Object.entries(sections).map(([key, section], index) => ({
				id: key,
				order: index + 1,
				...section
			})),
			summary: {
				// Include key metrics for quick reference
				totalBalance: data.accounts ? data.accounts.reduce((sum, account) => {
					const balance = typeof account.balance === 'number' ? account.balance : Number(account.balance || 0);
					return sum + balance;
				}, 0) : 0,
				transactionCount: data.transactions ? data.transactions.length : 0,
				dateRange: data.dateRange,
				// Include section summaries if they exist
				accountSummary: sections.accountSummary ? sections.accountSummary.metrics : null,
				topCategories: sections.behaviorPreferences ? sections.behaviorPreferences.categories.slice(0, 5) : [],
				topMerchants: sections.merchantAnalysis ? sections.merchantAnalysis.merchants.slice(0, 5) : [],
				riskCount: sections.riskCompliance ? sections.riskCompliance.riskCount : 0,
				hasCriticalRisks: sections.riskCompliance ? sections.riskCompliance.hasCriticalRisks : false
			}
		};

		// Format-specific processing
		switch (format) {
			case 'json':
				// JSON format is already the default structure
				return report;

			case 'html':
				// Generate HTML representation
				return this._generateHtmlReport(report);

			case 'pdf':
				// For PDF, we'd generate a PDF buffer
				// This would typically use a PDF generation library
				// For simplicity, we'll just return the JSON with a flag
				return {
					...report,
					isPdfPending: true
				};

			default:
				return report;
		}
	}

	/**
	 * Generate HTML representation of the report
	 * @param {Object} report - Report data
	 * @returns {Object} - Report with HTML content
	 * @private
	 */
	_generateHtmlReport(report) {
		// Generate HTML sections with entity highlighting
		const sectionsHtml = report.sections.map(section => {
			// Special handling for sections with entities
			let sectionContent = section.content;

			// Highlight category names in behavior preferences
			if (section.id === 'behaviorPreferences' && section.categories) {
				section.categories.forEach(cat => {
					// Use a regex with word boundaries to avoid partial matches
					const regex = new RegExp(`\\b${cat.name}\\b`, 'gi');
					sectionContent = sectionContent.replace(regex, `<strong class="highlight-category">${cat.name}</strong>`);
				});
			}

			// Highlight merchant names in merchant analysis
			if (section.id === 'merchantAnalysis' && section.merchants) {
				section.merchants.forEach(merch => {
					// Use a regex with word boundaries to avoid partial matches
					const regex = new RegExp(`\\b${merch.name}\\b`, 'gi');
					sectionContent = sectionContent.replace(regex, `<strong class="highlight-merchant">${merch.name}</strong>`);
				});
			}

			return `
        <div class="report-section" id="${section.id}">
          <h3>${section.title}</h3>
          <div class="section-content">
            ${sectionContent.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
		}).join('');

		// Enhanced CSS with entity highlighting
		const css = `
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
      .report-header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3498db; }
      .report-section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
      h1 { color: #2c3e50; }
      h3 { color: #3498db; }
      .highlight-category { color: #e74c3c; font-weight: bold; }
      .highlight-merchant { color: #27ae60; font-weight: bold; }
      .summary-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
      .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
      .metric-label { font-size: 14px; color: #7f8c8d; }
    `;

		// Generate summary metrics HTML
		const summaryMetricsHtml = `
      <div class="summary-metrics">
        <div class="metric-card">
          <div class="metric-value">$${report.summary.totalBalance.toFixed(2)}</div>
          <div class="metric-label">Total Balance</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.transactionCount}</div>
          <div class="metric-label">Transactions</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">$${report.summary.accountSummary?.averageDailySpend.toFixed(2) || '0.00'}/day</div>
          <div class="metric-label">Average Daily Spend</div>
        </div>
      </div>
    `;

		// Generate full HTML document
		const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="report-header">
          <h1>${report.title}</h1>
          <p>Period: ${report.period}</p>
          <p>Generated: ${new Date(report.generated).toLocaleString()}</p>
          ${summaryMetricsHtml}
        </div>
        
        <div class="report-content">
          ${sectionsHtml}
        </div>
      </body>
      </html>
    `;

		// Return report with HTML content
		return {
			...report,
			htmlContent: html
		};
	}

	/**
	 * Convert timeframe string to date range
	 * @param {string} timeframe - Timeframe string (e.g., '30d', '90d', 'all')
	 * @returns {Object} - Date range with startDate and endDate
	 * @private
	 */
	_timeframeToDateRange(timeframe) {
		const endDate = new Date();
		let startDate = new Date();

		if (timeframe === 'all') {
			// Set startDate to a distant past date
			startDate = new Date(2000, 0, 1);
		} else if (timeframe.endsWith('d')) {
			// Days timeframe
			const days = parseInt(timeframe.slice(0, -1), 10);
			startDate.setDate(endDate.getDate() - days);
		} else if (timeframe.endsWith('m')) {
			// Months timeframe
			const months = parseInt(timeframe.slice(0, -1), 10);
			startDate.setMonth(endDate.getMonth() - months);
		} else if (timeframe.endsWith('y')) {
			// Years timeframe
			const years = parseInt(timeframe.slice(0, -1), 10);
			startDate.setFullYear(endDate.getFullYear() - years);
		} else {
			// Default to 30 days if invalid format
			startDate.setDate(endDate.getDate() - 30);
		}

		return { startDate, endDate };
	}

	/**
	 * Extract merchant name from transaction description
	 * @param {string} description - Transaction description
	 * @returns {string} - Extracted merchant name
	 * @private
	 */
	_extractMerchantName(description) {
		if (!description) return 'Unknown';

		// Enhanced merchant name extraction with more comprehensive prefix removal
		const cleanDesc = description
			.replace(/^(POS |ACH |DEBIT |CREDIT |PMT |PYMT |PUR |PURCH |PURCHASE |PMNT |CHK |CHECK |DEPOSIT |DEB |CRED |ATM |ONLINE |WEB |MOBILE |APP |BILL |PAYMENT |AUTOPAY |)/i, '')
			.replace(/\s+\d+\/\d+\/\d+$/, '') // Remove dates at the end
			.replace(/\s+\d{4,}$/, ''); // Remove long numbers (like reference numbers) at the end

		return cleanDesc.trim() || 'Unknown';
	}

	/**
	 * Create financial context for prompts
	 * @param {Object} data - Financial data
	 * @returns {string} - Formatted financial context
	 * @private
	 */
	_createFinancialContext(data) {
		// Normalize data first
		data = this._normalizeNumericFields(data);

		const { accounts = [], transactions = [] } = data;

		// Calculate total balance
		const totalBalance = accounts.reduce((sum, account) => {
			const balance = typeof account.balance === 'number' ? account.balance : Number(account.balance || 0);
			return sum + balance;
		}, 0);

		// Calculate income and expenses
		const income = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount > 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + amount;
			}, 0);

		const expenses = transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.reduce((sum, tx) => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return sum + Math.abs(amount);
			}, 0);

		// Calculate net change
		const netChange = income - expenses;

		// Format accounts summary
		const accountsSummary = accounts.map(account =>
			`${account.name || 'Account'}: $${account.balance.toFixed(2)} (${account.type || 'Unknown'})`
		).join('\n');

		// Process categories directly from transactions (replacing _getTopCategories)
		const categoryMap = new Map();
		transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.forEach(tx => {
				const category = tx.category || 'Uncategorized';
				const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0));

				if (!categoryMap.has(category)) {
					categoryMap.set(category, { count: 0, total: 0 });
				}

				const catData = categoryMap.get(category);
				catData.count++;
				catData.total += amount;
			});

		const categoryAnalysis = Array.from(categoryMap.entries())
			.sort(([, a], [, b]) => b.total - a.total)
			.slice(0, 5)
			.map(([name, data]) => `${name}: ${data.count} transactions ($${data.total.toFixed(2)})`)
			.join('\n');

		// Process merchants directly from transactions (replacing _getTopMerchants)
		const merchantMap = new Map();
		transactions
			.filter(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return amount < 0;
			})
			.forEach(tx => {
				const merchant = tx.merchantName || 'Unknown';
				const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0));

				if (!merchantMap.has(merchant)) {
					merchantMap.set(merchant, { count: 0, total: 0 });
				}

				const merchData = merchantMap.get(merchant);
				merchData.count++;
				merchData.total += amount;
			});

		const merchantAnalysis = Array.from(merchantMap.entries())
			.sort(([, a], [, b]) => b.total - a.total)
			.slice(0, 5)
			.map(([name, data]) => `${name}: ${data.count} transactions ($${data.total.toFixed(2)})`)
			.join('\n');

		// Format recent transactions (up to 10)
		const recentTransactions = [...transactions]
			.sort((a, b) => new Date(b.date) - new Date(a.date))
			.slice(0, 10)
			.map(tx => {
				const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
				return `${tx.date}: ${Math.abs(amount).toFixed(2)} ${amount < 0 ? 'expense' : 'income'} - ${tx.category || 'Uncategorized'} - ${tx.merchantName || 'Unknown'} - ${tx.description || ''}`;
			}).join('\n');

		// Format enhanced financial context
		return `
FINANCIAL SUMMARY:
Total Balance: $${totalBalance.toFixed(2)}
Income: $${income.toFixed(2)}
Expenses: $${expenses.toFixed(2)}
Net Change: $${netChange.toFixed(2)}

ACCOUNTS:
${accountsSummary || 'No account information available'}

TOP SPENDING CATEGORIES:
${categoryAnalysis || 'No category information available'}

TOP MERCHANTS:
${merchantAnalysis || 'No merchant information available'}

RECENT TRANSACTIONS:
${recentTransactions || 'No transaction history available'}
`;
	}
}

module.exports = new BankingCommandService();