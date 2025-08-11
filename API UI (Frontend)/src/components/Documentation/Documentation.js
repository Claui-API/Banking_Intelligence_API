import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeExamplesTab from './CodeExamplesTab'; // Adjust path as needed

const CodeBlock = ({ code, language = 'javascript' }) => (
  <div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
    <SyntaxHighlighter language={language} style={oneDark} wrapLongLines customStyle={{ fontSize: '0.9rem', margin: 0 }}>
      {code}
    </SyntaxHighlighter>
  </div>
);

const Documentation = () => {
  const [activeKey, setActiveKey] = useState('getting-started');

  // Core data models
  const accountModelExample = `{
  "accountId": "acc-123456",          // Unique identifier for the account
  "name": "Checking Account",         // Account name
  "type": "Checking",                 // Account type: Checking, Savings, Credit, Investment, etc.
  "subtype": "Checking",              // Optional subtype
  "balance": 5000.75,                 // Current balance
  "availableBalance": 4950.50,        // Available balance (optional)
  "currency": "USD",                  // ISO currency code (default: USD)
  "creditLimit": null,                // Credit limit (for credit accounts)
  "isActive": true,                   // Account status
  "metadata": {                       // Optional metadata (key-value pairs)
    "interestRate": 0.01,
    "accountNumber": "xxxx1234"
  },
  "lastUpdated": "2025-03-15T14:30:45.123Z"  // Last update timestamp
}`;

  const transactionModelExample = `{
  "transactionId": "txn-789012",      // Unique identifier for the transaction
  "accountId": "acc-123456",          // ID of the associated account
  "date": "2025-03-15T00:00:00.000Z", // Transaction date
  "description": "Grocery Store",     // Transaction description
  "amount": -85.20,                   // Transaction amount (negative for debits)
  "category": "Food",                 // Transaction category
  "type": "expense",                  // Transaction type: expense, income, transfer
  "pending": false,                   // Whether transaction is pending
  "merchantName": "Whole Foods",      // Name of merchant (optional)
  "metadata": {                       // Optional metadata (key-value pairs)
    "location": "123 Main St",
    "referenceNumber": "REF123456"
  }
}`;

  // Direct integration examples
  const createBankUserExample = `// Request
POST /api/bank/users
{
  "bankUserId": "user-123456",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "metadata": {
    "customerSince": "2020-01-01",
    "preferredLanguage": "en"
  }
}

// Response
{
  "success": true,
  "message": "Bank user created/updated successfully",
  "data": {
    "bankUserId": "user-123456",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "status": "active"
  }
}`;

  const uploadAccountsExample = `// Request
POST /api/bank/users/:bankUserId/accounts
{
  "accounts": [
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
}

// Response
{
  "success": true,
  "message": "Successfully stored 2 accounts",
  "data": {
    "count": 2
  }
}`;

  const uploadTransactionsExample = `// Request
POST /api/bank/users/:bankUserId/transactions
{
  "transactions": [
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
}

// Response
{
  "success": true,
  "message": "Successfully stored 2 transactions",
  "data": {
    "count": 2
  }
}`;

  const getFinancialDataExample = `// Request
GET /api/bank/users/:bankUserId/financial-data?startDate=2025-01-01&endDate=2025-05-31&limit=50

// Response
{
  "success": true,
  "data": {
    "user": {
      "bankUserId": "user-123456",
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "accounts": [
      {
        "accountId": "acc-checking-001",
        "name": "Primary Checking",
        "type": "Checking",
        "balance": 2500.75,
        "availableBalance": 2450.50,
        "currency": "USD"
      },
      {
        "accountId": "acc-savings-001",
        "name": "Savings Account",
        "type": "Savings",
        "balance": 15000.50,
        "availableBalance": 15000.50,
        "currency": "USD"
      }
    ],
    "transactions": [
      {
        "transactionId": "txn-001",
        "accountId": "acc-checking-001",
        "date": "2025-05-06T00:00:00.000Z",
        "description": "Grocery Store",
        "amount": -120.35,
        "category": "Food",
        "merchantName": "Whole Foods"
      }
    ],
    "summary": {
      "totalBalance": 17501.25,
      "totalIncome": 4000.00,
      "totalExpenses": -120.35
    }
  }
}`;

  const generateInsightsExample = `// Request
POST /api/bank/users/:bankUserId/insights
{
  "query": "How can I save more money?",
  "requestId": "custom-request-123" // Optional
}

// Response
{
  "success": true,
  "data": {
    "bankUserId": "user-123456",
    "query": "How can I save more money?",
    "insights": {
      "insight": "Based on your transaction history, I notice you're spending about $400 monthly on dining out. Reducing this by half could add $2,400 to your savings annually."
    },
    "timestamp": "2025-03-20T15:30:45.123Z"
  }
}`;

  const authHeaderExample = `Authorization: Bearer YOUR_API_KEY`;

  // Plaid examples
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

  // Updated Plaid integration example without dynamic references
  const plaidIntegrationExample = `// React example using the react-plaid-link library
import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';

const PlaidLinkComponent = () => {
  const [linkToken, setLinkToken] = useState(null);
  const [plaidAccounts, setPlaidAccounts] = useState([]);
  
  // Step 1: Get a link token when the component mounts
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await axios.post('https://bankingintelligenceapi.com/plaid/create-link-token', {}, {
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
          }
        });
        setLinkToken(response.data.data.link_token);
      } catch (error) {
        console.error('Error fetching link token:', error);
      }
    };
    
    fetchLinkToken();
  }, []);
  
  // Step 2: Handle the success callback from Plaid Link
  const onSuccess = useCallback(async (publicToken, metadata) => {
    // Exchange the public token for an access token
    try {
      const exchangeResponse = await axios.post('https://bankingintelligenceapi.com/plaid/exchange-token', {
        publicToken: publicToken
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY'
        }
      });
      
      console.log('Exchange successful:', exchangeResponse.data);
      
      // Fetch accounts using the new connection
      const accountsResponse = await axios.get('https://bankingintelligenceapi.com/plaid/accounts', {
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY'
        }
      });
      
      setPlaidAccounts(accountsResponse.data.data);
    } catch (error) {
      console.error('Error in Plaid flow:', error);
    }
  }, []);
  
  // Step 3: Configure the Plaid Link hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err, metadata) => {
      console.log('Link closed:', metadata, err);
    },
  });
  
  return (
    <div>
      <button 
        onClick={() => open()} 
        disabled={!ready}
      >
        Connect a bank account
      </button>
      
      {plaidAccounts.length > 0 && (
        <div>
          <h4>Connected Accounts</h4>
          <ul>
            {/* Example of how you would render the accounts */}
            <li>Primary Checking - Checking - $2500.75</li>
            <li>Savings Account - Savings - $15000.50</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PlaidLinkComponent;`;

  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <h1 className="mb-4 text-white">Documentation</h1>
        <Row>
          <Col md={3} className="mb-4 mb-md-0">
            <Nav variant="pills" className="flex-column bg-dark rounded p-3" onSelect={setActiveKey}>
              {[
                'getting-started',
                'authentication',
                'data-models',
                'direct-endpoints',
                'code-examples',
                'plaid-integration',
                'integration-comparison',
                'best-practices',
                'security'
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
                <h2 className="mb-4 text-white">Getting Started with Direct Integration</h2>
                <p>Welcome to the CLAU Banking Intelligence API direct integration documentation. This guide is specifically designed for financial institutions that want to use our API with their own data instead of connecting through Plaid.</p>

                <h4 className="mt-4 text-white">Direct Integration Overview</h4>
                <p>Our direct integration pathway allows banks and financial institutions to leverage our financial insights capabilities while maintaining complete control over their customer data. Instead of using Plaid to connect accounts, you can directly upload your customer data to our API using secure endpoints.</p>

                <h4 className="mt-4 text-white">Direct Integration Flow</h4>
                <ol>
                  <li>Register and obtain API credentials</li>
                  <li>Create bank users in our system</li>
                  <li>Upload account information</li>
                  <li>Upload transaction data</li>
                  <li>Generate financial insights based on this data</li>
                </ol>

                <h4 className="mt-4 text-white">Benefits of Direct Integration</h4>
                <ul>
                  <li>Maintain complete control over customer data</li>
                  <li>Customize the data sharing experience</li>
                  <li>Simplify compliance with banking regulations</li>
                  <li>Reduce third-party dependencies</li>
                </ul>

                <h4 className="mt-4 text-white">Base URL</h4>
                <CodeBlock code="https://bankingintelligenceapi.com/" language="bash" />
              </Tab.Pane>

              <Tab.Pane eventKey="authentication" active={activeKey === 'authentication'}>
                <h2 className="mb-4 text-white">Authentication</h2>
                <p>All API requests must be authenticated using an API key.</p>
                <h4 className="mt-4 mb-2 text-white">Authentication</h4>
                <p>All API requests must be authenticated using an API key. Include your API key in the Authorization header of each request:</p>
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

              <Tab.Pane eventKey="data-models" active={activeKey === 'data-models'}>
                <h2 className="mb-4 text-white">Data Models</h2>
                <p>These are the core objects used in direct integration requests and responses.</p>

                <h4 className="mt-4 text-white">Account Object</h4>
                <p>Represents a financial account belonging to a bank user.</p>
                <CodeBlock code={accountModelExample} language="json" />

                <h4 className="mt-4 text-white">Transaction Object</h4>
                <p>Details for each individual transaction.</p>
                <CodeBlock code={transactionModelExample} language="json" />

                <h4 className="mt-4 text-white">Data Requirements</h4>
                <p>For optimal insights generation, we recommend including the following:</p>
                <ul>
                  <li><strong>Accounts:</strong> At minimum, include accountId, name, type, and balance</li>
                  <li><strong>Transactions:</strong> At minimum, include transactionId, accountId, date, description, and amount</li>
                  <li><strong>Categories:</strong> While optional, providing transaction categories significantly improves insight quality</li>
                  <li><strong>Extended History:</strong> For best results, provide at least 3-6 months of transaction history</li>
                </ul>

                <h4 className="mt-4 text-white">Data Formatting Best Practices</h4>
                <ul>
                  <li>Use ISO-8601 format for all dates (YYYY-MM-DDTHH:MM:SS.sssZ)</li>
                  <li>Use negative amounts for expenses/debits, positive for income/credits</li>
                  <li>Ensure consistent category naming across transactions</li>
                  <li>Use meaningful merchant names when available</li>
                  <li>Include available metadata to enhance insights (location, reference numbers, etc.)</li>
                </ul>
              </Tab.Pane>

              <Tab.Pane eventKey="direct-endpoints" active={activeKey === 'direct-endpoints'}>
                <h2 className="mb-4 text-white">Direct Integration Endpoints</h2>
                <p>These endpoints are specifically designed for financial institutions to upload and manage their own data.</p>

                <h4 className="mt-4 mb-2 text-white">Create/Update Bank User</h4>
                <p>Create or update a user record in the system.</p>
                <CodeBlock code={createBankUserExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">Upload Accounts</h4>
                <p>Upload accounts for a specific bank user.</p>
                <CodeBlock code={uploadAccountsExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">Upload Transactions</h4>
                <p>Upload transactions for a specific bank user.</p>
                <CodeBlock code={uploadTransactionsExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">Get Financial Data</h4>
                <p>Retrieve financial data for a specific bank user with optional filtering.</p>
                <CodeBlock code={getFinancialDataExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">Generate Insights</h4>
                <p>Generate financial insights for a specific bank user based on their data.</p>
                <CodeBlock code={generateInsightsExample} language="json" />

                <h4 className="mt-4 mb-2 text-white">Processing Large Datasets</h4>
                <p>For large-scale data operations, we recommend breaking data into smaller batches and sending them sequentially:</p>
                <ul>
                  <li>Split large transaction sets into batches of 100-500 transactions</li>
                  <li>Process each batch sequentially with appropriate error handling</li>
                  <li>Implement retry logic for failed batches</li>
                </ul>
                <p>This approach helps ensure reliable data processing while staying within API limits.</p>
              </Tab.Pane>

              <Tab.Pane eventKey="code-examples" active={activeKey === 'code-examples'}>
                <CodeExamplesTab />
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

                <h4 className="mt-4 text-white">Code Example: Plaid Link Integration</h4>
                <CodeBlock code={plaidIntegrationExample} language="javascript" />
              </Tab.Pane>

              <Tab.Pane eventKey="integration-comparison" active={activeKey === 'integration-comparison'}>
                <h2 className="mb-4 text-white">Direct vs. Plaid Integration</h2>
                <p>We offer two integration paths: Direct Integration and Plaid Integration. This comparison helps you choose the best approach for your specific needs.</p>

                <h4 className="mt-4 text-white">Feature Comparison</h4>
                <div className="table-responsive">
                  <table className="table table-dark table-bordered">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Direct Integration</th>
                        <th>Plaid Integration</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Data Control</td>
                        <td>Full control over data</td>
                        <td>Depends on Plaid's access</td>
                      </tr>
                      <tr>
                        <td>Setup Complexity</td>
                        <td>More complex initial setup</td>
                        <td>Simpler with Plaid Link</td>
                      </tr>
                      <tr>
                        <td>User Experience</td>
                        <td>Custom bank selection UI needed</td>
                        <td>Ready-to-use Plaid Link UI</td>
                      </tr>
                      <tr>
                        <td>Data Refresh</td>
                        <td>Manual refresh implementation</td>
                        <td>Automatic via Plaid</td>
                      </tr>
                      <tr>
                        <td>Credential Storage</td>
                        <td>Bank handles credentials</td>
                        <td>Plaid handles credentials</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="mt-4 text-white">When to choose Direct Integration</h4>
                <ul>
                  <li>You are a financial institution with direct access to customer data</li>
                  <li>You want to maintain complete control over the user experience</li>
                  <li>You want to avoid additional third-party dependencies</li>
                  <li>You have existing systems that already access and store this financial data</li>
                </ul>

                <h4 className="mt-4 text-white">When to choose Plaid Integration</h4>
                <ul>
                  <li>You're a fintech or non-bank entity needing access to banking data</li>
                  <li>You want to get to market quickly with minimal development effort</li>
                  <li>You need access to thousands of financial institutions</li>
                  <li>You prefer to avoid handling sensitive credentials</li>
                </ul>

                <h4 className="mt-4 text-white">Hybrid Approach</h4>
                <p>Some partners implement a hybrid approach, using direct integration for their own account holders and Plaid integration for connecting external accounts.</p>
              </Tab.Pane>

              <Tab.Pane eventKey="best-practices" active={activeKey === 'best-practices'}>
                <h2 className="mb-4 text-white">Best Practices</h2>
                <p>Follow these guidelines to ensure optimal performance and reliability when using direct integration.</p>

                <h4 className="mt-4 text-white">Data Synchronization</h4>
                <ul>
                  <li><strong>Incremental Updates:</strong> Only send new or changed data after initial load</li>
                  <li><strong>Scheduled Syncs:</strong> Establish regular sync schedules (daily, hourly, etc.)</li>
                  <li><strong>Change Detection:</strong> Implement mechanisms to detect and sync only changed records</li>
                  <li><strong>Idempotent Operations:</strong> Design your sync process to be safely retryable</li>
                </ul>

                <h4 className="mt-4 text-white">Performance Optimization</h4>
                <ul>
                  <li><strong>Batch Processing:</strong> Group data into reasonably sized batches (500-1000 records)</li>
                  <li><strong>Concurrent Requests:</strong> Use parallel requests for different users, but limit to 10-20 concurrent connections</li>
                  <li><strong>Rate Limiting:</strong> Implement backoff strategies to handle rate limits</li>
                  <li><strong>Data Compression:</strong> Enable gzip compression for large requests</li>
                </ul>

                <h4 className="mt-4 text-white">Error Handling</h4>
                <ul>
                  <li><strong>Retry Logic:</strong> Implement exponential backoff for transient errors</li>
                  <li><strong>Failure Logging:</strong> Maintain detailed logs of sync failures for troubleshooting</li>
                  <li><strong>Validation:</strong> Validate data before sending to avoid validation errors</li>
                  <li><strong>Monitoring:</strong> Set up alerts for repeated failures or sync issues</li>
                </ul>

                <h4 className="mt-4 text-white">Data Quality</h4>
                <ul>
                  <li><strong>Consistent Categories:</strong> Use a standardized category taxonomy</li>
                  <li><strong>Merchant Enrichment:</strong> Provide clean merchant names when possible</li>
                  <li><strong>Transaction Descriptions:</strong> Use informative, consistent transaction descriptions</li>
                  <li><strong>Data Cleaning:</strong> Remove duplicate transactions before sending</li>
                </ul>
              </Tab.Pane>

              <Tab.Pane eventKey="security" active={activeKey === 'security'}>
                <h2 className="mb-4 text-white">Security Considerations</h2>
                <p>Security is paramount when handling financial data. Follow these guidelines to ensure secure integration.</p>

                <h4 className="mt-4 text-white">Data Protection</h4>
                <ul>
                  <li><strong>Data Minimization:</strong> Only send the data necessary for insights generation</li>
                  <li><strong>PII Handling:</strong> Avoid sending personally identifiable information when possible</li>
                  <li><strong>Data Masking:</strong> Mask sensitive fields like full account numbers</li>
                  <li><strong>Tokenization:</strong> Use tokenized identifiers instead of actual account numbers</li>
                </ul>

                <h4 className="mt-4 text-white">API Security</h4>
                <ul>
                  <li><strong>TLS Encryption:</strong> Always use HTTPS for all API communications</li>
                  <li><strong>API Key Rotation:</strong> Implement regular rotation of API keys</li>
                  <li><strong>IP Restrictions:</strong> Use IP whitelisting for API access</li>
                  <li><strong>Access Controls:</strong> Implement role-based access controls for API usage</li>
                </ul>

                <h4 className="mt-4 text-white">Compliance</h4>
                <ul>
                  <li><strong>Audit Logging:</strong> Maintain detailed logs of all data access and transfers</li>
                  <li><strong>Consent Management:</strong> Ensure proper customer consent for data sharing</li>
                  <li><strong>Data Retention:</strong> Implement appropriate data retention policies</li>
                  <li><strong>Regulatory Compliance:</strong> Ensure integration meets applicable financial regulations</li>
                </ul>

                <h4 className="mt-4 text-white">Security Assessment</h4>
                <p>We offer a security assessment for direct integration partners to ensure your implementation meets our security standards. Contact our security team to schedule an assessment.</p>

                <h4 className="mt-4 text-white">Incident Response</h4>
                <p>In case of a security incident or suspected breach, contact our security team immediately at <a href="mailto:support@bankingintelligenceapi.com" className="text-success">support@bankingintelligenceapi.com</a>.</p>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default Documentation;