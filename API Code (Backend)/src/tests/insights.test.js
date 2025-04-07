const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');

// Import the mock directly to check it
const { generateInsights } = require('../services/cohere.service');

// Mock services
jest.mock('../services/cohere.service', () => ({
  generateInsights: jest.fn().mockResolvedValue({
    insight: 'Mock financial insight',
    timestamp: new Date().toISOString()
  })
}));

jest.mock('../services/database.service', () => ({
  getUserFinancialData: jest.fn().mockResolvedValue({
    userId: 'test-user',
    accounts: [
      { accountId: 'acc-1', type: 'Checking', balance: 1000 }
    ],
    transactions: [
      { transactionId: 'txn-1', amount: -50, category: 'Food' }
    ],
    userProfile: { name: 'Test User' }
  })
}));

afterAll(async () => {
  // Ensure app shuts down cleanly
  if (app.close) {
    await app.close();
  }
});

describe('Insights API Endpoints', () => {
  let authToken;

  beforeAll(() => {
    // Create a test token
    authToken = jwt.sign(
      { userId: 'test-user', role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/insights/generate', () => {
    it('should generate insights when valid data is provided', async () => {
      const response = await request(app)
        .post('/api/insights/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'How can I save money?' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('insights');
      expect(response.body.data.query).toBe('How can I save money?');

      // Check if the mock function was called with the correct arguments
      expect(generateInsights).toHaveBeenCalledWith({
        query: 'How can I save money?',
        accounts: [
          { accountId: 'acc-1', type: 'Checking', balance: 1000 }
        ],
        transactions: [
          { transactionId: 'txn-1', amount: -50, category: 'Food' }
        ],
        userId: 'test-user',
        userProfile: { name: 'Test User' }
      });

      // Optionally, check that the mock returns the expected value
      const result = await generateInsights.mock.results[0].value;
      expect(result).toEqual({
        insight: 'Mock financial insight',
        timestamp: expect.any(String)
      });
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .post('/api/insights/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when token is missing', async () => {
      const response = await request(app)
        .post('/api/insights/generate')
        .send({ query: 'How can I save money?' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/insights/summary', () => {
    it('should return financial summary for authenticated user', async () => {
      const response = await request(app)
        .get('/api/insights/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalBalance');
      expect(response.body.data).toHaveProperty('recentTransactions');
    });
  });
});
