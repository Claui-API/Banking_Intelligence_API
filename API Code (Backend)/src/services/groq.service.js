// src/services/groq.service.js
const Groq = require('groq-sdk'); // Use groq-sdk instead of groq
const logger = require('../utils/logger');

/**
 * Service for generating insights using Groq API as a backup
 * when Cohere API is unavailable
 */
class GroqService {
	constructor() {
		this.apiKey = process.env.GROQ_API_KEY;
		this.client = null;
		this.model = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
		this.initialize();
	}

	/**
	 * Initialize Groq client
	 */
	initialize() {
		if (!this.apiKey) {
			logger.warn('GROQ_API_KEY not set. Groq backup service will not function.');
			return;
		}

		try {
			// Initialize with groq-sdk format
			this.client = new Groq({ apiKey: this.apiKey });
			logger.info('Groq client initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Groq client:', error);
		}
	}

	/**
	 * Generate insights using Groq API
	 * Maintains the same interface as cohereService.generateInsights
	 * @param {Object} userData - User data including query and context
	 * @returns {Promise<Object>} - Generated insights
	 */
	async generateInsights(userData) {
		if (!this.client) {
			this.initialize();
			if (!this.client) {
				throw new Error('Groq client not initialized. Check your API key.');
			}
		}

		const { query, queryType, requestId } = userData;

		try {
			logger.info('Generating insights with Groq backup service', {
				queryType,
				model: this.model,
				requestId
			});

			// Select appropriate prompt and parameters based on query type
			let prompt;
			let maxTokens = 800;  // Default token limit
			let temperature = 0.3; // Default temperature

			switch (queryType) {
				case 'harmful':
					prompt = this._createHarmfulContentPrompt(userData);
					maxTokens = 200;  // Shorter for harm refusals
					temperature = 0.1; // Very consistent for harm refusals
					break;
				case 'greeting':
					prompt = this._createGreetingPrompt(userData);
					maxTokens = 200;  // Shorter for greetings
					temperature = 0.2; // More consistency for greetings
					break;
				case 'joke':
					prompt = this._createJokePrompt(userData);
					maxTokens = 300;  // Medium length for jokes
					temperature = 0.7; // Higher variety for jokes
					break;
				case 'budgeting':
					prompt = this._createBudgetingPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'spending':
					prompt = this._createSpendingPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'saving':
					prompt = this._createSavingPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'investing':
					prompt = this._createInvestingPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'debt':
					prompt = this._createDebtPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'tax':
					prompt = this._createTaxPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'insurance':
					prompt = this._createInsurancePrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'retirement':
					prompt = this._createRetirementPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'banking':
					prompt = this._createBankingPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'credit':
					prompt = this._createCreditPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'planning':
					prompt = this._createPlanningPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'real_estate':
					prompt = this._createRealEstatePrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'crypto':
					prompt = this._createCryptoPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'market_analysis':
					prompt = this._createMarketAnalysisPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'education':
					prompt = this._createEducationPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'income':
					prompt = this._createIncomePrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'transactions':
					prompt = this._createTransactionsPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'security':
					prompt = this._createSecurityPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'forex':
					prompt = this._createForexPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
					break;
				case 'general':
				default:
					prompt = this._createGeneralPrompt(userData);
					maxTokens = 800;
					temperature = 0.3;
			}

			// Call Groq API using the groq-sdk format
			const completion = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{
						role: "system",
						content: "You are a helpful financial assistant. Provide clear, concise insights based on the user's financial data. Be informative but not verbose."
					},
					{
						role: "user",
						content: prompt
					}
				],
				temperature: temperature,
				max_tokens: maxTokens, // Note: groq-sdk might use max_tokens instead of max_completion_tokens
				top_p: 1,
				stream: false
			});

			// Extract and process response
			const generatedText = completion.choices[0].message.content;
			logger.info('Groq API response received', {
				requestId,
				responseLength: generatedText.length,
				model: this.model
			});

			return {
				insight: generatedText,
				timestamp: new Date().toISOString(),
				queryType,
				source: 'groq-backup'
			};
		} catch (error) {
			logger.error('Error generating insights with Groq:', {
				errorMessage: error.message,
				errorName: error.name,
				errorStack: error.stack,
				query: userData.query,
				queryType: userData.queryType,
				requestId,
				apiKey: this.apiKey ? '✓ API key is set' : '✗ API key is missing'
			});

			throw new Error(`Groq API error: ${error.message}`);
		}
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

module.exports = new GroqService();