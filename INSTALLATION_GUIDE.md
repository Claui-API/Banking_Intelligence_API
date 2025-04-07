# Installation Guide

This guide provides instructions for setting up and running both the backend API and frontend application for the Banking Intelligence Platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Complete Application](#running-the-complete-application)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before installing the application, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** (v6 or higher) or **yarn**
- **MongoDB** (local installation or MongoDB Atlas account)
- **Git** (for cloning the repository)

## Backend Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Claui-API/API-Main.git
cd API-Main/API Code (Backend)
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Using yarn:
```bash
yarn install
```

This will install all the dependencies listed in the backend's `package.json` file:

```json
"dependencies": {
  "@sentry/node": "^9.5.0",
  "aws-sdk": "^2.1692.0",
  "cohere-ai": "^7.15.4",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "express-rate-limit": "^6.7.0",
  "helmet": "^6.1.0",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.14.1",
  "mongoose": "^8.12.0",
  "plaid": "^31.1.0",
  "winston": "^3.17.0"
}
```

### 3. Set Up Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
# Server configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/banking-intelligence
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/banking-intelligence

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_token_secret_key_here
JWT_EXPIRY=2h
JWT_REFRESH_EXPIRY=7d

# Cohere API (for AI insights)
COHERE_API_KEY=your_cohere_api_key_here

# Plaid Configuration (for bank connections)
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_secret_here
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=https://your-domain.com/api/webhooks/plaid
# For local testing with Plaid webhooks, you can use ngrok

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
```

### 4. Start the Backend Server

For development with auto-restart (What we'd be using):
```bash
npm run dev
```

For production:
```bash
npm start
```

The backend server will start on the port specified in your `.env` file (default: 3000).

## Frontend Setup

### 1. Navigate to the Frontend Directory

```bash
cd ../API UI (Frontend)
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Using yarn:
```bash
yarn install
```

This will install all the dependencies listed in the frontend's `package.json` file:

```json
"dependencies": {
  "axios": "^1.6.7",
  "bootstrap": "^5.3.3",
  "jwt-decode": "^4.0.0",
  "react": "^18.3.1",
  "react-bootstrap": "^2.10.9",
  "react-dom": "^18.3.1",
  "react-plaid-link": "^3.6.1",
  "react-router-dom": "^7.3.0",
  "react-scripts": "^5.0.1",
  "web-vitals": "^4.2.4",
  "winston": "^3.17.0",
  "winston-daily-rotate-file": "^5.0.0"
}
```

### 3. Set Up Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```
REACT_APP_API_URL=http://localhost:3000/api
```

### 4. Start the Frontend Development Server

```bash
npm start
```

The frontend application will start on port 3001 and should automatically open in your default web browser.

## Running the Complete Application

To run both the backend and frontend together:

1. Start the backend server (Terminal 1):
```bash
cd backend
npm run dev
```

2. Start the frontend application (Terminal 2):
```bash
cd frontend
npm start
```

You should now be able to access:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api

## Building for Production

### Backend
```bash
cd backend
npm install --production
```

### Frontend
```bash
cd frontend
npm run build
```

This will create a production-ready build in the `build` directory.

## Troubleshooting

### Common Issues

#### "MongoDB Connection Error"
- Ensure MongoDB is running
- Check your MongoDB connection string in `.env`
- Verify network connectivity to MongoDB Atlas (if using cloud)

#### "Invalid API Key" with Cohere
- Verify your Cohere API key in the backend `.env` file
- Check if the key has enough quota remaining

#### "Cross-Origin Request Blocked"
- Ensure the backend CORS settings are correctly configured
- Check that the frontend is connecting to the correct API URL

#### "Cannot find module"
- Run `npm install` again in the affected directory
- Check if the package is listed in your package.json

#### "JWT Malformed"
- Check your JWT_SECRET in the backend .env
- Ensure tokens are being properly generated and stored

### Debugging

#### Backend
To run the backend in debug mode with extra logging:
```bash
LOG_LEVEL=debug npm run dev
```

#### Frontend
For detailed frontend logging, open the browser's developer console.

## Support

If you encounter any issues not covered by this guide, please contact me at sreenivas@vivytech.com or create an issue on GitHub.

---

&copy; 2025 VIVY TECH USA INC. All rights reserved.
