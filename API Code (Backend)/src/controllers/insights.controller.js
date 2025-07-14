// src/controllers/insights.controller.js - Updated with Groq backup integration
const cohereService = require('../services/cohere.service');
const groqService = require('../services/groq.service');
const llmFactory = require('../services/llm-factory.service');
const databaseService = require('../services/data.service');
const logger = require('../utils/logger');

/**
 * Determine the type of query, including detection of harmful content and comprehensive financial categories
 * @param {string} query - The user's query
 * @returns {string} - The query type: 'greeting', 'joke', 'budgeting', etc.
 */
function classifyQuery(query) {
  if (!query) return 'general'; // Default to general if empty

  // Normalize the query (trim and lowercase)
  const normalizedQuery = query.trim().toLowerCase();

  // Check for harmful content first
  const harmfulPatterns = [
    // Drugs and illegal substances
    /\b(cocaine|heroin|meth|methamphetamine|fentanyl|drug dealer|drug price|buy drugs|sell drugs|marijuana|cannabis|weed)\b/i,
    // Illegal activities
    /\b(hack|hacking|ddos|phishing|steal|stealing|launder|laundering|money laundering|illegal)\b/i,
    // Weapons and violence
    /\b(make bomb|bomb making|gun dealer|illegal weapon|mass shooting|kill|murder)\b/i,
    // Child exploitation
    /\b(child porn|cp|csam|underage|minor sex|pedophilia)\b/i,
    // Fraud
    /\b(credit card fraud|identity theft|steal identity|fake id|counterfeit|pyramid scheme)\b/i,
    // Terrorism
    /\b(terrorism|terrorist|radicalize|jihad|extremist)\b/i
  ];

  if (harmfulPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return 'harmful';
  }

  // Check for greetings
  if (/^(hi|hello|hey|howdy|hola|yo|sup|greetings)$/i.test(normalizedQuery)) {
    return 'greeting';
  }

  // Check for extended greetings with name or punctuation
  const greetingPatterns = [
    /^(hi|hello|hey|howdy|hola)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(good\s+(morning|afternoon|evening))(\s+clau)?(\s*[!,.?]*)$/i,
    /^(what'?s\s+up|sup|yo)(\s+clau)?(\s*[!,.?]*)$/i,
    /^(greetings|welcome)(\s+clau)?(\s*[!,.?]*)$/i
  ];

  if (greetingPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return 'greeting';
  }

  // Check for joke requests
  if (/tell\s+me\s+a\s+joke|got\s+any\s+jokes|joke|make\s+me\s+laugh|something\s+funny/i.test(normalizedQuery)) {
    return 'joke';
  }

  // FINANCIAL CATEGORIES

  // Check for budgeting queries
  if (/budget|how\s+to\s+budget|budgeting|create\s+a\s+budget|manage\s+budget|budget\s+plan|monthly\s+budget|expense\s+tracking/i.test(normalizedQuery)) {
    return 'budgeting';
  }

  // Check for spending queries
  if (/spend|spending|how\s+much\s+did\s+i\s+spend|spent|where\s+is\s+my\s+money\s+going|expenses|expense|track\s+spending|spending\s+habits/i.test(normalizedQuery)) {
    return 'spending';
  }

  // Check for saving queries
  if (/save|saving|savings|how\s+to\s+save|save\s+money|save\s+more|increase\s+savings|emergency\s+fund|rainy\s+day\s+fund/i.test(normalizedQuery)) {
    return 'saving';
  }

  // Check for investment queries
  if (/invest|investing|investment|stock|stocks|etf|mutual\s+fund|portfolio|retirement|bond|bonds|index\s+fund|roth\s+ira|401k/i.test(normalizedQuery)) {
    return 'investing';
  }

  // Check for debt queries
  if (/debt|loan|credit\s+card|mortgage|pay\s+off|interest\s+rate|refinance|student\s+loan|debt\s+consolidation/i.test(normalizedQuery)) {
    return 'debt';
  }

  // Check for tax-related queries
  if (/tax|taxes|tax\s+return|tax\s+refund|tax\s+deduction|tax\s+credit|irs|filing\s+taxes|tax\s+bracket/i.test(normalizedQuery)) {
    return 'tax';
  }

  // Check for insurance queries
  if (/insurance|insure|policy|coverage|premium|deductible|life\s+insurance|health\s+insurance|auto\s+insurance/i.test(normalizedQuery)) {
    return 'insurance';
  }

  // Check for retirement queries
  if (/retirement|retire|401k|ira|pension|social\s+security|retirement\s+planning|retirement\s+age|early\s+retirement/i.test(normalizedQuery)) {
    return 'retirement';
  }

  // Check for banking queries
  if (/bank\s+account|checking|savings\s+account|deposit|withdraw|atm|transfer\s+money|bank\s+fee|overdraft|direct\s+deposit/i.test(normalizedQuery)) {
    return 'banking';
  }

  // Check for credit score queries
  if (/credit\s+score|credit\s+report|fico|credit\s+history|credit\s+bureau|improve\s+credit|bad\s+credit|credit\s+repair/i.test(normalizedQuery)) {
    return 'credit';
  }

  // Check for financial planning queries
  if (/financial\s+plan|financial\s+goal|financial\s+advisor|finance\s+management|wealth\s+management|estate\s+planning|trust|will/i.test(normalizedQuery)) {
    return 'planning';
  }

  // Check for real estate/housing queries
  if (/real\s+estate|housing|home\s+buying|mortgage|rent|property|down\s+payment|closing\s+costs|home\s+equity|home\s+loan|buying\s+house/i.test(normalizedQuery)) {
    return 'real_estate';
  }

  // Check for cryptocurrency queries
  if (/crypto|cryptocurrency|bitcoin|ethereum|blockchain|nft|token|defi|mining|wallet|exchange/i.test(normalizedQuery)) {
    return 'crypto';
  }

  // Check for market analysis/trends
  if (/market\s+trend|stock\s+market|bear\s+market|bull\s+market|market\s+analysis|forecast|economic\s+outlook|recession|inflation/i.test(normalizedQuery)) {
    return 'market_analysis';
  }

  // Check for financial education
  if (/learn|explain|how\s+does|what\s+is|define|financial\s+literacy|basics\s+of|understand|concept/i.test(normalizedQuery)) {
    return 'education';
  }

  // Check for income-related queries
  if (/income|salary|wage|earn|earning|paycheck|side\s+hustle|passive\s+income|raise|promotion|bonus/i.test(normalizedQuery)) {
    return 'income';
  }

  // Check for transaction-related queries
  if (/transaction|purchase|payment|receipt|invoice|refund|charge|statement|bill/i.test(normalizedQuery)) {
    return 'transactions';
  }

  // Check for fraud/security queries
  if (/fraud|scam|security|protect|identity|phishing|suspicious|fraud\s+alert|unauthorized\s+charge|data\s+breach/i.test(normalizedQuery)) {
    return 'security';
  }

  // Check for foreign exchange/currency queries
  if (/currency|foreign\s+exchange|forex|exchange\s+rate|conversion|dollar|euro|yuan|yen|pound|international\s+money/i.test(normalizedQuery)) {
    return 'forex';
  }

  // Default to general for any other queries
  return 'general';
}

/**
 * Controller for financial insights endpoints
 */
class InsightsController {
  constructor() {
    // Add any controller initialization here
  }

  /**
   * Generate personal financial insights
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async generateInsights(req, res, next) {
    try {
      const startTime = Date.now(); // Track performance
      const { userId } = req.auth;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Extract provider from request if specified
      const { query, requestId = `req_${Date.now()}`, provider } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query is required to generate insights'
        });
      }

      // Classify the query using our enhanced classifier
      const queryType = classifyQuery(query);
      logger.info(`Query classified as: ${queryType}`, {
        query,
        requestId,
        provider: provider || 'default'
      });

      // Handle harmful queries immediately
      if (queryType === 'harmful') {
        logger.warn(`Potentially harmful query detected: "${query}"`, { userId, requestId });

        return res.status(403).json({
          success: false,
          message: 'We cannot provide information about potentially harmful or illegal topics. If you need assistance with financial matters, please try a different query.'
        });
      }

      // Store query type in req.body for middleware
      req.body.queryType = queryType;

      // Get user data
      let userData;
      try {
        userData = await databaseService.getUserFinancialData(userId);
        logger.info(`Retrieved financial data for user ${userId}`, { requestId });
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for user ${userId}: ${error.message}`, { requestId });
          userData = databaseService.getMockUserData(userId);
        } else {
          return res.status(404).json({
            success: false,
            message: `Could not retrieve financial data: ${error.message}`
          });
        }
      }

      // Generate insights using LLM factory to select the appropriate provider
      let insights;

      try {
        // Use the LLM factory to generate insights with the specified or default provider
        insights = await llmFactory.generateInsights({
          ...userData,
          query,
          queryType,
          requestId
        }, provider);

        logger.info(`Generated insights using ${insights.llmProvider} provider`, {
          requestId,
          provider: insights.llmProvider,
          usingBackup: insights.usingBackupService,
          duration: Date.now() - startTime
        });

        // Add compatibility flags for metrics and frontend
        insights = {
          ...insights,
          processingTime: Date.now() - startTime,
          fromCache: false,
          usedRag: false,
          documentsUsed: 0,
          documentIds: []
        };

      } catch (error) {
        logger.error('Error generating insights with LLM services:', error, { requestId });

        // In development mode, provide mock insights if all else fails
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Using mock insights as last resort', { requestId });

          // Generate mock response based on query type
          insights = this._generateMockInsight(queryType, userData, query);

          // Add compatibility flags
          insights = {
            ...insights,
            processingTime: Date.now() - startTime,
            fromCache: false,
            usedRag: false,
            documentsUsed: 0,
            documentIds: [],
            llmProvider: 'mock'
          };
        } else {
          return res.status(500).json({
            success: false,
            message: `Failed to generate insights: ${error.message}`
          });
        }
      }

      // Return the insights with metrics flags
      return res.status(200).json({
        success: true,
        data: {
          query,
          insights: {
            ...insights,
            fromCache: false,           // Explicitly include in insights
            usedRag: false,             // Explicitly include in insights
            documentsUsed: 0,           // Explicitly include in insights
            documentIds: [],            // Explicitly include in insights
          },
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          ragEnabled: false,            // For backwards compatibility
          fromCache: false,             // For backwards compatibility
          documentsUsed: 0,             // For backwards compatibility
          documentIds: [],              // For backwards compatibility
          llmProvider: insights.llmProvider || 'unknown', // Which LLM was used
          usingBackupService: insights.usingBackupService || false
        }
      });
    } catch (error) {
      logger.error('Error generating insights:', error);

      // If we catch any error in development mode, return mock data
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Returning mock insights due to caught error');

        return res.status(200).json({
          success: true,
          data: {
            query: req.body.query || 'financial analysis',
            insights: {
              insight: `Here's a financial analysis based on mock data.\n\nYour spending patterns show a healthy balance with approximately 30% going to essential expenses. Your savings rate is around 15%, which is good but could be improved.\n\nConsider reducing discretionary spending on dining and entertainment by $100 per month to boost your savings rate.`,
              timestamp: new Date().toISOString(),
              queryType: 'general',
              fromCache: false,
              usedRag: false,
              documentsUsed: 0,
              documentIds: [],
              llmProvider: 'mock'
            },
            timestamp: new Date().toISOString(),
            error: true,
            ragEnabled: false,
            fromCache: false,
            documentsUsed: 0,
            documentIds: [],
            llmProvider: 'mock',
            usingBackupService: false
          }
        });
      }

      next(error);
    }
  }

  /**
   * Get financial summary for the user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getFinancialSummary(req, res, next) {
    try {
      const { userId } = req.auth; // Extracted from auth middleware

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      logger.info(`Getting financial summary for user: ${userId}`);

      // Get user financial data
      let userData;
      try {
        userData = await databaseService.getUserFinancialData(userId);
        logger.info(`Retrieved financial data for financial summary - user ${userId}`);
      } catch (error) {
        // If we can't find the user data, return mock data for development
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Using mock data for financial summary - user ${userId}: ${error.message}`);
          userData = databaseService.getMockUserData(userId);
        } else {
          return res.status(404).json({
            success: false,
            message: `Could not retrieve financial data: ${error.message}`
          });
        }
      }

      const { accounts, transactions } = userData;

      // Check if we have account and transaction data
      if (!accounts || !transactions) {
        logger.error(`Missing account or transaction data for user ${userId}`);

        // In development mode, provide default structure if data is missing
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Creating default account and transaction data in development');
          const mockData = databaseService.getMockUserData(userId);
          return res.status(200).json({
            success: true,
            data: {
              totalBalance: 20000.00,
              netWorth: 18800.00,
              accountCount: mockData.accounts.length,
              accounts: mockData.accounts,
              recentTransactions: mockData.transactions.slice(0, 5),
              timestamp: new Date().toISOString()
            }
          });
        } else {
          return res.status(500).json({
            success: false,
            message: 'Invalid financial data structure'
          });
        }
      }

      // Calculate summary metrics
      const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
      const netWorth = accounts.reduce((sum, account) => {
        // Credit card balances are negative, so we adjust for that
        return account.type === 'Credit Card'
          ? sum - Math.abs(account.balance)
          : sum + account.balance;
      }, 0);

      // Get recent transactions
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      // Return the summary
      return res.status(200).json({
        success: true,
        data: {
          totalBalance,
          netWorth,
          accountCount: accounts.length,
          accounts,
          recentTransactions,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error generating financial summary:', error);

      // If we catch any error in development mode, return mock data
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Returning mock financial summary due to caught error');
        const mockData = databaseService.getMockUserData(req.auth.userId || 'default-user');

        return res.status(200).json({
          success: true,
          data: {
            totalBalance: 18800.00,
            netWorth: 18800.00,
            accountCount: mockData.accounts.length,
            accounts: mockData.accounts,
            recentTransactions: mockData.transactions.slice(0, 5),
            timestamp: new Date().toISOString()
          }
        });
      }

      next(error);
    }
  }

  /**
   * Generate mock insights as a last resort
   * @param {string} queryType - Query type
   * @param {Object} userData - User's financial data
   * @param {string} query - User's query
   * @returns {Object} - Mock insight
   */
  _generateMockInsight(queryType, userData, query) {
    // Handle harmful queries first with a clear refusal
    if (queryType === 'harmful') {
      return {
        insight: 'I cannot provide information about potentially harmful or illegal activities. Please ask about legitimate financial topics, and I\'ll be happy to help.',
        timestamp: new Date().toISOString(),
        queryType
      };
    }

    switch (queryType) {
      case 'greeting':
        return {
          insight: `Hey ${userData.userProfile?.name || 'there'}! 👋 How can I help with your finances today?`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'joke':
        return {
          insight: `Why don't scientists trust atoms? Because they make up everything! 😂 Need any financial help today?`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'budgeting':
        const income = this._calculateMonthlyIncome(userData);
        return {
          insight: `Looking at your finances, I'd recommend a 50/30/20 budget: 50% on necessities, 30% on wants, and 20% on savings. Based on your monthly income of $${income.toFixed(2)}, you should aim to save about $${(income * 0.2).toFixed(2)} each month. 💰`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'spending':
        const expenses = this._calculateMonthlyExpenses(userData);
        const topCategories = this._getTopExpenseCategories(userData);
        return {
          insight: `In the past month, you've spent $${expenses.toFixed(2)}, mostly on ${topCategories[0] || 'groceries'} ($${(expenses * 0.25).toFixed(2)}), ${topCategories[1] || 'dining'} ($${(expenses * 0.15).toFixed(2)}), and ${topCategories[2] || 'entertainment'} ($${(expenses * 0.1).toFixed(2)}). 📊`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'saving':
        const monthlySavings = userData.accounts.filter(a => a.type === 'Savings').reduce((sum, a) => sum + a.balance, 0);
        return {
          insight: `You currently have $${monthlySavings.toFixed(2)} in your savings accounts. Based on your spending habits, you could increase your monthly savings by $200 by cutting back on non-essential expenses. 💸 Setting up automatic transfers can help you save more consistently.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'investing':
        return {
          insight: `Based on your financial profile, a diversified investment approach could work well for you. Consider allocating funds to a mix of low-cost index funds, bonds, and a small portion to individual stocks if you're comfortable with higher risk. 📈 Starting with a regular investment schedule, even with small amounts, can help build your portfolio over time.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'debt':
        return {
          insight: `Looking at your debt profile, I'd recommend focusing on paying off your highest interest debt first (usually credit cards) while making minimum payments on others. 💳 Based on your current income and expenses, you could potentially be debt-free within 18 months by allocating an extra $300 monthly toward debt repayment.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'tax':
        return {
          insight: `Based on your income and spending patterns, you might qualify for deductions related to retirement contributions, education expenses, and home office costs if you work remotely. 📝 Consider organizing your receipts by category now to make tax filing smoother next year.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'insurance':
        return {
          insight: `Your current insurance coverage appears to have some gaps, particularly in terms of liability protection. 🛡️ Given your asset portfolio, consider increasing coverage limits on auto and home insurance, and evaluate whether an umbrella policy might provide additional protection for a relatively small cost.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'retirement':
        return {
          insight: `Based on your current savings rate of 10%, you're on track to reach about 70% of your retirement goal by age 65. 🏖️ To improve this outlook, consider increasing your 401(k) contributions by at least 2% annually, and take full advantage of any employer match available to you.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'banking':
        return {
          insight: `Your current checking account has an average monthly fee of $15, which adds up to $180 annually. 🏦 There are several fee-free checking options available that would eliminate this cost while still providing all the services you currently use, including unlimited transactions and wide ATM access.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'credit':
        return {
          insight: `Your credit score is currently in the 'good' range at 720. 📈 To boost this into the 'excellent' range (above 750), focus on reducing your credit utilization ratio by paying down card balances and avoid applying for new credit in the next 6 months. This could help you secure better rates on future loans.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'planning':
        return {
          insight: `Based on your current financial situation, I'd recommend prioritizing three key areas: building your emergency fund to cover 6 months of expenses, increasing retirement contributions to at least 15% of income, and creating a specific plan for any major purchases in the next 5 years. 🎯`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'real_estate':
        return {
          insight: `With current interest rates and your financial profile, you could potentially qualify for a mortgage of up to $350,000 with a 20% down payment. 🏠 Given your savings rate, you could reach this down payment goal in approximately 24 months if you allocated an additional $500 monthly toward your home fund.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'crypto':
        return {
          insight: `Cryptocurrency represents a high-risk investment class that should typically comprise no more than 5-10% of your overall investment portfolio. 💱 Based on your risk profile, consider starting with established cryptocurrencies and using dollar-cost averaging to minimize the impact of volatility.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'market_analysis':
        return {
          insight: `Market indicators suggest increased volatility in the coming quarter, with defensive sectors potentially outperforming growth stocks. 📊 Given your investment goals and time horizon, maintaining your diversified position while slightly increasing cash reserves (2-3%) could provide flexibility to capitalize on potential buying opportunities.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'education':
        return {
          insight: `Financial literacy is about understanding key concepts like compound interest, diversification, and risk management. 📚 Based on your query, I'd suggest starting with resources on ${query.includes('invest') ? 'investment fundamentals' : 'personal finance basics'}, which will help build a strong foundation for making informed financial decisions.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'income':
        return {
          insight: `Your income has grown at an average rate of 3.2% annually, which is slightly above inflation but below the industry average of 4.5%. 💼 To accelerate growth, consider skill development in high-demand areas, negotiating for performance-based bonuses, or exploring side income streams that leverage your existing expertise.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'transactions':
        return {
          insight: `I've analyzed your recent transactions and noticed recurring payments to several subscription services totaling $87.45 monthly. 🧾 Some of these appear to have overlapping features, and by consolidating or eliminating underused subscriptions, you could save approximately $45 monthly without losing significant value.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'security':
        return {
          insight: `Your accounts show good basic security practices, but I recommend enabling two-factor authentication for all financial platforms and setting up alerts for transactions over $100. 🔒 Additionally, consider checking your credit report quarterly rather than annually to catch any suspicious activity early.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'forex':
        return {
          insight: `Currency exchange rates can significantly impact international transactions. Based on your travel patterns, using a credit card with no foreign transaction fees could save you approximately $120 annually. 🌐 For larger currency exchanges, comparing rates across services rather than defaulting to your bank could yield 2-3% better rates.`,
          timestamp: new Date().toISOString(),
          queryType
        };

      case 'general':
      default:
        return {
          insight: `Here's an analysis of your finances based on your query: "${query}"\n\nYour overall financial health is good. Your spending patterns show that you're managing your budget effectively, with approximately 20% of your income going to savings.\n\nYou could optimize your finances further by reviewing your subscription services, which currently account for about $75 monthly.`,
          timestamp: new Date().toISOString(),
          queryType: queryType || 'general'
        };
    }
  }

  // Helper methods for calculating financial metrics
  _calculateMonthlyIncome(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return 0;
    }

    // Filter for income transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    return userData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  _calculateMonthlyExpenses(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return 0;
    }

    // Filter for expense transactions in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    return userData.transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  _getTopExpenseCategories(userData) {
    if (!userData || !userData.transactions || !Array.isArray(userData.transactions)) {
      return [];
    }

    // Count categories for expense transactions
    const categoryCounts = {};
    userData.transactions
      .filter(t => t.amount < 0)
      .forEach(transaction => {
        if (transaction.category) {
          categoryCounts[transaction.category] =
            (categoryCounts[transaction.category] || 0) + 1;
        }
      });

    // Sort by count
    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
  }

  /**
   * Get API metrics for admin dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getApiMetrics(req, res) {
    try {
      // Check if user has admin role
      if (!req.auth || !req.auth.role || req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required for metrics'
        });
      }

      // If insights-metrics middleware is available, use it
      if (req.app.get('insightMetricsAvailable')) {
        const { getSystemInsightMetrics } = require('../middleware/insights-metrics.middleware');
        const metrics = await getSystemInsightMetrics();
        return res.status(200).json({
          success: true,
          data: metrics
        });
      }

      // Otherwise, return mock metrics
      return res.status(200).json({
        success: true,
        data: {
          totalQueries: 1432,
          successfulQueries: 1398,
          failedQueries: 34,
          successRate: '97.6%',
          avgResponseTime: 456,
          minResponseTime: 250,
          maxResponseTime: 1750,
          todayQueries: Math.floor(Math.random() * 100 + 50),
          queryTypeDistribution: {
            general: 487,
            budgeting: 302,
            saving: 276,
            spending: 201,
            investing: 89,
            debt: 77,
            tax: 55,
            retirement: 48,
            banking: 63,
            credit: 42,
            planning: 37,
            real_estate: 29,
            harmful: 5
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error retrieving API metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve API metrics'
      });
    }
  }
}

module.exports = new InsightsController();