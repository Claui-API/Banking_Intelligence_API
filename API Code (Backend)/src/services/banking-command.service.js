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
 * Banking Intelligence Command Service
 * Generates comprehensive banking intelligence reports using transaction and account data
 */
class BankingCommandService {
	constructor() {
		this.apiKey = process.env.GEMINI_API_KEY;
		this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
		this.client = null;
		this.initialize();
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
			const financialData = statementData
				? this._processStatementData(statementData)
				: await this._collectFinancialData(userId, timeframe);

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
		// This would extract accounts, transactions, and other financial info

		// For demo purposes, return a simplified data structure
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

		return processedData;
	}

	/**
	 * Collect financial data from database
	 * @param {string} userId - User ID
	 * @param {string} timeframe - Time period
	 * @returns {Promise<Object>} - Collected financial data
	 * @private
	 */
	async _collectFinancialData(userId, timeframe) {
		// Convert timeframe to date range
		const { startDate, endDate } = this._timeframeToDateRange(timeframe);

		try {
			// Fetch bank user
			const bankUser = await BankUser.findOne({
				where: { id: userId, status: 'active' }
			});

			if (!bankUser) {
				throw new Error(`User with ID ${userId} not found or not active`);
			}

			const clientId = bankUser.clientId;
			const bankUserId = bankUser.bankUserId;

			// Fetch accounts for the user
			const accounts = await Account.findAll({
				where: {
					clientId,
					bankUserId,
					isActive: true
				}
			});

			// Get account IDs for transaction query
			const accountIds = accounts.map(account => account.accountId);

			// Fetch transactions for the accounts within the date range
			const transactions = await Transaction.findAll({
				where: {
					clientId,
					bankUserId,
					accountId: { [Op.in]: accountIds },
					date: { [Op.between]: [startDate, endDate] }
				},
				order: [['date', 'ASC']]
			});

			return {
				user: bankUser,
				accounts,
				transactions,
				dateRange: { startDate, endDate },
				timeframe
			};
		} catch (error) {
			logger.error('Error collecting financial data', {
				userId,
				timeframe,
				error: error.message
			});
			throw error;
		}
	}

	/**
 * Generate content using Google's Gemini API
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} requestId - Request ID for logging
 * @param {string} queryType - Type of query for logging
 * @returns {Promise<string>} - Generated text
 * @private
 */
	async _generateContent(prompt, requestId, queryType) {
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

			// Configure generation settings
			const generationConfig = {
				temperature: 0.3,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 800
			};

			// Adjust settings based on query type
			if (queryType === 'education') {
				generationConfig.temperature = 0.2;
				generationConfig.maxOutputTokens = 1500;
			} else if (queryType === 'risk') {
				generationConfig.temperature = 0.1;
			} else if (queryType === 'travel') {
				generationConfig.temperature = 0.4;
			}

			// Define the grounding tool
			const groundingTool = {
				googleSearch: {}
			};

			// Configure request
			const config = {
				tools: [groundingTool]
			};

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
				systemInstruction: "You are a banking intelligence analysis system. Provide clear, concise financial insights based on transaction and account data. Be informative and data-driven, focusing on patterns, risks, and actionable recommendations.",
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
		// Prepare financial context for Gemini
		const financialContext = this._createFinancialContext(financialData);

		// Generate each section of the report
		const sections = {};

		// Account Summary section
		sections.accountSummary = await this._generateAccountSummary(financialData, financialContext, requestId);

		// Behavior & Preferences section
		sections.behaviorPreferences = await this._generateBehaviorPreferences(financialData, financialContext, requestId);

		// Merchant Analysis section
		sections.merchantAnalysis = await this._generateMerchantAnalysis(financialData, financialContext, requestId);

		// Risk & Compliance section
		sections.riskCompliance = await this._generateRiskCompliance(financialData, financialContext, requestId);

		// Generate detailed sections if requested
		if (includeDetailed) {
			// Cadence & Routines section
			sections.cadenceRoutines = await this._generateCadenceRoutines(financialData, financialContext, requestId);

			// Recurring & Subscriptions section
			sections.recurringSubscriptions = await this._generateRecurringSubscriptions(financialData, financialContext, requestId);

			// Travel & Events section
			sections.travelEvents = await this._generateTravelEvents(financialData, financialContext, requestId);

			// Backend Rules & Triggers section
			sections.backendRules = await this._generateBackendRules(financialData, financialContext, requestId);
		}

		return sections;
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

		// Create prompt
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
	 * Generate Behavior & Preferences section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateBehaviorPreferences(data, financialContext, requestId) {
		// Analyze transactions by category
		const transactions = data.transactions || [];
		const categoryMap = new Map();

		// Group transactions by category
		transactions.forEach(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			if (amount < 0) { // Only count expenses
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

		// Convert to array and sort by frequency
		const categories = Array.from(categoryMap.entries())
			.map(([name, data]) => ({
				name,
				count: data.count,
				total: data.total
			}))
			.sort((a, b) => b.count - a.count);

		// Take top 10 categories
		const topCategories = categories.slice(0, 10);

		// Calculate total transactions for percentage calculation
		const totalTransactions = topCategories.reduce((sum, cat) => sum + cat.count, 0);

		// Format category data for prompt
		const categoriesText = topCategories.map(cat => {
			const percent = totalTransactions > 0 ? (cat.count / totalTransactions) * 100 : 0;
			return `- ${cat.name}: ${cat.count} mentions (${percent.toFixed(2)}% of detected)`;
		}).join('\n');

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Behavior & Preferences' analysis section based on this spending category data:
      
      ${categoriesText}
      
      Format your response as frequency signals with percentages and elasticity assessments, as in this example:
      "- Rideshare: 40 mentions (28.17% of detected); elasticity proxy: Elastic-ish.
      - Groceries/Drugstores: 25 mentions (17.61% of detected); elasticity proxy: Moderate.
      - Transit: 16 mentions (11.27% of detected); elasticity proxy: Inelastic."
      
      Add a short explanation of the method used:
      "Method: Keyword frequency across merchant descriptors; useful for engagement and rewards targeting when precise merchant totals are not available from PDF text extraction."
      
      Determine elasticity based on these criteria:
      - Inelastic: Daily necessities, high frequency
      - Moderate: Regular but not daily needs
      - Elastic-ish: Discretionary spending, luxury, or occasional purchases
      
      Tone should be analytical, data-driven, and geared toward financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-behavior`,
				'spending'
			);

			// Return formatted section
			return {
				title: 'Behavior & Preferences (Frequency Signals)',
				content,
				categories: topCategories.map(cat => ({
					name: cat.name,
					count: cat.count,
					total: cat.total,
					percent: totalTransactions > 0 ? (cat.count / totalTransactions) * 100 : 0
				}))
			};
		} catch (error) {
			logger.error('Error generating Behavior & Preferences section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Behavior & Preferences (Frequency Signals)',
				content: categoriesText + '\n\nMethod: Keyword frequency across transaction categories; useful for engagement and rewards targeting.',
				categories: topCategories.map(cat => ({
					name: cat.name,
					count: cat.count,
					total: cat.total,
					percent: totalTransactions > 0 ? (cat.count / totalTransactions) * 100 : 0
				}))
			};
		}
	}

	/**
	 * Generate Merchant Analysis section
	 * @param {Object} data - Financial data
	 * @param {string} financialContext - Financial context
	 * @param {string} requestId - Request ID
	 * @returns {Promise<Object>} - Generated section
	 * @private
	 */
	async _generateMerchantAnalysis(data, financialContext, requestId) {
		// Analyze transactions by merchant
		const transactions = data.transactions || [];
		const merchantMap = new Map();

		// Group transactions by merchant
		transactions.forEach(tx => {
			const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
			if (amount < 0) { // Only count expenses
				const merchant = tx.merchantName || this._extractMerchantName(tx.description) || 'Unknown';

				if (!merchantMap.has(merchant)) {
					merchantMap.set(merchant, {
						count: 0,
						total: 0
					});
				}

				const merchantData = merchantMap.get(merchant);
				merchantData.count++;
				merchantData.total += Math.abs(amount);
			}
		});

		// Convert to array and sort by frequency
		const merchants = Array.from(merchantMap.entries())
			.map(([name, data]) => ({
				name,
				count: data.count,
				total: data.total
			}))
			.sort((a, b) => b.count - a.count);

		// Take top 10 merchants
		const topMerchants = merchants.slice(0, 10);

		// Format merchant data for prompt
		const merchantsText = topMerchants.map(m =>
			`- ${m.name} — ${m.count}`
		).join('\n');

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Merchant Concentration' analysis section based on this merchant data:
      
      ${merchantsText}
      
      Format your response as a list of top merchant descriptors with frequency counts, as in this example:
      "- UBER * PENDI — 25
      - MBTA-5 — 10
      - PURCHASE CVS — 8
      - DRAFTKINGS DES — 8
      - APPLE.COM/BILL — 7"
      
      Add a short note explaining the format:
      "Note: Tokens are extracted from transaction descriptions and may include formatting artifacts but reliably show brand concentration and habit anchors."
      
      Tone should be analytical, data-driven, and geared toward financial professionals.
    `;

		try {
			// Generate content
			const content = await this._generateContent(
				prompt,
				`${requestId}-merchants`,
				'transactions'
			);

			// Return formatted section
			return {
				title: 'Merchant Concentration (Top Descriptors)',
				content,
				merchants: topMerchants
			};
		} catch (error) {
			logger.error('Error generating Merchant Analysis section', {
				requestId,
				error: error.message
			});

			// Return fallback content if generation fails
			return {
				title: 'Merchant Concentration (Top Descriptors)',
				content: merchantsText + '\n\nNote: Merchants extracted from transaction descriptions show brand concentration and habit anchors.',
				merchants: topMerchants
			};
		}
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

		// Create prompt
		const prompt = `
      Generate a professional Banking Intelligence 'Recurring & Subscriptions' analysis section based on this data:
      
      ${subscriptionsText}
      
      ${techText}
      
      Format your response with detected merchants and a signal analysis, as in this example:
      "Detected recurring tech/utility merchants: Apple.com/Bill, GoDaddy, AWS (Amazon Web Services).
      Signal: tech-forward user with entrepreneurial patterns (domain + cloud + app store). Fit for business/creator bundles, bookkeeping add-ons, and SaaS-linked credit."
      
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

		// Convert to array and sort by frequency
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

		// Create prompt
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
		// Generate HTML sections
		const sectionsHtml = report.sections.map(section => `
      <div class="report-section">
        <h3>${section.title}</h3>
        <div class="section-content">
          ${section.content.replace(/\n/g, '<br>')}
        </div>
      </div>
    `).join('');

		// Generate full HTML document
		const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .report-header { margin-bottom: 30px; }
          .report-section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
          h1 { color: #2c3e50; }
          h3 { color: #3498db; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>${report.title}</h1>
          <p>Period: ${report.period}</p>
          <p>Generated: ${new Date(report.generated).toLocaleString()}</p>
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

		// Strip common prefixes and suffixes
		const cleanDesc = description
			.replace(/^(POS |ACH |DEBIT |CREDIT |PMT |PYMT |PUR |PURCH |PURCHASE |PMNT |)/i, '')
			.replace(/\s+\d+\/\d+\/\d+$/, ''); // Remove dates at the end

		return cleanDesc;
	}

	/**
	 * Create financial context for prompts
	 * @param {Object} data - Financial data
	 * @returns {string} - Formatted financial context
	 * @private
	 */
	_createFinancialContext(data) {
		const { accounts = [], transactions = [] } = data;

		// Calculate total balance
		const totalBalance = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);

		// Calculate income and expenses
		const income = transactions
			.filter(tx => tx.amount > 0)
			.reduce((sum, tx) => sum + tx.amount, 0);

		const expenses = transactions
			.filter(tx => tx.amount < 0)
			.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

		// Calculate net change
		const netChange = income - expenses;

		// Format accounts summary
		const accountsSummary = accounts.map(account =>
			`${account.name || 'Account'}: $${account.balance.toFixed(2)} (${account.type || 'Unknown'})`
		).join('\n');

		// Format recent transactions (up to 10) with proper type handling
		const recentTransactions = [...transactions]
			.sort((a, b) => new Date(b.date) - new Date(a.date))
			.slice(0, 10)
			.map(tx => {
				// Ensure amount is a number with fallback to 0
				const amount = typeof tx.amount === 'number' ?
					tx.amount :
					parseFloat(tx.amount || 0);

				return `${tx.date}: ${Math.abs(amount).toFixed(2)} ${amount < 0 ? 'expense' : 'income'} - ${tx.category || 'Uncategorized'} - ${tx.description || ''}`;
			}).join('\n');

		// Format financial context
		return `
FINANCIAL SUMMARY:
Total Balance: $${totalBalance.toFixed(2)}
Income: $${income.toFixed(2)}
Expenses: $${expenses.toFixed(2)}
Net Change: $${netChange.toFixed(2)}

ACCOUNTS:
${accountsSummary || 'No account information available'}

RECENT TRANSACTIONS:
${recentTransactions || 'No transaction history available'}
`;
	}
}

module.exports = new BankingCommandService();