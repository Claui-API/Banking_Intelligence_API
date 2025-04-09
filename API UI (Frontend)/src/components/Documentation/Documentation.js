// src/components/Documentation/Documentation.js
import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';

const Documentation = () => {
  const [activeKey, setActiveKey] = useState('getting-started');
  
  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <h1 className="mb-4 text-white">API Dashboard</h1>
          <Row>
          <Col md={3} className="mb-4 mb-md-0">
            <Nav variant="pills" className="flex-column bg-dark rounded p-3" onSelect={setActiveKey}>
              <Nav.Item>
                <Nav.Link 
                  eventKey="getting-started" 
                  className={`text-success ${activeKey === 'getting-started' ? 'text-white active' : ''}`}
                >
                  Getting Started
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="authentication" 
                  className={`text-success ${activeKey === 'authentication' ? 'text-white active' : ''}`}
                >
                  Authentication
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="endpoints" 
                  className={`text-success ${activeKey === 'endpoints' ? 'text-white active' : ''}`}
                >
                  API Endpoints
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="data-models" 
                  className={`text-success ${activeKey === 'data-models' ? 'text-white active' : ''}`}
                >
                  Data Models
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="code-examples" 
                  className={`text-success ${activeKey === 'code-examples' ? 'text-white active' : ''}`}
                >
                  Code Examples
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="rate-limits" 
                  className={`text-success ${activeKey === 'rate-limits' ? 'text-white active' : ''}`}
                >
                  Rate Limits
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
            
            <Col md={9}>
              <Tab.Content className="bg-dark rounded p-4 text-white">
                <Tab.Pane eventKey="getting-started" active={activeKey === 'getting-started'}>
                  <h2 className="mb-4 text-white">Getting Started</h2>
                  <p className='text-white'>
                    Welcome to the CLAU Banking Intelligence API documentation. This guide will help you integrate 
                    our financial insights API into your application.
                  </p>
                  
                  <h3 className="mt-4 mb-3 text-white">Overview</h3>
                  <p className='text-white'>
                    The CLAU Banking Intelligence API allows you to provide AI-powered financial insights to your 
                    users based on their transaction data and account information.
                  </p>
                  
                  <h3 className="mt-4 mb-3 text-white">Quick Start</h3>
                  <ol>
                    <li className="mb-2 text-white"><span className="text-success fw-bold">Sign up</span> for an API key</li>
                    <li className="mb-2 text-white"><span className="text-success fw-bold">Authenticate</span> your requests using your API key</li>
                    <li className="mb-2 text-white"><span className="text-success fw-bold">Send</span> user financial data to our API</li>
                    <li className="mb-2 text-white"><span className="text-success fw-bold">Request</span> insights based on the data</li>
                    <li className="mb-2 text-white"><span className="text-success fw-bold">Display</span> the insights in your application</li>
                  </ol>
                  
                  <h3 className="mt-4 mb-3 text-white">Base URL</h3>
                  <div className="bg-black p-3 rounded mb-4">
                    <code className="text-success">https://api.banking-intelligence.com/v1</code>
                  </div>
                </Tab.Pane>
                
                <Tab.Pane eventKey="authentication" active={activeKey === 'authentication'}>
                  <h2 className="mb-4 text-white">Authentication</h2>
                  <p>
                    All API requests must be authenticated using an API key. You can obtain your API key by registering your application.
                  </p>

                  <h3 className="mt-4 mb-3 text-white">API Key Authentication</h3>
                  <p>
                    Include your API key in the Authorization header of all requests:
                  </p>
                  <div className="bg-black p-3 rounded mb-4">
                    <code className="text-success">Authorization: Bearer YOUR_API_KEY</code>
                  </div>
                  
                  <h3 className="mt-4 mb-3 text-white">Token Security</h3>
                  <p>
                    Keep your API key secure:
                  </p>
                  <ul>
                    <li>Never expose your API key in client-side code</li>
                    <li>Use environment variables to store your API key</li>
                    <li>Don't commit your API key to version control</li>
                    <li>Rotate your API key if you suspect it has been compromised</li>
                  </ul>
                </Tab.Pane>
                
                <Tab.Pane eventKey="endpoints" active={activeKey === 'endpoints'}>
                  <h2 className="mb-4 text-white">API Endpoints</h2>
                  
                  <div className="mb-5">
                    <h3 className="mb-3 text-white">Financial Summary</h3>
                    <div className="bg-black p-3 rounded mb-3">
                      <code className="text-success">GET /insights/summary</code>
                    </div>
                    <p>Returns a summary of financial data including account balances and recent transactions.</p>
                    
                    <h4 className="mt-4 mb-2 text-white">Response Example</h4>
                    <div className="bg-black p-3 rounded">
                      <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
    {`{
      "success": true,
      "data": {
        "totalBalance": 20000.25,
        "netWorth": 35000.50,
        "accounts": [
          {
            "accountId": "acc-123",
            "name": "Checking Account",
            "type": "Checking",
            "balance": 5000.75
          },
          ...
        ],
        "recentTransactions": [
          {
            "transactionId": "txn-456",
            "date": "2025-03-15T00:00:00.000Z",
            "description": "Grocery Store",
            "category": "Food",
            "amount": -125.50
          },
          ...
        ]
      }
    }`}
                      </pre>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="mb-3 text-white">Generate Insights</h3>
                    <div className="bg-black p-3 rounded mb-3">
                      <code className="text-success">POST /insights/generate</code>
                    </div>
                    <p>Generates AI-powered financial insights based on a user query and financial data.</p>
                    
                    <h4 className="mt-4 mb-2 text-white">Request Example</h4>
                    <div className="bg-black p-3 rounded mb-4">
                      <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
    {`{
      "query": "How can I improve my savings?",
      "userData": {
        "accounts": [...],
        "transactions": [...]
      }
    }`}
                      </pre>
                    </div>
                    
                    <h4 className="mt-4 mb-2 text-white">Response Example</h4>
                    <div className="bg-black p-3 rounded">
                      <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
    {`{
      "success": true,
      "data": {
        "insights": {
          "insight": "Based on your transaction history, I notice you're spending about $400 monthly on dining out. Reducing this by half could add $2,400 to your savings annually..."
        },
        "timestamp": "2025-03-20T15:30:45.123Z"
      }
    }`}
                      </pre>
                    </div>
                  </div>
                </Tab.Pane>
                
                <Tab.Pane eventKey="data-models" active={activeKey === 'data-models'}>
                  <h2 className="mb-4">Data Models</h2>
                  
                  <div className="mb-5">
                    <h3 className="mb-3">Account Object</h3>
                    <table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>accountId</td>
                          <td>string</td>
                          <td>Unique identifier for the account</td>
                        </tr>
                        <tr>
                          <td>name</td>
                          <td>string</td>
                          <td>Account name</td>
                        </tr>
                        <tr>
                          <td>type</td>
                          <td>string</td>
                          <td>Account type (e.g., "Checking", "Savings", "Credit Card")</td>
                        </tr>
                        <tr>
                          <td>balance</td>
                          <td>number</td>
                          <td>Current account balance</td>
                        </tr>
                        <tr>
                          <td>currency</td>
                          <td>string</td>
                          <td>Currency code (default: "USD")</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div>
                    <h3 className="mb-3">Transaction Object</h3>
                    <table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>transactionId</td>
                          <td>string</td>
                          <td>Unique identifier for the transaction</td>
                        </tr>
                        <tr>
                          <td>date</td>
                          <td>string</td>
                          <td>ISO-8601 formatted date and time</td>
                        </tr>
                        <tr>
                          <td>description</td>
                          <td>string</td>
                          <td>Transaction description or merchant name</td>
                        </tr>
                        <tr>
                          <td>category</td>
                          <td>string</td>
                          <td>Transaction category (e.g., "Food", "Transportation")</td>
                        </tr>
                        <tr>
                          <td>amount</td>
                          <td>number</td>
                          <td>Transaction amount (negative for expenses, positive for income)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Tab.Pane>
                
                <Tab.Pane eventKey="code-examples" active={activeKey === 'code-examples'}>
                  <h2 className="mb-4 text-white">Code Examples</h2>
                  
                  <div className="mb-5">
                    <h3 className="mb-3 text-white">JavaScript / Node.js</h3>
                    <div className="bg-black p-3 rounded">
                      <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
    {`// Using fetch API
    const API_KEY = 'your_api_key_here';
    const API_URL = 'https://api.banking-intelligence.com/v1';

    // Generate insights
    async function generateInsights(query, userData) {
      try {
        const response = await fetch(\`\${API_URL}/insights/generate\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${API_KEY}\`
          },
          body: JSON.stringify({
            query,
            userData
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'API error');
        }
        
        return data.data;
      } catch (error) {
        console.error('Error generating insights:', error);
        throw error;
      }
    }`}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <h3 className="mb-3 text-white">Python</h3>
                    <div className="bg-black p-3 rounded">
                      <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
    {`import requests
    import json

    API_KEY = 'your_api_key_here'
    API_URL = 'https://api.banking-intelligence.com/v1'

    def generate_insights(query, user_data):
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        }
        
        payload = {
            'query': query,
            'userData': user_data
        }
        
        response = requests.post(
            f'{API_URL}/insights/generate',
            headers=headers,
            data=json.dumps(payload)
        )
        
        if response.status_code != 200:
            raise Exception(f'API error: {response.status_code}')
        
        data = response.json()
        
        if not data.get('success'):
            raise Exception(data.get('message') or 'API returned error')
        
        return data.get('data')
    `}
                      </pre>
                    </div>
                  </div>
                </Tab.Pane>
                
                <Tab.Pane eventKey="rate-limits" active={activeKey === 'rate-limits'}>
                  <h2 className="mb-4 text-white">Rate Limits</h2>
                  
                  <p>
                    To ensure service stability and fair usage, we apply rate limits to API requests:
                  </p>
                  
                  <table className="table table-dark table-bordered mt-4">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Requests per minute</th>
                        <th>Requests per day</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Free</td>
                        <td>10</td>
                        <td>1,000</td>
                      </tr>
                      <tr>
                        <td>Basic</td>
                        <td>30</td>
                        <td>5,000</td>
                      </tr>
                      <tr>
                        <td>Premium</td>
                        <td>100</td>
                        <td>20,000</td>
                      </tr>
                      <tr>
                        <td>Enterprise</td>
                        <td>Custom</td>
                        <td>Custom</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <h3 className="mt-5 mb-3 text-white">Rate Limit Headers</h3>
                  <p>
                    All API responses include headers that provide information about your current rate limits:
                  </p>
                  
                  <ul>
                    <li><code>X-RateLimit-Limit</code>: Maximum number of requests allowed per time window</li>
                    <li><code>X-RateLimit-Remaining</code>: Number of requests remaining in the current time window</li>
                    <li><code>X-RateLimit-Reset</code>: Time when the rate limit will reset (Unix timestamp)</li>
                  </ul>
                  
                  <h3 className="mt-4 mb-3 text-white">Exceeding Rate Limits</h3>
                  <p>
                    If you exceed your rate limit, the API will return a 429 Too Many Requests response.
                    When this happens, you should wait until your rate limit resets before making additional requests.
                  </p>
                </Tab.Pane>
              </Tab.Content>
            </Col>
          </Row>
        </div>
    </Container>
  );
};

export default Documentation;