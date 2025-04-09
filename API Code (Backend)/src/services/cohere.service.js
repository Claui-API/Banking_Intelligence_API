// cohere.service.js with greeting prompt handling
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

class CohereService {
  constructor() {
    // Store API key
    this.apiKey = process.env.COHERE_API_KEY;
  }

  async generateInsights(userData) {
    try {
      // Extract query and isGreeting flag
      const { query, isGreeting } = userData;
      
      // Create different prompts based on whether this is a greeting or financial query
      const prompt = isGreeting ? 
        this._createGreetingPrompt(userData) : 
        this._createInsightsPrompt(userData); 

      // Log the API call
      logger.info('Calling Cohere API for insights', {
        apiKeyPresent: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        isGreeting: isGreeting,
        query: query,
        environment: process.env.NODE_ENV
      });
      
      // Configure API call based on greeting vs financial query
      const apiConfig = {
        model: 'command-r-plus-08-2024',
        message: prompt,
        max_tokens: isGreeting ? 200 : 800,  // Shorter for greetings
        temperature: isGreeting ? 0.2 : 0.3   // More variety for greetings
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

      // Process the response, marking greeting responses appropriately
      return this._processResponse(generatedText, isGreeting);
    } catch (error) {
      // Enhanced error logging with more context
      logger.error('Error generating insights:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        query: userData.query,
        isGreeting: userData.isGreeting,
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
      
      throw new Error('Failed to generate financial insights: ' + error.message);
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

  _createInsightsPrompt(userData) {
    // Standard financial insights prompt
    const userDataSummary = this._formatUserDataSummary(userData);
    
    return `
      You are CLAU, an advanced AI banking assistant with deep financial expertise. Answer this specific question: "${userData.query}"
      
      Financial data: ${userDataSummary}
      
      GUIDELINES:
      1. Respond in a conversational, helpful tone like a trusted financial advisor
      2. Use emojis occasionally to make your response friendly
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

  _processResponse(rawResponse, isGreeting) {
    return {
      insight: rawResponse.trim(),
      timestamp: new Date().toISOString(),
      isGreeting: isGreeting
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