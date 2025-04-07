// src/services/mockInsights.js
import logger from '../utils/logger';

// Mock data generator
const generateMockData = () => ({
  totalBalance: 25000.75,
  netWorth: 50000.25,
  accounts: [
    { 
      accountId: '1', 
      name: 'Checking Account', 
      type: 'Checking', 
      balance: 10000.50 
    },
    { 
      accountId: '2', 
      name: 'Savings Account', 
      type: 'Savings', 
      balance: 15000.25 
    }
  ],
  recentTransactions: [
    {
      transactionId: 't1',
      date: new Date().toISOString(),
      description: 'Grocery Shopping',
      category: 'Groceries',
      amount: -125.50
    },
    {
      transactionId: 't2',
      date: new Date().toISOString(),
      description: 'Salary Deposit',
      category: 'Income',
      amount: 5000.00
    }
  ]
});

export const mockInsightsService = {
  getFinancialSummary: async () => {
    logger.info('Using MOCK Financial Summary');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateMockData());
      }, 500); // Simulate network delay
    });
  },

  generateInsights: async (query) => {
    logger.info('Using MOCK Insights Generation', { query });
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          timestamp: new Date().toISOString(),
          insights: {
            insight: `**Financial Insight for query:** "${query}"\n\nThis is a mock insight generated for your query. In a real application, this would provide personalized financial advice.`
          }
        });
      }, 300);
    });
  }
};