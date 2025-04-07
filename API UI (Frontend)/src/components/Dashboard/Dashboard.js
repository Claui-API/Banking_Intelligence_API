// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger';

const Dashboard = () => {
  const { user } = useAuth();
  
  // Initialize with the token from auth context or localStorage
  const [apiKey, setApiKey] = useState(() => {
    return user?.token || localStorage.getItem('token') || 'No API key found';
  });
  
  const [insights, setInsights] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
  }, [user]);
  
  // Generate a unique request ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };
  
  const handleDemoRequest = () => {
    setLoading(true);
    const requestId = generateRequestId();
    
    // Simulate API request
    setTimeout(() => {
      if (query.toLowerCase().includes('hello') || query.toLowerCase().includes('hi')) {
        setInsights("👋 Hey there! I'm CLAU, your AI financial assistant. How can I help with your finances today?");
      } else if (query.toLowerCase().includes('save') || query.toLowerCase().includes('saving')) {
        setInsights("Based on your spending patterns, I recommend cutting subscription costs. You're currently spending $65.75 monthly on services you rarely use. Cancelling these could save you approximately $788 per year! 💰");
      } else if (query.toLowerCase().includes('spend') || query.toLowerCase().includes('budget')) {
        setInsights("Looking at your March spending: you've spent $1,245 so far, which is 15% higher than February. Your top categories are Dining ($340), Transportation ($295), and Entertainment ($210). I notice weekend dining makes up 60% of your food budget - maybe try meal prepping to reduce this expense? 📊");
      } else {
        setInsights("Based on the financial data provided, I can see several opportunities for improvement. Your monthly expenses on non-essential items is approximately 25% of your income. The industry recommendation is to keep this under 20%. Consider reviewing your subscription services and entertainment expenses for potential savings.");
      }
      setLoading(false);
    }, 1500);
  };
  
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    logger.info('API key copied to clipboard');
  };
  
  const handleRegenerateKey = (e) => {
    e.preventDefault();
    // In a real application, this would make an API call to regenerate the token
    alert("In a production environment, this would regenerate your API key.");
  };
  
  return (
    <div className="py-4 px-3 bg-black">
      <h1 className="mb-4 text-white">API Dashboard</h1>
      
      {/* API Key section */}
      <Card className="bg-dark text-light border-secondary mb-4">
        <Card.Header className="bg-dark">Your API Credentials</Card.Header>
        <Card.Body>
          <InputGroup className="mb-3">
            <Form.Control
              type="text"
              value={apiKey}
              readOnly
              className="bg-black text-white border-secondary"
            />
            <Button variant="outline-secondary" onClick={handleCopyKey}>
              <i className="bi bi-clipboard"></i> Copy
            </Button>
          </InputGroup>
          <Card.Text className="text-secondary small">
            Use this API key to authenticate your requests to the Banking Intelligence API.
            Keep this key secret and secure. <a href="#" className="text-success" onClick={handleRegenerateKey}>Regenerate key</a> if compromised.
          </Card.Text>
        </Card.Body>
      </Card>
      
      {/* Usage Stats - Simple version */}
      <Card className="bg-dark text-light border-secondary mb-4">
        <Card.Header className="bg-dark">API Usage Statistics</Card.Header>
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
      
      {/* API Testing Console */}
      <Card className="bg-dark text-light border-secondary mb-4">
        <Card.Header className="bg-dark">API Testing Console</Card.Header>
        <Card.Body>
          <Card.Text>
            Test the Banking Intelligence API with sample queries to see how it generates insights.
          </Card.Text>
          
          <Form.Group className="mb-3">
            <Form.Label>Sample Financial Query:</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="E.g., How can I save more money?"
                className="bg-black text-light border-secondary"
              />
              <Button 
                variant="success" 
                onClick={handleDemoRequest}
                disabled={loading || !query.trim()}
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Send'}
              </Button>
            </InputGroup>
            <Form.Text className="text-secondary">
              This is a demo. In production, you would include user financial data.
            </Form.Text>
          </Form.Group>
          
          <Card className="bg-black border-secondary mt-4">
            <Card.Header className="bg-black text-secondary">Response</Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : (
                <pre className="text-light mb-0" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                  {insights || "Submit a query to see a response..."}
                </pre>
              )}
            </Card.Body>
          </Card>
        </Card.Body>
      </Card>
      
      {/* Code Sample */}
      <Card className="bg-dark text-light border-secondary">
        <Card.Header className="bg-dark">Integration Example</Card.Header>
        <Card.Body>
          <Card.Text className="mb-3">
            Here's how to call the API in your application:
          </Card.Text>
          <div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
            <pre className="text-light mb-0" style={{ whiteSpace: 'pre-wrap' }}>
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
            <Button variant="link" className="text-success">View Full Documentation →</Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Dashboard;