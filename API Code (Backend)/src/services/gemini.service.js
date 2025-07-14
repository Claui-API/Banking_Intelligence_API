// src/services/gemini.service.js
const nodeFetch = require('node-fetch');
// Explicitly set fetch as a global
global.fetch = nodeFetch;
// Import these classes from node-fetch
const { Headers, Request, Response } = nodeFetch;
// Set them as globals
global.Headers = Headers;
global.Request = Request;
global.Response = Response;

const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

/**
 * Service for generating insights using Google's Gemini API
 */
class GeminiService {
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
			logger.warn('GEMINI_API_KEY not set. Gemini service will not function.');
			return;
		}

		try {
			// Initialize using the correct constructor
			this.client = new GoogleGenAI({ apiKey: this.apiKey });
			logger.info('Gemini service initialized successfully', {
				modelName: this.modelName
			});
		} catch (error) {
			logger.error('Failed to initialize Gemini client:', error);
		}
	}

	/**
	 * Generate insights using Gemini API
	 * @param {Object} userData - User data including query and context
	 * @returns {Promise<Object>} - Generated insights
	 */
	async generateInsights(userData) {
		if (!this.client) {
			this.initialize();
			if (!this.client) {
				logger.warn('Gemini client not available, using fallback response');
				return this._getFallbackResponse(userData);
			}
		}

		const { query, queryType, requestId } = userData;

		try {
			logger.info('Generating insights with Gemini service', {
				queryType,
				model: this.modelName,
				requestId
			});

			// Select appropriate prompt based on query type
			let promptText;
			let temperature = 0.3; // Default temperature

			// Select prompt based on query type using your existing methods
			switch (queryType) {
				case 'harmful':
					promptText = this._createHarmfulContentPrompt(userData);
					temperature = 0.1; // Very consistent for harm refusals
					break;
				case 'greeting':
					promptText = this._createGreetingPrompt(userData);
					temperature = 0.2; // More consistency for greetings
					break;
				case 'joke':
					promptText = this._createJokePrompt(userData);
					temperature = 0.7; // Higher variety for jokes
					break;
				case 'budgeting':
					promptText = this._createBudgetingPrompt(userData);
					temperature = 0.3;
					break;
				case 'spending':
					promptText = this._createSpendingPrompt(userData);
					temperature = 0.3;
					break;
				case 'saving':
					promptText = this._createSavingPrompt(userData);
					temperature = 0.3;
					break;
				case 'investing':
					promptText = this._createInvestingPrompt(userData);
					temperature = 0.3;
					break;
				case 'debt':
					promptText = this._createDebtPrompt(userData);
					temperature = 0.3;
					break;
				case 'tax':
					promptText = this._createTaxPrompt(userData);
					temperature = 0.3;
					break;
				case 'insurance':
					promptText = this._createInsurancePrompt(userData);
					temperature = 0.3;
					break;
				case 'retirement':
					promptText = this._createRetirementPrompt(userData);
					temperature = 0.3;
					break;
				case 'banking':
					promptText = this._createBankingPrompt(userData);
					temperature = 0.3;
					break;
				case 'credit':
					promptText = this._createCreditPrompt(userData);
					temperature = 0.3;
					break;
				case 'planning':
					promptText = this._createPlanningPrompt(userData);
					temperature = 0.3;
					break;
				case 'real_estate':
					promptText = this._createRealEstatePrompt(userData);
					temperature = 0.3;
					break;
				case 'crypto':
					promptText = this._createCryptoPrompt(userData);
					temperature = 0.3;
					break;
				case 'market_analysis':
					promptText = this._createMarketAnalysisPrompt(userData);
					temperature = 0.3;
					break;
				case 'education':
					promptText = this._createEducationPrompt(userData);
					temperature = 0.3;
					break;
				case 'income':
					promptText = this._createIncomePrompt(userData);
					temperature = 0.3;
					break;
				case 'transactions':
					promptText = this._createTransactionsPrompt(userData);
					temperature = 0.3;
					break;
				case 'security':
					promptText = this._createSecurityPrompt(userData);
					temperature = 0.3;
					break;
				case 'forex':
					promptText = this._createForexPrompt(userData);
					temperature = 0.3;
					break;
				case 'general':
				default:
					promptText = this._createGeneralPrompt(userData);
					temperature = 0.3;
			}

			// Generate content using the correct API structure
			const response = await this.client.models.generateContent({
				model: this.modelName,
				contents: [
					{
						role: "user",
						parts: [{ text: promptText }]
					}
				],
				generationConfig: {
					temperature: temperature,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 800
				},
				systemInstruction: "You are a helpful financial assistant. Provide clear, concise insights based on the user's financial data. Be informative but not verbose."
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
				logger.info('Gemini API response received', {
					requestId,
					responseLength: generatedText.length,
					model: this.modelName
				});

				return {
					insight: generatedText,
					timestamp: new Date().toISOString(),
					queryType,
					source: 'gemini'
				};
			} else {
				logger.warn('Empty response from Gemini API, falling back', {
					requestId
				});
				return this._getFallbackResponse(userData);
			}
		} catch (error) {
			logger.error('Error generating insights with Gemini:', {
				errorMessage: error.message,
				errorName: error.name,
				errorStack: error.stack,
				query: userData.query,
				queryType: userData.queryType,
				requestId
			});

			// Use fallback when API fails
			return this._getFallbackResponse(userData);
		}
	}

	/**
	 * Get a fallback response when Gemini API fails
	 * @param {Object} userData - User data
	 * @returns {Object} - Fallback response
	 */
	_getFallbackResponse(userData) {
		const { query, queryType } = userData;
		const { accounts = [], transactions = [] } = userData;

		// Calculate some basic financial metrics to personalize the fallback response
		const totalBalance = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
		const hasSavingsAccount = accounts.some(a => a.type?.toLowerCase().includes('saving'));
		const hasRecentTransaction = transactions.length > 0 && new Date(transactions[0].date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		let fallbackText;

		switch (queryType) {
			case 'greeting':
				const userName = userData.userProfile?.name || '';
				fallbackText = `Hello${userName ? ' ' + userName : ''}! 👋 How can I help with your finances today?`;
				break;

			case 'joke':
				const jokes = [
					"Why don't scientists trust atoms? Because they make up everything — including your financial statements! 😂",
					"What's a computer's favorite snack? Microchips with mega dips! Just like your savings account needs regular deposits! 💰",
					"Why don't economists like to go to the beach? Because they're always worried about the fiscal cliff! 📊",
					"I told my wife she was spending too much money on lip gloss. She gave me the silent treatment. I guess money talks, but savings apparently give you the silent treatment. 💄",
					"What do you call someone who's really good with money? Fiscally responsible... or as I like to call them, mythical. 🦄"
				];
				fallbackText = jokes[Math.floor(Math.random() * jokes.length)];
				break;

			case 'budgeting':
				fallbackText = `Looking at your financial data, I'd recommend a 50/30/20 budget approach: allocate 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment. With your total balance of $${totalBalance.toFixed(2)}, tracking your expenses carefully would help you optimize your spending patterns and build a more effective budget.`;
				break;

			case 'spending':
				fallbackText = `Based on your transaction history, I notice several opportunities to optimize your spending. Consider reviewing your regular expenses and identifying non-essential items that could be reduced. Many people find they can save 10-15% of their monthly expenses by eliminating unused subscriptions and being more mindful of small, frequent purchases.`;
				break;

			case 'saving':
				fallbackText = `${hasSavingsAccount ? 'I see you already have a savings account, which is great!' : 'Opening a dedicated savings account would be a good first step.'} To boost your savings rate, consider setting up automatic transfers right after payday, before you have a chance to spend the money. Even small, consistent contributions add up significantly over time due to compound interest.`;
				break;

			case 'investing':
				fallbackText = `For investing, diversification is key. A mix of low-cost index funds, bonds, and perhaps a small allocation to individual stocks (if you're comfortable with higher risk) can create a balanced portfolio. Consider your time horizon and risk tolerance when determining your asset allocation.`;
				break;

			case 'debt':
				fallbackText = `When tackling debt, focus on high-interest debt first (typically credit cards) while making minimum payments on lower-interest debt. The avalanche method (paying highest interest first) saves you the most money, while the snowball method (paying smallest balances first) provides psychological wins that keep you motivated.`;
				break;

			case 'tax':
				fallbackText = `Tax efficiency is an important part of financial planning. Common tax-advantaged strategies include maximizing contributions to retirement accounts like 401(k)s and IRAs, harvesting investment losses, and keeping track of deductible expenses throughout the year rather than scrambling at tax time.`;
				break;

			case 'retirement':
				fallbackText = `For retirement planning, the general rule is to save 15-20% of your pre-tax income. Maximize employer matches in retirement accounts (it's essentially free money), and consider a mix of pre-tax and Roth contributions for tax diversification in retirement. The earlier you start, the more time compound interest has to work in your favor.`;
				break;

			case 'general':
			default:
				fallbackText = `Based on your financial overview, I'd suggest focusing on three key areas: ${!hasSavingsAccount ? 'establishing an emergency fund, ' : ''}${hasRecentTransaction ? 'tracking your expenses more carefully, ' : ''}and setting clear financial goals. Regular financial check-ups can help you stay on track and adjust your strategy as needed. What specific aspect of your finances would you like to improve?`;
				break;
		}

		logger.info('Generated Gemini fallback response', {
			queryType,
			responseLength: fallbackText.length
		});

		return {
			insight: fallbackText,
			timestamp: new Date().toISOString(),
			queryType,
			source: 'gemini-fallback'
		};
	}

	// All your existing prompt methods remain the same
	_createHarmfulContentPrompt(userData) {
		return `I cannot and will not provide information about potentially harmful or illegal activities. 
    Please ask about legitimate financial topics, and I'll be happy to help.`;
	}

	_createGreetingPrompt(userData) {
		const userName = userData.userProfile?.name || '';
		return `Respond to the user's greeting in a friendly, professional manner. 
    If available, use their name: ${userName}`;
	}

	_createJokePrompt(userData) {
		return `Tell a clean, family-friendly joke related to finance or money. 
    Keep it light and professional.`;
	}

	_createFinancialContext(userData) {
		// Your existing implementation
		const { accounts = [], transactions = [] } = userData;

		// Calculate total balance
		const totalBalance = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);

		// Calculate net worth (assets minus liabilities)
		const netWorth = accounts.reduce((sum, account) => {
			return account.type === 'Credit Card'
				? sum - Math.abs(account.balance || 0)
				: sum + (account.balance || 0);
		}, 0);

		// Get recent transactions (last 30 days)
		const now = new Date();
		const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

		const recentTransactions = transactions
			.filter(tx => new Date(tx.date) >= thirtyDaysAgo)
			.sort((a, b) => new Date(b.date) - new Date(a.date));

		// Calculate monthly income and expenses
		const monthlyIncome = recentTransactions
			.filter(tx => tx.amount > 0)
			.reduce((sum, tx) => sum + tx.amount, 0);

		const monthlyExpenses = recentTransactions
			.filter(tx => tx.amount < 0)
			.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

		// Get top expense categories
		const expenseCategories = {};
		recentTransactions
			.filter(tx => tx.amount < 0 && tx.category)
			.forEach(tx => {
				expenseCategories[tx.category] = (expenseCategories[tx.category] || 0) + Math.abs(tx.amount);
			});

		const topCategories = Object.entries(expenseCategories)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([category]) => category);

		// Format accounts
		const accountsSummary = accounts.map(account =>
			`${account.name || 'Account'}: $${(account.balance || 0).toFixed(2)} (${account.type || 'Unknown type'})`
		).join('\n');

		// Format recent transactions (limit to 10)
		const transactionsSummary = recentTransactions
			.slice(0, 10)
			.map(tx =>
				`${tx.date}: $${Math.abs(tx.amount).toFixed(2)} ${tx.amount < 0 ? 'expense' : 'income'} - ${tx.category || 'Uncategorized'} - ${tx.description || ''}`
			).join('\n');

		return `
FINANCIAL SUMMARY:
Total Balance: $${totalBalance.toFixed(2)}
Net Worth: $${netWorth.toFixed(2)}
Monthly Income: $${monthlyIncome.toFixed(2)}
Monthly Expenses: $${monthlyExpenses.toFixed(2)}
Top Expense Categories: ${topCategories.join(', ') || 'Not enough data'}

ACCOUNTS:
${accountsSummary || 'No account information available'}

RECENT TRANSACTIONS:
${transactionsSummary || 'No transaction history available'}
`;
	}

	_createGeneralPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Analyze the following financial data and provide helpful insights addressing this question: "${query}"\n\n${financialContext}`;
	}

	_createBudgetingPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide personalized budgeting advice addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Creating a balanced budget that fits their income and expenses
2. Identifying areas where spending can be optimized
3. Suggesting practical budgeting techniques or tools
4. Providing actionable steps they can take immediately`;
	}

	_createSpendingPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Analyze the following spending data and provide insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Identifying spending patterns and trends
2. Highlighting areas of potential overspending
3. Comparing spending against common financial benchmarks
4. Suggesting specific ways to optimize spending habits`;
	}

	_createSavingPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide personalized saving advice addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Evaluating current saving rate and opportunities
2. Recommending savings goals based on their financial situation
3. Suggesting specific saving strategies or vehicles
4. Providing actionable steps to increase savings`;
	}

	_createInvestingPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide investment insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Assessing their capacity for investment based on their financial situation
2. Suggesting appropriate investment approaches given their context
3. Discussing investment vehicles that might be suitable
4. Providing balanced perspective on risk and potential returns

Important: Provide general investment education rather than specific investment recommendations for particular securities.`;
	}

	_createDebtPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide debt management advice addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Analyzing their current debt situation
2. Suggesting effective debt repayment strategies
3. Identifying opportunities to reduce interest costs
4. Providing actionable steps to improve their debt situation`;
	}

	_createTaxPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide tax insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Identifying potential tax considerations based on their financial situation
2. Suggesting tax-efficient strategies
3. Discussing potential deductions or credits that might apply
4. Providing general tax education

Important: Clarify that this is general tax information, not professional tax advice, and they should consult a tax professional for their specific situation.`;
	}

	_createInsurancePrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide insurance insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing insurance considerations relevant to their financial situation
2. Explaining insurance concepts in simple terms
3. Identifying potential insurance needs or gaps
4. Providing educational information about insurance types and coverage`;
	}

	_createRetirementPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide retirement planning insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing retirement considerations based on their financial situation
2. Explaining retirement planning concepts
3. Suggesting retirement savings vehicles or strategies
4. Providing actionable steps for retirement preparation`;
	}

	_createBankingPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide banking insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Analyzing their current banking situation
2. Suggesting banking optimizations or strategies
3. Discussing banking products or services that might be beneficial
4. Providing educational information about banking concepts`;
	}

	_createCreditPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide credit insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing credit considerations based on their financial situation
2. Suggesting strategies to build or improve credit
3. Explaining credit concepts in simple terms
4. Providing actionable steps related to credit management`;
	}

	_createPlanningPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide financial planning insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Assessing their overall financial situation
2. Suggesting holistic financial planning approaches
3. Identifying financial priorities and goals
4. Providing a structured approach to financial planning`;
	}

	_createRealEstatePrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide real estate insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Analyzing real estate considerations in the context of their finances
2. Discussing housing affordability based on their situation
3. Explaining real estate concepts clearly
4. Providing educational information about real estate decisions`;
	}

	_createCryptoPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide cryptocurrency insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing cryptocurrency in the context of their overall finances
2. Explaining cryptocurrency concepts clearly
3. Providing balanced perspective on risks and considerations
4. Emphasizing education over specific recommendations

Important: Clarify that cryptocurrency is a high-risk investment category and should typically represent only a small portion of a diversified portfolio, if any.`;
	}

	_createMarketAnalysisPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide market analysis insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing market concepts in relation to their financial situation
2. Explaining market terminology clearly
3. Providing educational information about markets
4. Offering balanced perspective on market considerations

Important: Provide general market education rather than specific market predictions or timing advice.`;
	}

	_createEducationPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide educational insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Explaining financial concepts clearly and simply
2. Providing educational content tailored to their situation
3. Using examples to illustrate concepts
4. Breaking down complex topics into understandable parts`;
	}

	_createIncomePrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide income-related insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Analyzing their income situation
2. Suggesting income optimization strategies
3. Discussing income growth or diversification opportunities
4. Providing actionable steps related to income management`;
	}

	_createTransactionsPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following transaction data, provide insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Analyzing transaction patterns and trends
2. Identifying notable or unusual transactions
3. Suggesting transaction management strategies
4. Providing insights about spending behavior based on transactions`;
	}

	_createSecurityPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide security insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing financial security best practices
2. Suggesting fraud prevention strategies
3. Explaining security concepts clearly
4. Providing actionable security recommendations`;
	}

	_createForexPrompt(userData) {
		const { query } = userData;
		const financialContext = this._createFinancialContext(userData);

		return `Based on the following financial information, provide foreign exchange insights addressing this question: "${query}"\n\n${financialContext}
    
Focus on:
1. Discussing foreign exchange concepts in relation to their finances
2. Explaining currency-related terminology clearly
3. Providing educational information about forex
4. Discussing foreign currency considerations for personal finance

Important: Provide general forex education rather than specific currency predictions or timing advice.`;
	}
}

module.exports = new GeminiService();