# Connecting Your Frontend to the Banking Intelligence API

This guide provides detailed instructions for connecting the React frontend to your Banking Intelligence API.

## Prerequisites

Before you begin, ensure you have:

1. Banking Intelligence API running locally or in a production environment
2. React frontend project set up and running
3. Administrative access to configure environment variables

## Step 1: Configure Environment Variables

In your frontend project, create or modify the `.env` file:

```
# Development
REACT_APP_API_URL=http://localhost:3000/api

# For production, uncomment and update with your production API URL
# REACT_APP_API_URL=https://your-api-domain.com/api
```

## Step 2: Configure CORS on Your Backend

To allow your frontend to communicate with your backend API, you need to enable CORS. Add this to your Express server:

```javascript
// server.js (backend)
const cors = require('cors');

// Configure CORS to allow requests from your frontend
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-frontend-domain.com' 
    : 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));
```

## Step 3: Test Authentication Flow

1. Register a new client:
   - Test the registration endpoint by visiting `/register` in your frontend
   - Fill in client details and submit the form
   - Save the client ID and secret that are returned

2. Test login:
   - Visit the `/login` route
   - Use the client ID and secret obtained from registration
   - Verify that you receive a JWT token and are redirected to the dashboard

## Step 4: Verify API Integration

1. Open your browser's developer tools (F12)
2. Navigate to the Network tab
3. Use your application and observe the API calls being made
4. Verify that:
   - Requests include the Authorization header with your JWT token
   - Responses have the expected format
   - No CORS errors are occurring

## Step 5: Database Connection (Backend)

Make sure your backend is properly connected to MongoDB by updating the database service:

```javascript
// database.service.js
const mongoose = require('mongoose');
const dbConnection = require('../utils/db-connection');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const UserProfile = require('../models/UserProfile');
const SpendingPattern = require('../models/SpendingPattern');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }
  
  async initialize() {
    try {
      if (this.isConnected) {
        return;
      }
      
      await dbConnection.connect();
      this.isConnected = true;
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }
  
  async getUserFinancialData(userId) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }
      
      // Get user profile
      const userProfile = await UserProfile.findOne({ userId });
      
      // Get accounts
      const accounts = await Account.find({ userId });
      
      // Get recent transactions
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const transactions = await Transaction.find({
        userId,
        date: { $gte: threeMonthsAgo }
      }).sort({ date: -1 }).limit(100);
      
      return {
        userId,
        userProfile: userProfile?.toObject() || null,
        accounts: accounts.map(acc => acc.toObject()),
        transactions: transactions.map(txn => txn.toObject())
      };
    } catch (error) {
      logger.error(`Error fetching data for user ${userId}:`, error);
      throw new Error('Failed to retrieve user financial data');
    }
  }
  
  // Keep the mock data method for fallback and testing
  _getMockUserData(userId) {
    // Your existing mock implementation
    return {
      userId,
      // ...mock data...
    };
  }
}

module.exports = new DatabaseService();
```

## Step 6: API Health Check

Create a health check endpoint to monitor your API connection:

```javascript
// health.routes.js (backend)
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not connected'
      });
    }
    
    // Check Cohere API key is set
    if (!process.env.COHERE_API_KEY) {
      return res.status(500).json({
        status: 'error',
        message: 'Cohere API key not configured'
      });
    }
    
    // All checks passed
    return res.status(200).json({
      status: 'healthy',
      details: {
        database: 'connected',
        api: 'running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      details: { error: error.message }
    });
  }
});

module.exports = router;
```

Add this route to your Express app:

```javascript
// server.js
const healthRoutes = require('./routes/health.routes');
app.use('/api', healthRoutes);
```

## Step 7: Testing the Integration

1. Create a test script to verify the entire flow:

```javascript
// test-integration.js
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
let authToken = null;
let clientId = null;
let clientSecret = null;

async function testIntegration() {
  try {
    console.log('Starting integration test...');
    
    // 1. Check API health
    console.log('Testing API health...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('Health check status:', healthResponse.data.status);
    
    // 2. Register a test client
    console.log('Registering test client...');
    const regResponse = await axios.post(`${API_URL}/auth/register`, {
      clientName: 'Test Integration Client',
      description: 'Created for integration testing'
    });
    
    if (!regResponse.data.success) {
      throw new Error('Registration failed');
    }
    
    clientId = regResponse.data.data.clientId;
    clientSecret = regResponse.data.data.clientSecret;
    console.log('Client registered successfully:', clientId);
    
    // 3. Login with new client
    console.log('Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      clientId,
      clientSecret
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }
    
    authToken = loginResponse.data.data.accessToken;
    console.log('Login successful, token obtained');
    
    // 4. Get financial summary
    console.log('Getting financial summary...');
    const summaryResponse = await axios.get(`${API_URL}/insights/summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (!summaryResponse.data.success) {
      throw new Error('Failed to get financial summary');
    }
    
    console.log('Financial summary obtained');
    
    // 5. Generate insights
    console.log('Generating insights...');
    const insightsResponse = await axios.post(
      `${API_URL}/insights/generate`,
      { query: 'How is my spending this month?' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (!insightsResponse.data.success) {
      throw new Error('Failed to generate insights');
    }
    
    console.log('Insights generated successfully');
    
    console.log('✅ All tests passed! Integration is working correctly.');
  } catch (error) {
    console.error('❌ Integration test failed:', error.response?.data || error.message);
  }
}

testIntegration();
```

2. Run the test script:
```bash
node test-integration.js
```

## Common Issues and Solutions

### CORS Errors

If you see CORS errors in your browser console:

```
Access to XMLHttpRequest at 'http://localhost:3000/api/auth/login' from origin 'http://localhost:3001' has been blocked by CORS policy
```

Make sure your backend has CORS correctly configured:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
}));
```

### JWT Authentication Issues

If authentication isn't working:

1. Check that you're storing tokens correctly:
```javascript
// In your auth.service.js
localStorage.setItem('token', data.accessToken);
```

2. Verify your axios interceptor is setting the Auth header:
```javascript
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
```

### Database Connection Issues

If you're having database connectivity problems:

1. Ensure MongoDB is running: `sudo systemctl status mongodb`

2. Check your connection string in `.env`:
```
MONGODB_LOCAL_URI=mongodb://localhost:27017/banking-intelligence
```

3. Verify your connection code:
```javascript
mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

## Production Deployment Considerations

When going to production:

1. Use environment variables for sensitive information
2. Set up proper CORS restrictions to only allow your frontend domain
3. Consider using a managed MongoDB service like MongoDB Atlas or AWS DocumentDB
4. Set up proper logging and monitoring
5. Use HTTPS for all communications between frontend and backend

## Next Steps

1. Implement additional functionality on the frontend:
   - Account management
   - Transaction history with filtering and search
   - Spending pattern visualization
   - Budgeting tools

2. Enhance backend security:
   - Rate limiting for API endpoints
   - Input validation and sanitization
   - Token refresh mechanisms
   - Request logging and monitoring