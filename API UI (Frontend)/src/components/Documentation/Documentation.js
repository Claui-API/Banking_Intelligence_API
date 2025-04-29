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
API_URL = 'https://https://bankingintelligenceapi.com/'

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

  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <h1 className="mb-4 text-white">API Dashboard</h1>
        <Row>
          <Col md={3} className="mb-4 mb-md-0">
            <Nav variant="pills" className="flex-column bg-dark rounded p-3" onSelect={setActiveKey}>
              {['getting-started', 'authentication', 'endpoints', 'data-models', 'code-examples', 'rate-limits'].map(key => (
                <Nav.Item key={key}>
                  <Nav.Link
                    eventKey={key}
                    className={`text-success ${activeKey === key ? 'text-white active' : ''}`}
                  >
                    {key.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
              </Tab.Pane>

              <Tab.Pane eventKey="authentication" active={activeKey === 'authentication'}>
                <h2 className="mb-4 text-white">Authentication</h2>
                <p>All API requests must be authenticated using an API key.</p>
                <h4 className="mt-4 mb-2 text-white">Authorization Header</h4>
                <CodeBlock code={authHeaderExample} language="bash" />
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

              <Tab.Pane eventKey="rate-limits" active={activeKey === 'rate-limits'}>
                <h2 className="mb-4 text-white">Rate Limits</h2>
                <p>To ensure fair usage and API stability, all requests are rate-limited. Rate limits reset every minute.</p>

                <h4 className="mt-4 text-white">Limits by Plan</h4>
                <ul>
                  <li><strong>Free Tier:</strong> 60 requests per minute</li>
                  <li><strong>Pro Tier:</strong> 120 requests per minute</li>
                  <li><strong>Enterprise:</strong> Custom SLAs available upon request</li>
                </ul>

                <h4 className="mt-4 text-white">Response Headers</h4>
                <p>Look at these headers on every response to manage your usage:</p>
                <ul>
                  <li><code>X-RateLimit-Limit</code>: total requests allowed in the current window</li>
                  <li><code>X-RateLimit-Remaining</code>: requests left in the current window</li>
                  <li><code>X-RateLimit-Reset</code>: UNIX timestamp when the window resets</li>
                </ul>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default Documentation;