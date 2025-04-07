// src/components/Documentation/Documentation.js
import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';

const Documentation = () => {
  const [activeKey, setActiveKey] = useState('getting-started');
  
  return (
    <Container className="py-5">
      <h1 className="mb-5 text-white">API Documentation</h1>
      
      <Row>
        <Col md={3} className="mb-4 mb-md-0">
          <Nav variant="pills" className="flex-column bg-dark rounded p-3" onSelect={setActiveKey}>
            <Nav.Item>
              <Nav.Link eventKey="getting-started" className="text-light">
                Getting Started
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="authentication" className="text-light">
                Authentication
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="endpoints" className="text-light">
                API Endpoints
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="data-models" className="text-light">
                Data Models
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="code-examples" className="text-light">
                Code Examples
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="rate-limits" className="text-light">
                Rate Limits
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
        
        <Col md={9}>
          <Tab.Content className="bg-dark rounded p-4 text-light">
            <Tab.Pane eventKey="getting-started" active={activeKey === 'getting-started'}>
              <h2 className="mb-4">Getting Started</h2>
              <p>
                Welcome to the CLAU Banking Intelligence API documentation. This guide will help you integrate 
                our financial insights API into your application.
              </p>
              
              <h3 className="mt-4 mb-3">Overview</h3>
              <p>
                The CLAU Banking Intelligence API allows you to provide AI-powered financial insights to your 
                users based on their transaction data and account information.
              </p>
              
              <h3 className="mt-4 mb-3">Quick Start</h3>
              <ol>
                <li className="mb-2"><span className="text-success fw-bold">Sign up</span> for an API key</li>
                <li className="mb-2"><span className="text-success fw-bold">Authenticate</span> your requests using your API key</li>
                <li className="mb-2"><span className="text-success fw-bold">Send</span> user financial data to our API</li>
                <li className="mb-2"><span className="text-success fw-bold">Request</span> insights based on the data</li>
                <li className="mb-2"><span className="text-success fw-bold">Display</span> the insights in your application</li>
              </ol>
              
              <h3 className="mt-4 mb-3">Base URL</h3>
              <div className="bg-black p-3 rounded mb-4">
                <code className="text-success">https://api.banking-intelligence.com/v1</code>
              </div>
            </Tab.Pane>
            
            <Tab.Pane eventKey="authentication" active={activeKey === 'authentication'}>
              <h2 className="mb-4">Authentication</h2>
              <p>
                The Banking Intelligence API uses API keys for authentication. All API requests must include
                your API key in the Authorization header.
              </p>
              
              <h3 className="mt-4 mb-3">Using Your API Key</h3>
              <p>
                Include your API key in the Authorization header of all API requests:
              </p>
              <div className="bg-black p-3 rounded mb-4">
                <code className="text-success">Authorization: Bearer YOUR_API_KEY</code>
              </div>
              
              <h3 className="mt-4 mb-3">Example Request</h3>
              <pre className="bg-black p-3 rounded">
{`curl -X POST "https://api.banking-intelligence.com/v1/insights/generate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "How can I save money?"}'`}
              </pre>
              
              <h3 className="mt-4 mb-3">Security Best Practices</h3>
              <ul>
                <li className="mb-2">Never expose your API key in client-side code</li>
                <li className="mb-2">Set up proper authentication in your app</li>
                <li className="mb-2">Implement rate limiting on your backend</li>
                <li className="mb-2">Rotate your API keys periodically</li>
              </ul>
            </Tab.Pane>
            
            <Tab.Pane eventKey="endpoints" active={activeKey === 'endpoints'}>
              <h2 className="mb-4">API Endpoints</h2>
              
              <div className="mb-5">
                <h3 className="mb-3">Generate Insights</h3>
                <div className="bg-black p-3 rounded mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <span className="bg-success text-white px-2 py-1 rounded me-2">POST</span>
                    <code>/v1/insights/generate</code>
                  </div>
                  <p className="mb-0 text-secondary">
                    Generates financial insights based on a specific query and user data.
                  </p>
                </div>
                
                <h4 className="mt-4 mb-2">Request Parameters</h4>
                <pre className="bg-black p-3 rounded">
{`{
  "query": "How can I save more money?",
  "userData": {
    "accounts": [...],
    "transactions": [...]
  }
}`}
                </pre>
                
                <h4 className="mt-4 mb-2">Response Format</h4>
                <pre className="bg-black p-3 rounded">
{`{
  "success": true,
  "data": {
    "insights": "Based on your spending patterns...",
    "timestamp": "2025-03-28T14:28:43Z"
  }
}`}
                </pre>
              </div>
              
              <div>
                <h3 className="mb-3">Get Financial Summary</h3>
                <div className="bg-black p-3 rounded mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <span className="bg-success text-white px-2 py-1 rounded me-2">GET</span>
                    <code>/v1/insights/summary</code>
                  </div>
                  <p className="mb-0 text-secondary">
                    Returns a summary of a user's financial data and key metrics.
                  </p>
                </div>
              </div>
            </Tab.Pane>
            
            <Tab.Pane eventKey="data-models" active={activeKey === 'data-models'}>
              <h2 className="mb-4">Data Models</h2>
              
              <div className="mb-5">
                <h3 className="mb-3">Account</h3>
                <p>Represents a financial account such as a checking account, savings account, or credit card.</p>
                <pre className="bg-black p-3 rounded">
{`{
  "accountId": "string",       // Unique identifier for the account
  "name": "string",            // Display name of the account
  "type": "string",            // Type of account (Checking, Savings, Credit Card, etc.)
  "balance": "number",         // Current balance
  "currency": "string"         // Currency code (e.g., USD)
}`}
                </pre>
              </div>
              
              <div className="mb-5">
                <h3 className="mb-3">Transaction</h3>
                <p>Represents a financial transaction such as a purchase, deposit, or transfer.</p>
                <pre className="bg-black p-3 rounded">
{`{
  "transactionId": "string",   // Unique identifier for the transaction
  "accountId": "string",       // ID of the account this transaction belongs to
  "date": "string",            // Transaction date (ISO format)
  "description": "string",     // Description of the transaction
  "amount": "number",          // Transaction amount (negative for expenses)
  "category": "string"         // Category of the transaction
}`}
                </pre>
              </div>
            </Tab.Pane>
            
            <Tab.Pane eventKey="code-examples" active={activeKey === 'code-examples'}>
              <h2 className="mb-4">Code Examples</h2>
              
              <div className="mb-5">
                <h3 className="mb-3">JavaScript/Node.js</h3>
                <pre className="bg-black p-3 rounded">
{`// Using fetch (browser) or node-fetch (Node.js)
async function generateInsights(apiKey, query, userData) {
  const response = await fetch('https://api.banking-intelligence.com/v1/insights/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify({
      query,
      userData
    })
  });
  
  return response.json();
}

// Example usage
const insights = await generateInsights(
  'YOUR_API_KEY',
  'How can I save more money?',
  {
    accounts: [
      { accountId: 'acc1', type: 'Checking', balance: 1250.50 }
    ],
    transactions: [
      { transactionId: 'txn1', date: '2025-03-15', description: 'Grocery Store', amount: -85.20 }
    ]
  }
);`}
                </pre>
              </div>
              
              <div className="mb-5">
                <h3 className="mb-3">Python</h3>
                <pre className="bg-black p-3 rounded">
{`import requests
import json

def generate_insights(api_key, query, user_data):
    url = "https://api.banking-intelligence.com/v1/insights/generate"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "query": query,
        "userData": user_data
    }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# Example usage
insights = generate_insights(
    "YOUR_API_KEY",
    "How can I save more money?",
    {
        "accounts": [
            {"accountId": "acc1", "type": "Checking", "balance": 1250.50}
        ],
        "transactions": [
            {"transactionId": "txn1", "date": "2025-03-15", "description": "Grocery Store", "amount": -85.20}
        ]
    }
)`}
                </pre>
              </div>
            </Tab.Pane>
            
            <Tab.Pane eventKey="rate-limits" active={activeKey === 'rate-limits'}>
              <h2 className="mb-4">Rate Limits</h2>
              
              <p>
                To ensure fair usage and service stability, we enforce rate limits on API requests.
                Rate limits vary by subscription tier.
              </p>
              
              <h3 className="mt-4 mb-3">Rate Limit Headers</h3>
              <p>
                Each API response includes headers that indicate your current rate limit status:
              </p>
              <ul>
                <li className="mb-2"><code className="text-success">X-RateLimit-Limit</code>: Your maximum request quota</li>
                <li className="mb-2"><code className="text-success">X-RateLimit-Remaining</code>: Remaining requests in the current period</li>
                <li className="mb-2"><code className="text-success">X-RateLimit-Reset</code>: Time in seconds until the quota resets</li>
              </ul>
              
              <h3 className="mt-4 mb-3">Rate Limit By Plan</h3>
              <table className="table table-dark">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Rate Limit</th>
                    <th>Reset Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Free Tier</td>
                    <td>100 requests</td>
                    <td>Per day</td>
                  </tr>
                  <tr>
                    <td>Basic</td>
                    <td>10,000 requests</td>
                    <td>Per month</td>
                  </tr>
                  <tr>
                    <td>Professional</td>
                    <td>50,000 requests</td>
                    <td>Per month</td>
                  </tr>
                  <tr>
                    <td>Enterprise</td>
                    <td>Custom limits</td>
                    <td>Per month</td>
                  </tr>
                </tbody>
              </table>
              
              <h3 className="mt-4 mb-3">Handling Rate Limits</h3>
              <p>
                When you exceed your rate limit, the API will return a <code>429 Too Many Requests</code> status code.
                We recommend implementing exponential backoff in your application to handle rate limit errors.
              </p>
            </Tab.Pane>
          </Tab.Content>
        </Col>
      </Row>
    </Container>
  );
};

export default Documentation;