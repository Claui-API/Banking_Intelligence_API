import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ code, language = 'javascript' }) => (
  <div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
    <SyntaxHighlighter language={language} style={oneDark} wrapLongLines customStyle={{ fontSize: '0.9rem', margin: 0 }}>
      {code}
    </SyntaxHighlighter>
  </div>
);

const Documentation = () => {
  const [activeKey, setActiveKey] = useState('getting-started');

  const accountModelExample = `{
  "accountId": "acc-123",
  "name": "Checking Account",
  "type": "Checking",
  "balance": 5000.75
}`;

  const transactionModelExample = `{
  "transactionId": "txn-456",
  "date": "2025-03-15T00:00:00.000Z",
  "description": "Grocery Store",
  "category": "Food",
  "amount": -125.50
}`;

  const jsExample = `// Using fetch API
const API_KEY = 'your_api_key_here';
const API_URL = 'https://bankingintelligenceapi.com/';

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
}`;

  const pythonExample = `import requests
import json

API_KEY = 'your_api_key_here'
API_URL = 'https://bankingintelligenceapi.com/'

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

    return data.get('data')`;

  const authHeaderExample = `Authorization: Bearer YOUR_API_KEY`;

  const generateRequestExample = `{
  "query": "How can I improve my savings?",
  "userData": {
    "accounts": [
      { "accountId": "acc-1", "type": "Checking", "balance": 1250.50 },
      { "accountId": "acc-2", "type": "Savings", "balance": 5000.00 }
    ],
    "transactions": [
      { "transactionId": "txn-1", "date": "2025-03-15", "description": "Grocery Store", "amount": -85.20 },
      { "transactionId": "txn-2", "date": "2025-03-14", "description": "Salary Deposit", "amount": 3000.00 }
    ]
  }
}`;

  const generateResponseExample = `{
  "success": true,
  "data": {
    "insights": {
      "insight": "Based on your transaction history, I notice you're spending about $400 monthly on dining out. Reducing this by half could add $2,400 to your savings annually."
    },
    "timestamp": "2025-03-20T15:30:45.123Z"
  }
}`;

  const summaryResponseExample = `{
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
      }
    ],
    "recentTransactions": [
      {
        "transactionId": "txn-456",
        "date": "2025-03-15T00:00:00.000Z",
        "description": "Grocery Store",
        "category": "Food",
        "amount": -125.50
      }
    ]
  }
}`;

  const plaidLinkTokenExample = `// Request
{
  "products": ["transactions"]
}

// Response
{
  "success": true,
  "data": {
    "link_token": "link-sandbox-abc123",
    "expiration": "2025-05-07T16:30:45.123Z"
  }
}`;

  const plaidExchangeTokenExample = `// Request
{
  "publicToken": "public-sandbox-abc123"
}

// Response
{
  "success": true,
  "message": "Bank account connected successfully",
  "data": {
    "itemId": "item-sandbox-abc123"
  }
}`;

  const plaidAccountsExample = `// Response
{
  "success": true,
  "data": [
    {
      "accountId": "acc-checking-001",
      "name": "Primary Checking",
      "type": "Checking",
      "subtype": "Checking",
      "balance": 2500.75,
      "availableBalance": 2450.50,
      "currency": "USD"
    },
    {
      "accountId": "acc-savings-001",
      "name": "Savings Account",
      "type": "Savings",
      "subtype": "Savings",
      "balance": 15000.50,
      "availableBalance": 15000.50,
      "currency": "USD"
    }
  ]
}`;

  const plaidTransactionsExample = `// Response
{
  "success": true,
  "data": [
    {
      "transactionId": "txn-001",
      "accountId": "acc-checking-001",
      "date": "2025-05-06T00:00:00.000Z",
      "description": "Grocery Store",
      "amount": -120.35,
      "category": "Food",
      "merchantName": "Whole Foods"
    },
    {
      "transactionId": "txn-002",
      "accountId": "acc-checking-001",
      "date": "2025-05-05T00:00:00.000Z",
      "description": "Monthly Salary",
      "amount": 4000.00,
      "category": "Income",
      "merchantName": "COMPANY INC"
    }
  ]
}`;

  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <h1 className="mb-4 text-white">API Dashboard</h1>
        <Row>
          <Col md={3} className="mb-4 mb-md-0">
            <Nav variant="pills" className="flex-column bg-dark rounded p-3" onSelect={setActiveKey}>
              {[
                'getting-started',
                'authentication',
                'endpoints',
                'data-models',
                'code-examples',
                'plaid-integration',
                'mobile',
                'rate-limits'
              ].map(key => (
                <Nav.Item key={key}>
                  <Nav.Link
                    eventKey={key}
                    className={`text-success ${activeKey === key ? 'text-white active' : ''}`}
                  >
                    {key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Col>

          <Col md={9}>
            <Tab.Content className="bg-dark rounded p-4 text-white">
              <Tab.Pane eventKey="getting-started" active={activeKey === 'getting-started'}>
                <h2 className="mb-4 text-white">Getting Started</h2>
                <p>Welcome to the CLAU Banking Intelligence API documentation. This guide will help you integrate our financial insights API into your application.</p>
                <h4 className="mt-4 text-white">Base URL</h4>
                <CodeBlock code="https://bankingintelligenceapi.com/" language="bash" />
                <p className="mt-4">The Banking Intelligence API provides AI-powered financial analysis and insights that you can integrate into your banking or financial applications. This API allows developers to add personalized financial intelligence to their apps, providing users with budget recommendations, spending analysis, and financial goal tracking.</p>
              </Tab.Pane>

              <Tab.Pane eventKey="authentication" active={activeKey === 'authentication'}>
                <h2 className="mb-4 text-white">Authentication</h2>
                <p>All API requests must be authenticated using an API key.</p>
                <h4 className="mt-4 mb-2 text-white">Authorization Header</h4>
                <CodeBlock code={authHeaderExample} language="bash" />
                
                <h4 className="mt-4 mb-2 text-white">Obtaining an API Key</h4>
                <ol>
                  <li>Register for an account at <a href="https://bankingintelligenceapi.com/register" target="_blank" rel="noopener noreferrer" className="text-success">bankingintelligenceapi.com</a></li>
                  <li>Once approved, generate your API key in the API Keys section of your dashboard</li>
                  <li>Store your Client ID and Client Secret securely - they will only be shown once</li>
                </ol>
                
                <h4 className="mt-4 mb-2 text-white">Token Expiration</h4>
                <p>API tokens are valid for 30 days by default. After expiration, you'll need to generate a new token using your client credentials.</p>
              </Tab.Pane>

              <Tab.Pane eventKey="endpoints" active={activeKey === 'endpoints'}>
                <h2 className="mb-4 text-white">API Endpoints</h2>
                <h4 className="mt-4 mb-2 text-white">GET /insights/summary</h4>
                <p>Returns a summary of financial data including account balances and recent transactions.</p>
                <CodeBlock code={summaryResponseExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">POST /insights/generate</h4>
                <p>Generates financial insights based on provided user data and query.</p>
                <h5 className="text-white mt-3">Request Example</h5>
                <CodeBlock code={generateRequestExample} language="json" />
                <h5 className="text-white mt-3">Response Example</h5>
                <CodeBlock code={generateResponseExample} language="json" />
              </Tab.Pane>

              <Tab.Pane eventKey="data-models" active={activeKey === 'data-models'}>
                <h2 className="mb-4 text-white">Data Models</h2>
                <p>These are the core objects used in requests and responses.</p>

                <h4 className="mt-4 text-white">Account Object</h4>
                <p>Represents a financial account belonging to the user.</p>
                <CodeBlock code={accountModelExample} language="json" />

                <h4 className="mt-4 text-white">Transaction Object</h4>
                <p>Details for each individual transaction.</p>
                <CodeBlock code={transactionModelExample} language="json" />
              </Tab.Pane>

              <Tab.Pane eventKey="code-examples" active={activeKey === 'code-examples'}>
                <h2 className="mb-4 text-white">Code Examples</h2>
                <div className="mb-5">
                  <h3 className="mb-3 text-white">JavaScript / Node.js</h3>
                  <CodeBlock code={jsExample} language="javascript" />
                </div>
                <div className="mb-5">
                  <h3 className="mb-3 text-white">Python</h3>
                  <CodeBlock code={pythonExample} language="python" />
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="plaid-integration" active={activeKey === 'plaid-integration'}>
                <h2 className="mb-4 text-white">Plaid Integration</h2>
                <p>The Banking Intelligence API fully supports integration with Plaid to connect users' bank accounts. You don't need a separate Plaid account - our API handles all communication with Plaid's services.</p>
                
                <h4 className="mt-4 text-white">Plaid Link Token Creation</h4>
                <p>Create a Link token to initialize Plaid Link for connecting bank accounts.</p>
                <CodeBlock code={plaidLinkTokenExample} language="json" />
                
                <h4 className="mt-4 text-white">Exchange Public Token</h4>
                <p>Exchange a public token from Plaid Link for an access token.</p>
                <CodeBlock code={plaidExchangeTokenExample} language="json" />
                
                <h4 className="mt-4 text-white">Get Plaid Accounts</h4>
                <p>Retrieve connected bank accounts.</p>
                <CodeBlock code={plaidAccountsExample} language="json" />
                
                <h4 className="mt-4 text-white">Get Plaid Transactions</h4>
                <p>Retrieve transactions from connected accounts.</p>
                <CodeBlock code={plaidTransactionsExample} language="json" />
                
                <h4 className="mt-4 text-white">Plaid Link Implementation</h4>
                <p>For mobile applications, we recommend using the official Plaid Link SDKs in combination with our API:</p>
                <ul>
                  <li><a href="https://github.com/plaid/plaid-link-ios" target="_blank" rel="noopener noreferrer" className="text-success">Plaid Link iOS SDK</a></li>
                  <li><a href="https://github.com/plaid/plaid-link-android" target="_blank" rel="noopener noreferrer" className="text-success">Plaid Link Android SDK</a></li>
                </ul>
                
                <h5 className="mt-3 text-white">Implementation Flow</h5>
                <ol>
                  <li>Your app requests a Plaid Link token from our API</li>
                  <li>User selects their bank and provides credentials via Plaid Link</li>
                  <li>Your app exchanges the public token for an access token</li>
                  <li>Use our API to fetch accounts and transactions</li>
                </ol>
                
                <p className="mt-4">Our API handles the complexities of maintaining Plaid access tokens and refreshing them when necessary. You don't need to worry about token management or expiration.</p>
              </Tab.Pane>

              <Tab.Pane eventKey="mobile" active={activeKey === 'mobile'}>
                <h2 className="mb-4 text-white">Mobile Integration</h2>
                <p>The Banking Intelligence API provides special endpoints optimized for mobile applications, with considerations for battery life, network bandwidth, and offline capabilities.</p>
                
                <h4 className="mt-4 text-white">Mobile-Specific Endpoints</h4>
                <ul>
                  <li><code>GET /api/v1/mobile/financial-snapshot</code> - Lightweight account summary</li>
                  <li><code>POST /api/v1/mobile/quick-insight</code> - Concise insights optimized for mobile display</li>
                  <li><code>GET /api/v1/sync/package</code> - Sync package for offline use</li>
                  <li><code>POST /api/v1/sync/changes</code> - Process offline changes</li>
                </ul>
                
                <h4 className="mt-4 text-white">Mobile Optimization Headers</h4>
                <p>Include these headers in your requests to optimize the API behavior for mobile:</p>
                <ul>
                  <li><code>X-Battery-Status: low</code> - Reduces response size and background processing</li>
                  <li><code>X-Prefer-Reduced-Data: true</code> - Returns more compact responses</li>
                  <li><code>X-Cache-Time: 3600</code> - Suggests client-side cache duration in seconds</li>
                </ul>
                
                <h4 className="mt-4 text-white">Push Notifications</h4>
                <p>Register device tokens to receive push notifications for financial events:</p>
                <ul>
                  <li>Transaction alerts</li>
                  <li>Low balance warnings</li>
                  <li>Weekly financial digests</li>
                  <li>Personalized insights</li>
                </ul>
                
                <h4 className="mt-4 text-white">Offline Support</h4>
                <p>Implement these strategies for robust offline support:</p>
                <ol>
                  <li>Fetch and store sync packages when online</li>
                  <li>Allow offline categorization and annotation of transactions</li>
                  <li>Queue changes made while offline</li>
                  <li>Synchronize when connectivity is restored</li>
                  <li>Handle potential conflicts with server-side changes</li>
                </ol>
              </Tab.Pane>

              <Tab.Pane eventKey="rate-limits" active={activeKey === 'rate-limits'}>
                <h2 className="mb-4 text-white">Rate Limits & Quotas</h2>
                <p>To ensure fair usage and API stability, all requests are rate-limited. Rate limits reset every minute.</p>

                <h4 className="mt-4 text-white">Limits by Plan</h4>
                <ul>
                  <li><strong>Free Tier:</strong> 60 requests per minute</li>
                  <li><strong>Pro Tier:</strong> 120 requests per minute</li>
                  <li><strong>Enterprise:</strong> Custom SLAs available upon request</li>
                </ul>

                <h4 className="mt-4 text-white">Monthly Usage Quotas</h4>
                <p>Each account has a monthly usage quota based on the plan:</p>
                <ul>
                  <li><strong>Free Tier:</strong> 10,000 queries per month</li>
                  <li><strong>Pro Tier:</strong> 100,000 queries per month</li>
                  <li><strong>Enterprise:</strong> Custom quota</li>
                </ul>
                
                <h4 className="mt-4 text-white">Response Headers</h4>
                <p>Look at these headers on every response to manage your usage:</p>
                <ul>
                  <li><code>X-RateLimit-Limit</code>: total requests allowed in the current window</li>
                  <li><code>X-RateLimit-Remaining</code>: requests left in the current window</li>
                  <li><code>X-RateLimit-Reset</code>: UNIX timestamp when the window resets</li>
                </ul>
                
                <h4 className="mt-4 text-white">Handling Rate Limits</h4>
                <p>Implement an exponential backoff strategy when receiving 429 responses:</p>
                <CodeBlock code={`// Example rate limit handling
async function fetchWithRetry(url, options, maxRetries = 5) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - get reset time from header
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const waitTime = resetTime ? 
          Math.max(1000, new Date(parseInt(resetTime) * 1000) - new Date()) : 
          Math.pow(2, retries) * 1000;
          
        console.log(\`Rate limited. Waiting \${waitTime/1000}s before retry.\`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }
      
      return response;
    } catch (error) {
      if (retries >= maxRetries - 1) throw error;
      retries++;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
}`} language="javascript" />
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default Documentation;