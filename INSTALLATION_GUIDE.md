# Banking Intelligence API Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [API Endpoints](#api-endpoints)
5. [Authentication](#authentication)
6. [Data Models](#data-models)
7. [Services](#services)
8. [Development Environment Setup](#development-environment-setup)
9. [Windows Environment Configuration](#windows-environment-configuration)

## Project Overview

The Banking Intelligence API is a financial technology platform that provides AI-powered financial insights based on user transaction data. The system consists of a React-based frontend and an Express.js backend with the following key features:

- User authentication with JWT tokens
- Connection to banking data via Plaid
- AI-powered financial insights using Cohere
- Transaction categorization and analysis
- Mobile-friendly API endpoints for native applications
- Dashboard for monitoring financial health

## Frontend Architecture

### Tech Stack
- **React** - Core UI library
- **React Router** - Client-side routing
- **Bootstrap** - UI framework for styling
- **Axios** - HTTP client for API requests

### Project Structure

```
src/
  ├── components/
  │   ├── Auth/
  │   │   ├── Login.js - User login component
  │   │   └── Register.js - User registration component
  │   ├── Dashboard/
  │   │   ├── AccountSummary.js - Account summary widget
  │   │   ├── Dashboard.js - Main dashboard component
  │   │   ├── FinancialSummary.js - Financial overview widget
  │   │   ├── InsightsPanel.js - AI insights widget
  │   │   └── RecentTransactions.js - Recent transactions list
  │   ├── Documentation/
  │   │   └── Documentation.js - API documentation component
  │   ├── Layout/
  │   │   ├── Footer.js - App footer
  │   │   ├── Header.js - App header with navigation
  │   │   ├── Layout.js - Main layout wrapper
  │   │   ├── PrivateRoute.js - Protected route component
  │   │   └── Sidebar.js - Navigation sidebar
  │   ├── Plaid/
  │   │   └── PlaidLinkButton.js - Plaid connection button
  │   ├── APITokenManagement.js - API token management
  │   ├── ConnectAccounts.js - Account connection flow
  │   └── HomePage.js - Landing page component
  ├── context/
  │   └── AuthContext.js - Authentication context provider
  ├── services/
  │   ├── api.js - Axios instance for API calls
  │   ├── auth.js - Authentication service
  │   ├── insights.js - Insights API service
  │   └── mockInsights.js - Mock data for development
  ├── utils/
  │   ├── ApiCheck.js - API connection checker
  │   └── logger.js - Client-side logging utility
  ├── App.js - Main application component with routes
  ├── index.js - Application entry point
  └── index.css - Global styles
```

### Key Components

1. **Auth Components**: Handle user registration and login flows
2. **Dashboard Components**: Display financial data and insights
3. **Layout Components**: Manage the application structure and navigation
4. **Plaid Components**: Handle bank account connections

### State Management

The application uses React Context for state management, particularly for authentication state through `AuthContext.js`. This context provides:

- User authentication status
- Login/registration methods
- Token management
- User profile information

## Backend Architecture

### Tech Stack
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **Sequelize** - ORM for database interactions
- **JWT** - Token-based authentication
- **Cohere API** - AI-powered financial insights
- **Plaid API** - Banking data integration

### Project Structure

```
src/
  ├── config/
  │   └── database.js - Database configuration
  ├── controllers/
  │   ├── auth.controller.js - Authentication logic
  │   ├── insights.controller.js - Financial insights logic
  │   ├── notification.controller.js - Push notification logic
  │   ├── plaid.webhook.controller.js - Plaid webhook handling
  │   └── sync.controller.js - Mobile sync logic
  ├── middleware/
  │   ├── auth.js - JWT authentication middleware
  │   ├── errorHandler.js - Global error handler
  │   ├── mobile-optimizer.js - Mobile response optimization
  │   ├── requestLogger.js - Request logging middleware
  │   └── validation.js - Request validation middleware
  ├── models/
  │   ├── Token.js - Token database model
  │   └── User.js - User and Client database models
  ├── routes/
  │   ├── admin.routes.js - Admin dashboard routes
  │   ├── auth.routes.js - Authentication routes
  │   ├── diagnostics.routes.js - System diagnostics routes
  │   ├── health.routes.js - Health check routes
  │   ├── insights.mobile.routes.js - Mobile-specific insights routes
  │   ├── insights.routes.js - Insights API routes
  │   ├── notification.routes.js - Push notification routes
  │   ├── plaid.routes.js - Plaid integration routes
  │   ├── plaid.webhook.routes.js - Plaid webhook routes
  │   └── sync.routes.js - Mobile sync routes
  ├── services/
  │   ├── auth.js - Authentication service
  │   ├── cohere.service.js - AI insights generation
  │   ├── data.service.js - Financial data service
  │   ├── notification.service.js - Push notification service
  │   └── plaid.service.js - Plaid integration service
  ├── utils/
  │   ├── api-diagnostics.js - API diagnostic tools
  │   ├── env-helper.js - Environment configuration helper
  │   └── logger.js - Server-side logging utility
  ├── migrations/
  │   ├── seed.js - Database seed script
  │   └── setup.js - Database setup script
  └── server.js - Main server entry point
```

### Key Components

1. **Controllers**: Handle request processing and response generation
2. **Middleware**: Process requests before they reach route handlers
3. **Models**: Define database schemas and relationships
4. **Routes**: Define API endpoints and map them to controllers
5. **Services**: Contain business logic and external API integrations

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate a user and get token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and revoke tokens
- `POST /api/auth/change-password` - Change user password
- `POST /api/auth/change-secret` - Change client secret
- `POST /api/auth/generate-token` - Generate an API token

### Financial Insights

- `POST /api/insights/generate` - Generate personalized financial insights
- `GET /api/insights/summary` - Get financial summary for the user

### Plaid Integration

- `POST /api/plaid/create-link-token` - Create a Plaid Link token
- `POST /api/plaid/exchange-public-token` - Exchange public token for access token
- `GET /api/plaid/accounts` - Get user's bank accounts
- `GET /api/plaid/transactions` - Get user's transactions

### Mobile-Specific API

- `GET /api/v1/mobile/financial-snapshot` - Get lightweight financial summary
- `POST /api/v1/mobile/quick-insight` - Get a short insight for mobile display
- `POST /api/v1/notifications/register-device` - Register a device for push notifications
- `POST /api/v1/notifications/unregister-device` - Unregister a device
- `PUT /api/v1/notifications/preferences` - Update notification preferences
- `GET /api/v1/sync/package` - Get a sync package for offline use
- `POST /api/v1/sync/changes` - Process changes from mobile client

### System & Diagnostics

- `GET /api/health` - Health check endpoint
- `GET /api/diagnostics/database` - Check database status (admin only)
- `GET /api/diagnostics/env` - Check environment configuration (admin only)
- `GET /api/diagnostics/app` - Get application diagnostics (admin only)

## Authentication

The application uses JWT (JSON Web Token) for authentication with the following token types:

1. **Access Token**: Short-lived token for API access (default 1 hour)
2. **Refresh Token**: Long-lived token to obtain new access tokens (default 7 days)
3. **API Token**: Used for API access from external applications (default 30 days)

### Authentication Flow

1. **User Registration**:
   - User submits registration form with client name, email, and password
   - System creates user account and generates client credentials
   - Returns client ID and client secret to the user

2. **User Login**:
   - User submits email/password or clientId/clientSecret
   - System validates credentials and issues access and refresh tokens
   - Tokens are stored in localStorage on the client

3. **Token Refresh**:
   - When access token expires, client uses refresh token to obtain a new one
   - If refresh token is invalid or expired, user must login again

4. **API Authentication**:
   - API clients authenticate using client credentials
   - System issues an API token for subsequent requests
   - API token is included in the Authorization header

## Data Models

### User Model

```javascript
User = {
  id: UUID,
  clientName: String,
  email: String,
  passwordHash: String,
  description: String,
  status: Enum('active', 'inactive', 'suspended'),
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Client Model

```javascript
Client = {
  id: UUID,
  userId: UUID,
  clientId: String,
  clientSecret: String,
  description: String,
  status: Enum('active', 'inactive', 'revoked'),
  lastUsedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Token Model

```javascript
Token = {
  id: UUID,
  userId: UUID,
  clientId: String,
  tokenType: Enum('access', 'refresh', 'api'),
  token: String,
  expiresAt: Date,
  isRevoked: Boolean,
  lastUsedAt: Date,
  ipAddress: String,
  userAgent: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Financial Data Models

The application uses the following models to represent financial data from Plaid:

```javascript
Account = {
  accountId: String,
  userId: String,
  name: String,
  type: String,
  subtype: String,
  balance: Number,
  availableBalance: Number,
  currency: String,
  mask: String,
  officialName: String
}

Transaction = {
  transactionId: String,
  userId: String,
  accountId: String,
  date: Date,
  description: String,
  amount: Number,
  category: String,
  subCategory: String,
  type: Enum('income', 'expense', 'transfer'),
  merchantName: String,
  location: String,
  pending: Boolean
}
```

## Services

### Authentication Service (auth.js)

Handles user registration, login, token generation, and validation.

### Data Service (data.service.js)

Retrieves and processes financial data, either from Plaid or from mock data for development.

### Cohere Service (cohere.service.js)

Integrates with the Cohere API to generate AI-powered financial insights based on user data.

### Plaid Service (plaid.service.js)

Manages communication with the Plaid API for bank account connections and transaction retrieval.

### Notification Service (notification.service.js)

Handles push notifications for mobile devices using Firebase Cloud Messaging and Apple Push Notification service.

## Development Environment Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- SQLite (development) or PostgreSQL (production)

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```
   cd client
   npm install
   ```
3. Install backend dependencies:
   ```
   cd server
   npm install
   ```
4. Set up environment variables:
   ```
   cp .env.example .env
   ```
5. Set up the database:
   ```
   npm run setup-db
   npm run seed-db
   ```
6. Start the development servers:
   ```
   # Backend
   npm run dev
   
   # Frontend
   cd client
   npm start
   ```

## Windows Environment Configuration

When running the application on Windows, there are specific considerations for environment variables and port configuration.

### Setting Port in Windows

#### Create a .env file (Recommended)

Create a file named `.env` in your project root directory with the content:
```
PORT=3001
```

Then simplify your start script to:
```json
"start": "node scripts/create-logs-dir.js && react-scripts start"
```

### API Configuration for Windows

In the `api.js` file, ensure the API_URL is correctly pointing to your backend:

```javascript
// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
```

### CORS Configuration for Windows

Ensure that your backend's CORS configuration in `server.js` allows requests from your frontend:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com' 
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

These configurations will ensure that your Banking Intelligence API application runs smoothly on Windows environments with the frontend communicating correctly with the backend.

Support
For support, contact us at sreenivas@vivytech.com or create an issue on GitHub.

© 2025 VIVY TECH USA INC. All rights reserved.
