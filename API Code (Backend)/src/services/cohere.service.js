// Enhanced cohere.service.js with specialized prompts for different query types
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const fetch = require('node-fetch');

dotenv.config();

class CohereService {
  constructor() {
    // Store API key
    this.apiKey = process.env.COHERE_API_KEY;
  }

  async generateInsights(userData) {
    try {
      // Extract query and queryType
      const { query, queryType } = userData;
      
      // Select the appropriate prompt based on query type
      let prompt;
      let maxTokens = 800;  // Default token limit
      let temperature = 0.3; // Default temperature
      
      switch(queryType) {
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
          maxTokens = 900;  // Slightly longer for investment advice
          temperature = 0.3;
          break;
        case 'debt':
          prompt = this._createDebtPrompt(userData);
          maxTokens = 800;
          temperature = 0.3;
          break;
        default:
          // Default to general financial insights prompt
          prompt = this._createInsightsPrompt(userData);
          maxTokens = 800;
          temperature = 0.3;
      }

      // Log the API call
      logger.info('Calling Cohere API for insights', {
        apiKeyPresent: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        queryType: queryType,
        query: query,
        environment: process.env.NODE_ENV
      });
      
      // Configure API call based on query type
      const apiConfig = {
        model: 'command-r-plus-08-2024',
        message: prompt,
        max_tokens: maxTokens,
        temperature: temperature
      };
      
      // Call the Cohere API
      const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Cohere-Version': '2023-05-24'
        },
        body: JSON.stringify(apiConfig)
      });

      if (!response.ok) {
        try {
          // Try to parse the error response as JSON for more details
          const errorResponse = await response.json();
          logger.error('Cohere API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorResponse,
            headers: Object.fromEntries([...response.headers.entries()]),
            url: response.url
          });
          throw new Error(`Cohere API error: ${errorResponse.message || response.statusText}`);
        } catch (parseError) {
          // If can't parse JSON, use text
          const errorText = await response.text();
          logger.error('Cohere API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            headers: Object.fromEntries([...response.headers.entries()]),
            url: response.url
          });
          throw new Error(`Cohere API responded with status ${response.status}: ${errorText || response.statusText}`);
        }
      }

      const data = await response.json();
      logger.debug('Cohere API Response:', JSON.stringify(data, null, 2));
      
      // Extract the generated text, handling different response formats
      let generatedText = '';
      
      if (data.text) {
        // New format
        generatedText = data.text;
      } else if (data.generations && data.generations[0]?.text) {
        // Old format
        generatedText = data.generations[0].text;
      } else if (data.chat_history && data.chat_history.length > 0) {
        // Handle chat history format
        const lastMessage = data.chat_history[data.chat_history.length - 1];
        if (lastMessage.role === 'CHATBOT' || lastMessage.role === 'ASSISTANT') {
          generatedText = lastMessage.message;
        }
      }

      if (!generatedText) {
        logger.error('Could not extract text from Cohere API response', data);
        throw new Error('Could not extract text from Cohere API response');
      }

      // Process the response
      return this._processResponse(generatedText, queryType);
    } catch (error) {
      // Enhanced error logging with more context
      logger.error('Error generating insights:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        query: userData.query,
        queryType: userData.queryType,
        apiKey: this.apiKey ? '✓ API key is set' : '✗ API key is missing',
        userData: {
          hasAccounts: !!(userData && userData.accounts && userData.accounts.length),
          hasTransactions: !!(userData && userData.transactions && userData.transactions.length),
          totalAccounts: userData && userData.accounts ? userData.accounts.length : 0,
          totalTransactions: userData && userData.transactions ? userData.transactions.length : 0
        },
        environment: process.env.NODE_ENV
      });
      
      // Add request retry information in case of network issues
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        logger.error('Network error when calling Cohere API. Please check your internet connection and firewall settings.');
      }
      
      // Add API key validation suggestions
      if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('authentication')) {
        logger.error('Authentication error with Cohere API. Please verify your API key is correct and active.');
      }
      
      throw new Error('Failed to generate insights: ' + error.message);
    }
  }

  _createGreetingPrompt(userData) {
    const userName = userData?.userProfile?.name || 'there';
    
    return `
      You are CLAU, a friendly and fun AI banking assistant. The user has just greeted you with: "${userData.query}"
      
      RESPOND STRICTLY FOLLOWING THESE GUIDELINES:
      1. Your response MUST be casual, warm, and conversational - like texting a friend
      2. Your response MUST be short - no more than 2-3 sentences MAXIMUM
      3. Include 1-2 emojis in your response to show personality
      4. ABSOLUTELY NO financial details or analysis - this is just a greeting
      5. DO NOT mention accounts, balances, transactions, or any financial metrics
      6. DO NOT offer financial advice or suggestions
      7. Use the user's name (${userName}) in your greeting
      8. End with a simple, open-ended question like "How can I help you today?" or "What would you like to know about your finances?"
      
      Remember: Your response must be BRIEF, CASUAL, and contain NO financial details whatsoever.
    `;
  }

  _createJokePrompt(userData) {
    const userName = userData?.userProfile?.name || 'there';
    
    return `
      You are CLAU, a friendly and fun AI banking assistant. The user has asked you for a joke: "${userData.query}"
      
      RESPOND STRICTLY FOLLOWING THESE GUIDELINES:
      1. Your response MUST include a clean, family-friendly joke that is preferably related to money, banking, finances, or similar topics
      2. Keep the joke short and punchy - no lengthy setups
      3. Include 1-2 emojis to emphasize the fun nature of the joke
      4. After the joke, add a brief, friendly sentence asking how you can help with their finances
      5. DO NOT include any personal financial analysis or data
      6. Use the user's name (${userName}) if appropriate, but don't force it
      7. The total response should be a maximum of 4 sentences (joke + follow-up)
      
      Remember: This should be a light-hearted moment before getting back to financial assistance.
    `;
  }

  _createBudgetingPrompt(userData) {
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. The user has asked for budgeting help: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Respond in a conversational, helpful tone like a trusted financial advisor
      2. Focus specifically on BUDGETING advice based on their financial data and query
      3. Recommend a specific budget breakdown (e.g., 50/30/20 or custom percentages)
      4. Include exact dollar amounts for each budget category based on their income
      5. Identify 1-2 specific areas where they could optimize their budget based on spending patterns
      6. Suggest a concrete next step or action item to improve their budgeting
      7. Use emojis to highlight key points
      8. Keep your response actionable and practical
      
      Use their specific financial data to make your budget recommendations personally relevant.
    `;
  }

  _createSpendingPrompt(userData) {
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. The user has asked about their spending: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Start with a clear breakdown of their top spending categories with exact dollar amounts
      2. Compare current spending to previous periods if data is available
      3. Identify any unusual or higher-than-normal spending categories
      4. Calculate what percentage of their income goes to each major spending category
      5. Suggest 1-2 specific areas where they could reduce spending with estimated savings amounts
      6. Use a friendly but data-driven tone, like a helpful financial analyst
      7. Include relevant visualizations if needed (charts, graphs)
      8. End with an actionable tip related to their specific spending patterns
      9. Use emojis to highlight key points
      
      Focus on providing clear spending insights with specific numbers and percentages.
    `;
  }

  _createSavingPrompt(userData) {
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. The user has asked about saving money: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Calculate their current savings rate as a percentage of income
      2. Identify specific opportunities to increase savings based on their spending patterns
      3. Suggest an optimal savings target with specific dollar amounts
      4. Recommend 2-3 practical strategies to boost savings with estimated impact amounts
      5. If they have recurring subscriptions, identify potential savings from consolidation or cancellation
      6. Explain the impact of increasing their savings rate by 5% with actual dollar figures
      7. Use an encouraging, positive tone focused on progress
      8. Use emojis to highlight key points
      
      Make all savings recommendations concrete with specific dollar amounts based on their data.
    `;
  }

  _createInvestingPrompt(userData) {
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. The user has asked about investing: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Assess their current financial situation for investment readiness
      2. Provide general investment education without specific stock recommendations
      3. Explain investment concepts relevant to their query in simple, clear language
      4. Suggest appropriate investment vehicles based on their likely goals (retirement, short-term, etc.)
      5. Explain the relationship between risk, return, and time horizon
      6. Calculate what percentage of their income or savings could reasonably go to investments
      7. Use a balanced, educational tone focused on principles rather than specific products
      8. Include relevant concepts like compound interest, diversification, or dollar-cost averaging if appropriate
      9. Use emojis to highlight key points
      
      Remember: Provide educational content about investing principles without recommending specific securities.
    `;
  }

  _createDebtPrompt(userData) {
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. The user has asked about debt management: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Analyze their current debt situation with specific balances and interest rates if available
      2. Calculate their debt-to-income ratio and explain its significance
      3. Recommend a specific debt repayment strategy (snowball, avalanche, or consolidation)
      4. Provide a timeline for debt repayment with monthly payment amounts
      5. Identify opportunities to reduce interest costs through refinancing or balance transfers
      6. Suggest 1-2 specific actions they could take immediately to improve their debt situation
      7. Use a supportive, non-judgmental tone focused on practical solutions
      8. Include specific dollar amounts and timeframes in your recommendations
      9. Use emojis to highlight key points
      
      Focus on practical, actionable debt management advice specific to their financial situation.
    `;
  }

  _createInsightsPrompt(userData) {
    // Standard financial insights prompt for other financial queries
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. Answer this specific question: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Respond in a conversational, helpful tone like a trusted financial advisor
      2. Use emojis
      3. Incorporate specific numbers, dates and financial details from the user's data
      4. For spending questions, provide specific dollar recommendations
      5. Reference relevant transactions, account balances, and upcoming bills
      6. Include exact dollar amounts, not general ranges
      7. For improvement suggestions, offer 2-3 concrete actionable steps
      8. Always directly address their specific question first
      
      Use the specific details from their financial data to make your answer personally relevant.
    `;
  }

  _formatUserDataSummary(userData = {}) {
    const transactions = Array.isArray(userData.transactions) ? userData.transactions : [];
    const accounts = Array.isArray(userData.accounts) ? userData.accounts : [];
    const userProfile = userData.userProfile || {};
    
    // Calculate total balance with null checking
    const totalBalance = accounts.reduce((sum, account) => {
      return sum + ((account && typeof account.balance === 'number') ? account.balance : 0);
    }, 0);
    
    // Calculate monthly income & expenses
    const monthlyIncome = this._calculateMonthlyIncome(transactions);
    const monthlyExpenses = this._calculateMonthlyExpenses(transactions);
    
    // Get top expense categories and recurring subscriptions
    const topExpenses = this._getTopExpenseCategories(transactions);
    const recurringSubs = this._getRecurringSubscriptions(transactions);

    return `
      User Profile: ${userProfile.name || 'N/A'}, Age: ${userProfile.age || 'N/A'}
      Total Balance Across All Accounts: $${totalBalance.toFixed(2)}
      Monthly Income: $${monthlyIncome.toFixed(2)}
      Monthly Expenses: $${monthlyExpenses.toFixed(2)}
      Top Expense Categories: ${topExpenses.join(', ') || 'None'}
      Recurring Subscriptions: ${recurringSubs.join(', ') || 'None'}
    `;
  }

  _processResponse(rawResponse, queryType) {
    return {
      insight: rawResponse.trim(),
      timestamp: new Date().toISOString(),
      queryType: queryType
    };
  }

  _calculateMonthlyIncome(transactions) {
    if (!Array.isArray(transactions)) return 0;
    
    return transactions
      .filter(t => t && typeof t.amount === 'number' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  _calculateMonthlyExpenses(transactions) {
    if (!Array.isArray(transactions)) return 0;
    
    return transactions
      .filter(t => t && typeof t.amount === 'number' && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  _getTopExpenseCategories(transactions) {
    if (!Array.isArray(transactions)) return [];
    
    const categorySums = transactions.reduce((acc, t) => {
      if (t && typeof t.amount === 'number' && t.amount < 0 && t.category) {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      }
      return acc;
    }, {});
    
    return Object.entries(categorySums)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
      .slice(0, 3);
  }

  _getRecurringSubscriptions(transactions) {
    if (!Array.isArray(transactions)) return [];
    
    return [...new Set(transactions
      .filter(t => t && typeof t.amount === 'number' && typeof t.description === 'string' && 
               t.amount < 0 && /subscription|monthly/i.test(t.description))
      .map(t => t.description))];
  }
}

module.exports = new CohereService();
module.exports._createGreetingPrompt = CohereService.prototype._createGreetingPrompt;
module.exports._createJokePrompt = CohereService.prototype._createJokePrompt;
module.exports._createBudgetingPrompt = CohereService.prototype._createBudgetingPrompt;
module.exports._createSpendingPrompt = CohereService.prototype._createSpendingPrompt;
module.exports._createSavingPrompt = CohereService.prototype._createSavingPrompt;
module.exports._createInvestingPrompt = CohereService.prototype._createInvestingPrompt;
module.exports._createDebtPrompt = CohereService.prototype._createDebtPrompt;
module.exports._createInsightsPrompt = CohereService.prototype._createInsightsPrompt;