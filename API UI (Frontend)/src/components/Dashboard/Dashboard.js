// Modified Dashboard.js with improved API data handling
import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Row, Col, Card, Button, Form, InputGroup, Container, Alert, Badge } from 'react-bootstrap';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import logger from '../../utils/logger';
import './Dashboard.css';
import ApiDebugPanel from '../Debug/ApiDebugPanel';

const codeString = `// Example: Generate financial insights
fetch('https://api.banking-intelligence.com/v1/insights/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer \${apiKey}'
  },
  body: JSON.stringify({
    query: 'How can I improve my savings?',
    userData: {
      accounts: [
        { accountId: 'acc-1', type: 'Checking', balance: 1250.50 },
        { accountId: 'acc-2', type: 'Savings', balance: 5000.00 }
      ],
      transactions: [
        { transactionId: 'txn-1', date: '2025-03-15', description: 'Grocery Store', amount: -85.20 },
        { transactionId: 'txn-2', date: '2025-03-14', description: 'Salary Deposit', amount: 3000.00 }
      ]
    }
  })
})`;

const CodeBlock = () => (
  <div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
    <SyntaxHighlighter language="javascript" style={oneDark} wrapLongLines customStyle={{ fontSize: '0.9rem', margin: 0 }}>
      {codeString}
    </SyntaxHighlighter>
  </div>
);

const Dashboard = () => {
  const { user, clientStatus, refreshClientStatus, isLoading } = useAuth();
  
  // State for UI
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(process.env.NODE_ENV !== 'production');
  
  // Data state
  const [financialData, setFinancialData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  
  // Initialize with the token from auth context or localStorage
  const [apiKey, setApiKey] = useState(() => {
    return user?.token || localStorage.getItem('token') || 'No API key found';
  });
  
  // Store client credentials
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('clientId') || 'No Client ID found';
  });
  
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  
  // Add a ref to track the latest request ID
  const latestRequestIdRef = useRef(null);
  // Track last refresh time
  const lastRefreshTime = useRef(0);
  
  // Load financial data on mount
  useEffect(() => {
    fetchFinancialData();
  }, []);
  
  // Only refresh status on initial mount, not on every render
  useEffect(() => {
    // Skip automatic refresh if refreshed recently (within last 15 seconds)
    const now = Date.now();
    if (now - lastRefreshTime.current > 15000) {
      handleStatusRefresh();
    }
  }, []); // Empty dependency array means this runs once on mount
  
  // Update API key if user or token changes
  useEffect(() => {
    if (user?.token) {
      setApiKey(user.token);
    } else {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setApiKey(storedToken);
      }
    }
    
    // Try to load client secret if it exists
    const storedSecret = localStorage.getItem('clientSecret');
    if (storedSecret) {
      setClientSecret(storedSecret);
    }
  }, [user]);

  // Fetch financial data
  const fetchFinancialData = async () => {
    setDataLoading(true);
    setDataError(null);
    
    try {
      const data = await insightsService.getFinancialSummary();
      
      // Log detailed information about the data
      logger.info('Financial data fetched successfully', {
        dataPresent: !!data,
        hasAccounts: !!(data && data.accounts),
        hasTransactions: !!(data && data.recentTransactions),
        accountCount: data?.accounts?.length || 0,
        transactionCount: data?.recentTransactions?.length || 0,
        isMockData: checkIfMockData(data)
      });
      
      setFinancialData(data);
    } catch (err) {
      logger.error('Error fetching financial data', err);
      setDataError(err.message || 'Failed to load financial data');
    } finally {
      setDataLoading(false);
    }
  };
  
  // Check if the data appears to be mock data
  const checkIfMockData = (data) => {
    if (!data) return false;
    
    // Check if accounts have mock in their IDs
    const hasMockAccounts = data.accounts && 
      data.accounts.some(acc => 
        acc.accountId && acc.accountId.includes('mock')
      );
    
    // Check if transactions have mock in their IDs
    const hasMockTransactions = data.recentTransactions && 
      data.recentTransactions.some(tx => 
        tx.transactionId && tx.transactionId.includes('mock')
      );
    
    return hasMockAccounts || hasMockTransactions;
  };

  // Handle manual status refresh with debounce
  const handleStatusRefresh = async () => {
    // Prevent rapid multiple refreshes
    const now = Date.now();
    if (now - lastRefreshTime.current < 5000) { // 5 second cooldown
      logger.info('Skipping refresh, too soon after last refresh');
      return;
    }
    
    if (!refreshClientStatus) return;
    
    try {
      setRefreshing(true);
      lastRefreshTime.current = now;
      
      await refreshClientStatus();
      logger.info(`Manual status refresh completed, status: ${clientStatus}`);
      
    } catch (error) {
      logger.error('Error refreshing status:', error);
    } finally {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000); // Ensure refresh indicator shows for at least 1 second for UX
    }
  };
  
  // Generate a unique request ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };
  
  const handleDemoRequest = async (queryText, requestId) => {
    // If no requestId is provided, generate a new one
    const currentRequestId = requestId || generateRequestId();
    latestRequestIdRef.current = currentRequestId;
    
    setLoading(true);
    setError('');
    
    // Reset insights data to empty string to start streaming
    setInsightsData({
      insights: '',
      timestamp: new Date().toISOString(),
      requestId: currentRequestId,
      isStreaming: true
    });
    
    try {
      // Use your insightsService to make the API call
      const data = await insightsService.generateInsights(queryText, currentRequestId);
      
      // Check if this request is still the latest
      if (latestRequestIdRef.current !== currentRequestId) {
        logger.info('Ignoring outdated API response', {
          requestId: currentRequestId,
          latestRequestId: latestRequestIdRef.current
        });
        return;
      }
      
      // Extract the insight text
      let insightText = '';
      if (data.insights) {
        if (typeof data.insights === 'string') {
          insightText = data.insights;
        } else if (data.insights.insight) {
          insightText = data.insights.insight;
        } else if (data.insights.text) {
          insightText = data.insights.text;
        } else {
          insightText = JSON.stringify(data.insights);
        }
      }
      
      // Now let's simulate streaming even though we have the full response
      // This gives a better UX than showing it all at once
      const words = insightText.split(' ');
      const chunks = [];
      let currentChunk = [];
      
      // Create chunks of 2-5 words for natural streaming
      words.forEach(word => {
        currentChunk.push(word);
        if (currentChunk.length >= (Math.floor(Math.random() * 4) + 2)) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [];
        }
      });
      
      // Add any remaining words
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
      }
      
      // Stream the chunks with a variable delay
      let streamedText = '';
      let chunkIndex = 0;
      
      const streamNextChunk = () => {
        // Stop if this is no longer the latest request
        if (latestRequestIdRef.current !== currentRequestId) {
          logger.info('Stopping stream for outdated request', {
            requestId: currentRequestId,
            latestRequestId: latestRequestIdRef.current
          });
          return;
        }
        
        if (chunkIndex < chunks.length) {
          // Add the next chunk
          streamedText += (chunkIndex > 0 ? ' ' : '') + chunks[chunkIndex];
          
          // Update the insights data with the current streamed text
          setInsightsData({
            insights: streamedText,
            timestamp: data.timestamp || new Date().toISOString(),
            requestId: currentRequestId,
            isStreaming: true
          });
          
          chunkIndex++;
          
          // Random delay between chunks for natural typing effect (30-90ms)
          const delay = Math.floor(Math.random() * 60) + 30;
          setTimeout(streamNextChunk, delay);
        } else {
          // Streaming complete
          setInsightsData({
            insights: streamedText,
            timestamp: data.timestamp || new Date().toISOString(),
            requestId: currentRequestId,
            isStreaming: false
          });
          setLoading(false);
          
          logger.info('API insight streaming completed', {
            query: queryText,
            requestId: currentRequestId
          });
        }
      };
      
      // Start streaming after a short initial delay (simulates AI "thinking")
      setTimeout(streamNextChunk, 300);
      
    } catch (error) {
      logger.error('Error generating insights:', error);
      setError(`Failed to generate insights: ${error.message}`);
      setLoading(false);
      
      // Clear the streaming state
      setInsightsData(null);
    }
  };
  
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    logger.info('API key copied to clipboard');
  };
  
  const handleCopyClientId = () => {
    navigator.clipboard.writeText(clientId);
    logger.info('Client ID copied to clipboard');
  };
  
  const handleCopyClientSecret = () => {
    navigator.clipboard.writeText(clientSecret);
    logger.info('Client secret copied to clipboard');
  };
  
  const handleSaveClientSecret = () => {
    if (clientSecret) {
      localStorage.setItem('clientSecret', clientSecret);
      alert('Client secret saved!');
    }
  };
  
  const handleRegenerateKey = (e) => {
    e.preventDefault();
    // In a real application, this would make an API call to regenerate the token
    alert("In a production environment, this would regenerate your API key.");
  };
  
  // Format insight text to handle markdown-style formatting
  const formatInsight = (text) => {
    if (!text) return '';
    
    try {
      // Replace ** bold ** with actual bold text
      const boldFormatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Handle line breaks
      const withLineBreaks = boldFormatted
        .replace(/\n\n/g, '<br /><br />')
        .replace(/\n/g, '<br />');
      
      // Handle bullet points
      const withBullets = withLineBreaks.replace(/- (.*?)(<br \/>|$)/g, '<li>$1</li>');
      
      // Wrap bullet points in ul if they exist
      const finalText = withBullets.includes('<li>') 
        ? withBullets.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>') 
        : withBullets;
      
      return finalText;
    } catch (formatError) {
      logger.error('Insight Formatting', formatError);
      return text;
    }
  };
  
  // Extract insight text from various possible formats
  const getInsightText = () => {
    if (!insightsData || !insightsData.insights) return '';
    
    // Try different possible formats
    if (typeof insightsData.insights === 'string') {
      return insightsData.insights;
    }
    
    if (insightsData.insights.insight) {
      return insightsData.insights.insight;
    }
    
    if (insightsData.insights.text) {
      return insightsData.insights.text;
    }
    
    // Last resort: stringify the object
    return JSON.stringify(insightsData.insights);
  };
  
  const suggestedQuestions = [
    "How is my spending compared to last month?",
    "Where am I spending the most money?",
    "How can I improve my financial health?",
    "Am I on track for my savings goals?"
  ];
  
  const handleSuggestedQuestion = (suggestion) => {
    try {
      setQuery(suggestion);
      // Generate a new request ID for the suggested question
      const requestId = generateRequestId();
      logger.info(`Selected suggested insight: ${suggestion}`, {
        requestId: requestId
      });
      
      handleDemoRequest(suggestion, requestId);
    } catch (error) {
      logger.error('Suggested Question Handling', error);
    }
  };
  
  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="mb-0 text-white">API Dashboard</h1>
          <Button 
            variant={showDebugPanel ? "danger" : "success"} 
            size="sm"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
          >
            {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
          </Button>
        </div>
        
        {/* Show debug panel if enabled */}
        {showDebugPanel && <ApiDebugPanel />}
        
        {/* Show data source alert */}
        {financialData && !dataLoading && (
          <Alert variant={checkIfMockData(financialData) ? "warning" : "success"} className="mb-4">
            <div className="d-flex align-items-center">
              <i className={`bi ${checkIfMockData(financialData) ? "bi-exclamation-triangle" : "bi-check-circle"} fs-4 me-3`}></i>
              <div>
                {checkIfMockData(financialData) ? (
                  <>
                    <h5 className="mb-1">Using Mock Data</h5>
                    <p className="mb-0">Your application is currently using mock data instead of real data from the API.</p>
                    <Button 
                      variant="outline-dark" 
                      size="sm" 
                      className="mt-2"
                      onClick={fetchFinancialData}
                    >
                      Retry Fetching Real Data
                    </Button>
                  </>
                ) : (
                  <>
                    <h5 className="mb-1">Using Real API Data</h5>
                    <p className="mb-0">Your application is successfully retrieving real data from the API.</p>
                  </>
                )}
              </div>
            </div>
          </Alert>
        )}
        
        {/* Show approval status alert if pending */}
        {clientStatus === 'pending' && (
          <Alert variant="warning" className="mb-4">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
              <div>
                <h5 className="mb-1">Your API access is pending approval</h5>
                <p className="mb-0">Your client account needs administrator approval before you can use the API. Please check back later or contact support.</p>
                <Button 
                  variant="outline-dark" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleStatusRefresh}
                  disabled={refreshing || isLoading}
                >
                  {refreshing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Refreshing...
                    </>
                  ) : 'Refresh Status'}
                </Button>
              </div>
            </div>
          </Alert>
        )}
        
        {/* Client Credentials section */}
        <Card className="bg-white text-black border-secondary mb-4">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <span>Client Credentials</span>
            <div className="d-flex align-items-center gap-2">
              {clientStatus !== 'unknown' && (
                <Badge bg={clientStatus === 'active' ? 'success' : 'warning'} className="text-capitalize">
                  {clientStatus}
                </Badge>
              )}
              <Button 
                variant="outline-secondary"
                size="sm"
                onClick={handleStatusRefresh}
                disabled={refreshing || isLoading}
              >
                {refreshing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  </>
                ) : (
                  <i className="bi bi-arrow-clockwise"></i>
                )}
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Client ID</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={clientId}
                      readOnly
                      className="bg-white text-success border-primary text-truncate"
                    />
                    <Button variant="outline-secondary" onClick={handleCopyClientId}>
                      <i className="bi bi-clipboard"></i> Copy
                    </Button>
                  </InputGroup>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Client Secret</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showSecret ? "text" : "password"}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Enter your client secret"
                      className="bg-white text-success border-primary"
                    />
                    <Button variant="outline-secondary" onClick={() => setShowSecret(!showSecret)}>
                      <i className={`bi bi-eye${showSecret ? '-slash' : ''}`}></i>
                    </Button>
                    <Button variant="outline-secondary" onClick={handleCopyClientSecret} disabled={!clientSecret}>
                      <i className="bi bi-clipboard"></i> Copy
                    </Button>
                    <Button variant="outline-primary" onClick={handleSaveClientSecret} disabled={!clientSecret}>
                      Save
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    {clientSecret ? 'Client secret will be saved locally for this session.' : 'Enter your client secret to save it for this session.'}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* API Key section */}
        <Card className="bg-white text-black border-secondary mb-4">
          <Card.Header className="bg-white">Your API Key</Card.Header>
          <Card.Body>
            <InputGroup className="mb-3">
              <Form.Control
                type="text"
                value={apiKey}
                readOnly
                className="bg-white text-success border-primary text-truncate"
              />
              <Button variant="outline-secondary" onClick={handleCopyKey}>
                <i className="bi bi-clipboard"></i> Copy
              </Button>
            </InputGroup>
            <Card.Text className="text-black small">
              Use this API key to authenticate your requests to the Banking Intelligence API.
              Keep this key secret and secure. <a href="#" className="text-success" onClick={handleRegenerateKey}>Regenerate key</a> if compromised.
            </Card.Text>
          </Card.Body>
        </Card>
        
        {/* Conditional rendering for the rest of the Dashboard */}
        {clientStatus === 'active' ? (
          <>
            {/* API Testing Console */}
            <Card className="bg-white text-black border-secondary mb-4">
              <Card.Header className="bg-white">API Testing Console</Card.Header>
              <Card.Body>
                <Card.Text>
                  Test the Banking Intelligence API with sample queries to see how it generates insights.
                </Card.Text>
                
                <Form onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) {
                    const requestId = generateRequestId();
                    handleDemoRequest(query, requestId);
                  }
                }} className="mb-4 text-black">
                  <Form.Label>Sample Financial Query:</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="E.g., How can I save more money?"
                      className="bg-white text-success border-secondary input-white-placeholder"
                    />
                    <Button 
                      variant="success" 
                      type="submit"
                      disabled={loading || !query.trim()}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          <span>Loading...</span>
                        </>
                      ) : 'Send'}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-secondary">
                    This uses real API calls to generate insights based on your query.
                  </Form.Text>
                </Form>
                
                <Card className="bg-white border-secondary">
                  <Card.Header className="bg-white text-black">Response</Card.Header>
                  <Card.Body>
                    {(loading && !insightsData) ? (
                      <div className="text-center p-4">
                        <div className="spinner-border text-success" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-secondary mt-3">Analyzing your financial data...</p>
                      </div>
                    ) : error ? (
                      <div className="alert alert-danger">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {error}
                      </div>
                    ) : insightsData ? (
                      <>
                        <div className="text-muted small mb-2">
                          {new Date(insightsData.timestamp).toLocaleString()}
                        </div>
                        <div className="insights-content text-success">
                          <div dangerouslySetInnerHTML={{ __html: formatInsight(getInsightText()) }} />
                          {insightsData.isStreaming && (
                            <span className="cursor-blink">|</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-secondary p-4">
                        <i className="bi bi-lightbulb me-2"></i>
                        Submit a query to see AI-generated financial insights.
                      </div>
                    )}
                  </Card.Body>
                </Card>
                
                <div className="mt-4">
                  <h6 className="text-secondary mb-3">Try these sample questions:</h6>
                  <div className="d-grid gap-2">
                    {suggestedQuestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline-secondary"
                        size="sm"
                        className="bg-success bg-opacity-50 text-black text-start"
                        onClick={() => handleSuggestedQuestion(suggestion)}
                        disabled={loading}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card.Body>
            </Card>
            
            {/* Financial Data Display */}
            {financialData && (
              <Card className="bg-white text-black border-secondary mb-4">
                <Card.Header className="bg-white">Financial Summary</Card.Header>
                <Card.Body>
                  {dataLoading ? (
                    <div className="text-center p-4">
                      <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="text-secondary mt-3">Loading financial data...</p>
                    </div>
                  ) : dataError ? (
                    <Alert variant="danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {dataError}
                    </Alert>
                  ) : (
                    <>
                      <Row className="mb-4">
                        <Col md={6} lg={3} className="mb-3">
                          <div className="bg-light p-3 rounded">
                            <div className="text-muted small mb-2">Total Balance</div>
                            <div className="h4">
                              ${financialData.totalBalance?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </Col>
                        <Col md={6} lg={3} className="mb-3">
                          <div className="bg-light p-3 rounded">
                            <div className="text-muted small mb-2">Net Worth</div>
                            <div className="h4">
                              ${financialData.netWorth?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </Col>
                        <Col md={6} lg={3} className="mb-3">
                          <div className="bg-light p-3 rounded">
                            <div className="text-muted small mb-2">Accounts</div>
                            <div className="h4">
                              {financialData.accounts?.length || 0}
                            </div>
                          </div>
                        </Col>
                        <Col md={6} lg={3} className="mb-3">
                          <div className="bg-light p-3 rounded">
                            <div className="text-muted small mb-2">Data Source</div>
                            <div className="h4 text-nowrap">
                              {checkIfMockData(financialData) ? (
                                <Badge bg="warning">Mock Data</Badge>
                              ) : (
                                <Badge bg="success">Real API</Badge>
                              )}
                            </div>
                          </div>
                        </Col>
                      </Row>
                      
                      {/* Accounts Table */}
                      {financialData.accounts && financialData.accounts.length > 0 && (
                        <>
                          <h5 className="mt-4 mb-3">Accounts</h5>
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th>Account</th>
                                  <th>Type</th>
                                  <th>Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {financialData.accounts.map(account => (
                                  <tr key={account.accountId}>
                                    <td>{account.name || 'Account'}</td>
                                    <td>{account.type || 'Other'}</td>
                                    <td className={account.balance < 0 ? 'text-danger' : 'text-success'}>
                                      ${account.balance?.toFixed(2) || '0.00'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                      
                      {/* Recent Transactions */}
                      {financialData.recentTransactions && financialData.recentTransactions.length > 0 && (
                        <>
                          <h5 className="mt-4 mb-3">Recent Transactions</h5>
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Description</th>
                                  <th>Category</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {financialData.recentTransactions.map(tx => (
                                  <tr key={tx.transactionId}>
                                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                                    <td>{tx.description || 'Transaction'}</td>
                                    <td>{tx.category || 'Other'}</td>
                                    <td className={tx.amount < 0 ? 'text-danger' : 'text-success'}>
                                      ${Math.abs(tx.amount).toFixed(2)}
                                      {tx.amount < 0 ? ' (debit)' : ' (credit)'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>
            )}
            
            {/* Code Sample */}
            <Card className="bg-white text-black border-secondary">
							<Card.Header className="bg-white">Integration Example</Card.Header>
							<Card.Body>
								<Card.Text className="mb-3">
									Here's how to call the API in your application:
								</Card.Text>

								{/* ✅ Render CodeBlock component */}
								<CodeBlock />

								<div className="text-end mt-3">
									<Button variant="link" className="text-success" href="/docs">
										View Full Documentation →
									</Button>
								</div>
							</Card.Body>
						</Card>
          </>
        ) : (
          <Card className="bg-white text-black border-secondary mb-4">
            <Card.Header className="bg-white">API Access Pending</Card.Header>
            <Card.Body className="text-center py-5">
              <i className="bi bi-hourglass-split text-warning" style={{ fontSize: '4rem' }}></i>
              <h3 className="mt-4">Your API Access is Pending Approval</h3>
              <p className="text-muted mx-auto" style={{ maxWidth: '600px' }}>
                Your client account has been registered and is awaiting administrator approval. 
                You'll be able to access the API once your account is approved.
              </p>
              <div className="d-flex justify-content-center gap-3 mt-3">
                <Button 
                  variant="outline-success" 
                  as={Link} 
                  to="/docs"
                >
                  View API Documentation
                </Button>
                <Button 
                  variant="outline-primary"
                  onClick={handleStatusRefresh}
                  disabled={refreshing || isLoading}
                >
                  {refreshing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Refreshing...
                    </>
                  ) : 'Refresh Status'}
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}
      </div>
    </Container>
  );
};

export default Dashboard;