// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Button, Form, InputGroup, Container, Alert, Badge } from 'react-bootstrap';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import logger from '../../utils/logger';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  
  // Add state to track client approval status
  const [clientStatus, setClientStatus] = useState('unknown');
  
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
  const [error, setError] = useState('');
  const [insightsData, setInsightsData] = useState(null);
  
  // Add a ref to track the latest request ID
  const latestRequestIdRef = useRef(null);
  
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
    
    // Check client status from token
    if (user) {
      try {
        // Check for client ID in user object
        if (user.clientId) {
          // Make an API call to check client status or extract from token
          // For now, we'll use a mock status based on user role
          if (user.role === 'admin') {
            setClientStatus('active');
          } else {
            // In a real implementation, this would come from an API call or the token
            // This is just a placeholder for the example
            setClientStatus('pending'); 
          }
        }
      } catch (err) {
        logger.error('Error checking client status:', err);
      }
    }
  }, [user]);

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
      logger.logError('Insight Formatting', formatError);
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
      logger.logError('Suggested Question Handling', error);
    }
  };
  
  return (
    <Container fluid className="py-4 px-md-4 px-2 bg-black">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <h1 className="mb-4 text-white">API Dashboard</h1>
        
        {/* Show approval status alert if pending */}
        {clientStatus === 'pending' && (
          <Alert variant="warning" className="mb-4">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
              <div>
                <h5 className="mb-1">Your API access is pending approval</h5>
                <p className="mb-0">Your client account needs administrator approval before you can use the API. Please check back later or contact support.</p>
              </div>
            </div>
          </Alert>
        )}
        
        {/* Client Credentials section */}
        <Card className="bg-white text-black border-secondary mb-4">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <span>Client Credentials</span>
            {clientStatus !== 'unknown' && (
              <Badge bg={clientStatus === 'active' ? 'success' : 'warning'} className="text-capitalize">
                {clientStatus}
              </Badge>
            )}
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
            {/* Usage Stats - Simple version */}
            <Card className="bg-white text-black border-secondary mb-4">
              <Card.Header className="bg-white">API Usage Statistics</Card.Header>
              <Card.Body>
                <Row>
                  <Col sm={4} className="text-center mb-3 mb-sm-0">
                    <h3 className="text-success">152</h3>
                    <div className="text-secondary">Requests Today</div>
                  </Col>
                  <Col sm={4} className="text-center mb-3 mb-sm-0">
                    <h3 className="text-success">1,245</h3>
                    <div className="text-secondary">Requests This Month</div>
                  </Col>
                  <Col sm={4} className="text-center">
                    <h3 className="text-success">8,755</h3>
                    <div className="text-secondary">Remaining Quota</div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            
            {/* API Testing Console - Now using the same logic as InsightsPanel */}
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
            
            {/* Code Sample */}
            <Card className="bg-white text-black border-secondary">
              <Card.Header className="bg-white">Integration Example</Card.Header>
              <Card.Body>
                <Card.Text className="mb-3">
                  Here's how to call the API in your application:
                </Card.Text>
                <div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
                  <pre className="text-success mb-0" style={{ fontSize: '0.9rem' }}>
{`// Example: Generate financial insights
fetch('https://api.banking-intelligence.com/v1/insights/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKey}'
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
})`}
                  </pre>
                </div>
                <div className="text-end mt-3">
                  <Button variant="link" className="text-success" href="/docs">View Full Documentation →</Button>
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
              <Button 
                variant="outline-success" 
                as={Link} 
                to="/docs"
                className="mt-3"
              >
                View API Documentation
              </Button>
            </Card.Body>
          </Card>
        )}
      </div>
    </Container>
  );
};

export default Dashboard;