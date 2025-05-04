import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Nav, Form, InputGroup, Badge, Dropdown } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import Documentation from '../Documentation/Documentation';
import InsightsPanel from './InsightsPanel';
import './Dashboard.css';

// Example code for the playground
const apiExampleCode = `// Example: Generate financial insights
fetch('https://bankingintelligenceapi.com/api/insights/generate', {
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

const Dashboard = () => {
  const { user, clientStatus } = useAuth();
  const [activeSection, setActiveSection] = useState('playground');
  const [apiKey, setApiKey] = useState(() => {
    return user?.token || localStorage.getItem('token') || 'No API key found';
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am CLAU, your Banking Intelligence Assistant. How can I help you with your financial data today?',
      timestamp: new Date().toISOString()
    }
  ]);
  
  // State for insights panel
  const [insightsData, setInsightsData] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  
  // Add a ref to track the latest request ID
  const latestRequestIdRef = useRef(null);
  const chatEndRef = useRef(null);
  
  // Sample suggested prompts
  const suggestedPrompts = [
    "How much did I spend on dining out last month?",
    "What are my top expense categories?",
    "How can I improve my savings rate?",
    "Am I on track with my budget this month?"
  ];

  useEffect(() => {
    // Scroll to bottom of chat when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Generate a unique request ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };
  
  // Handle message submission
  const handleSendMessage = async () => {
    if (!query.trim()) return;
    
    // Add user message
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString()
    }]);
    
    // Show typing indicator
    setLoading(true);
    
    // Generate a request ID
    const requestId = generateRequestId();
    latestRequestIdRef.current = requestId;
    
    // Store the current query
    const currentQuery = query;
    
    // Clear input
    setQuery('');
    
    try {
      // Call insights service
      const data = await insightsService.generateInsights(currentQuery, requestId);
      
      // Check if this is still the latest request
      if (latestRequestIdRef.current !== requestId) {
        console.log('Ignoring outdated response');
        return;
      }
      
      // Extract insights
      let insightText = '';
      if (data && data.insights) {
        if (typeof data.insights === 'string') {
          insightText = data.insights;
        } else if (data.insights.insight) {
          insightText = data.insights.insight;
        } else if (data.insights.text) {
          insightText = data.insights.text;
        } else {
          insightText = JSON.stringify(data.insights);
        }
      } else {
        insightText = "I'm unable to generate insights at the moment. Please try again later.";
      }
      
      // Add assistant message with the response
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: insightText,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error generating insights:', error);
      
      // Add error message
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, but I encountered an error while generating insights. Please try again later.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle using a suggested prompt
  const handleSuggestedPrompt = (prompt) => {
    setQuery(prompt);
    
    // Focus input field after setting value
    document.getElementById('chat-input')?.focus();
  };
  
  // Handle insights request from insights panel
  const handleInsightRequest = async (query, requestId) => {
    setInsightLoading(true);
    setInsightError(null);
    
    try {
      const data = await insightsService.generateInsights(query, requestId);
      setInsightsData(data);
    } catch (error) {
      console.error('Error generating insights:', error);
      setInsightError(error.message || 'Failed to generate insights');
    } finally {
      setInsightLoading(false);
    }
  };
  
  // Handle copy to clipboard
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
  };
  
  // Render sections based on active section
  const renderContent = () => {
    switch(activeSection) {
      case 'playground':
        return (
          <div className="playground-layout">
            {/* Playground Header */}
            <div className="playground-header">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="text-white">Banking Intelligence Playground</h2>
                <div className="api-status">
                  <Badge bg="success" className="d-flex align-items-center">
                    <span className="status-indicator me-1"></span>
                    API Status: Online
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Chat Interface */}
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`message ${message.role === 'assistant' ? 'assistant-message' : 'user-message'}`}
                  >
                    <div className="message-avatar">
                      {message.role === 'assistant' ? (
                        <img 
                          src="/images/chat-icon.png" 
                          alt="AI Assistant" 
                          className="ai-avatar-image" 
                        />
                      ) : 'You'}
                    </div>
                    <div className="message-content">
                      <pre className="message-text">{message.content}</pre>
                      <div className="message-timestamp">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message assistant-message">
                    <div className="message-avatar">
                      <img 
                        src="/images/chat-icon.png" 
                        alt="AI Assistant" 
                        className="ai-avatar-image" 
                      />
                    </div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Suggested Prompts */}
              {chatMessages.length < 3 && (
                <div className="suggested-prompts">
                  <p className="text-white mb-2">Try asking:</p>
                  <div className="d-flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt, index) => (
                      <Button 
                        key={index}
                        variant="outline-success"
                        size="sm"
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="suggested-prompt-btn"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Input Area */}
              <div className="chat-input-container">
                <Form.Control
                  id="chat-input"
                  as="textarea"
                  rows={1}
                  placeholder="Ask about your financial data..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="chat-input text-black"
                />
                <Button 
                  variant="success"
                  className="send-button"
                  disabled={!query.trim() || loading}
                  onClick={handleSendMessage}
                >
                  <i className="bi bi-send"></i>
                </Button>
              </div>
              
              <div className="chat-footer">
                <p className="text-white small mb-0">
                  CLAU may produce inaccurate information about people, places, or financial advice.
                </p>
              </div>
            </div>
          </div>
        );
        
      case 'insights':
        return (
          <Container fluid className="py-4 px-4">
            <h2 className="text-white mb-4">Financial Insights</h2>
            <Row>
              <Col md={8}>
                <InsightsPanel 
                  insightsData={insightsData}
                  onInsightRequest={handleInsightRequest}
                  loading={insightLoading}
                  error={insightError}
                />
              </Col>
              <Col md={4}>
                <Card className="content-card h-100">
                  <Card.Header>Financial Tips</Card.Header>
                  <Card.Body>
                    <h5>Improving Your Finances</h5>
                    <p>Use the insights panel to get personalized financial advice based on your data.</p>
                    <hr className="border-secondary" />
                    <h6>Popular Queries</h6>
                    <ul className="mb-4">
                      <li>Spending analysis by category</li>
                      <li>Budget recommendations</li>
                      <li>Savings opportunities</li>
                      <li>Investment strategies</li>
                    </ul>
                    <Button 
                      variant="outline-success" 
                      onClick={() => setActiveSection('playground')}
                      className="w-100"
                    >
                      <i className="bi bi-chat-text me-2"></i>
                      Try Conversational Mode
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        );
        
      case 'api-keys':
        return (
          <Container fluid className="py-4 px-4">
            <h2 className="text-white mb-4">API Keys</h2>
            
            <Card className="content-card mb-4">
              <Card.Header>Your API Keys</Card.Header>
              <Card.Body>
                <div className="mb-4">
                  <h5 className="mb-3">Live API Key</h5>
                  <InputGroup className="mb-3">
                    <Form.Control
                      type="text"
                      value={apiKey}
                      readOnly
                      className="input-dark text-success"
                    />
                    <Button variant="outline-secondary" onClick={handleCopyKey}>
                      <i className="bi bi-clipboard"></i> Copy
                    </Button>
                  </InputGroup>
                  <div className="alert-warning p-3 rounded">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    Keep your API keys secret. They can be used to make API calls on behalf of your account.
                  </div>
                </div>
                
                <h5 className="mb-3">Client Credentials</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Client ID</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type="text"
                          value={localStorage.getItem('clientId') || 'client_id_not_found'}
                          readOnly
                          className="input-dark"
                        />
                        <Button variant="outline-secondary" onClick={() => navigator.clipboard.writeText(localStorage.getItem('clientId') || '')}>
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
                          type="password"
                          value="••••••••••••••••••••"
                          readOnly
                          className="input-dark"
                        />
                        <Button variant="outline-secondary">
                          <i className="bi bi-eye"></i>
                        </Button>
                        <Button variant="outline-secondary">
                          <i className="bi bi-clipboard"></i> Copy
                        </Button>
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Button variant="success" onClick={() => alert("This would generate a new API key in a real implementation.")}>
                  <i className="bi bi-key-fill me-2"></i>
                  Generate New API Key
                </Button>
              </Card.Body>
            </Card>
            
            <Card className="content-card">
              <Card.Header>API Key Usage</Card.Header>
              <Card.Body>
                <p>Your API key carries many privileges. Please keep it secure! Do not share your API key in publicly accessible areas such as GitHub, client-side code, or in requests to our API.</p>
                
                <h5 className="mt-4 mb-3">Authentication</h5>
                <p>Use your API key to authenticate requests to the Banking Intelligence API by providing it in the Authorization header:</p>
                <div className="code-snippet mb-4">
                  <code>Authorization: Bearer YOUR_API_KEY</code>
                </div>
                
                <div className="usage-stats p-4 bg-dark rounded">
                  <h6>This Month's Usage</h6>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="progress flex-grow-1 me-3" style={{ height: '10px' }}>
                      <div 
                        className="progress-bar bg-success" 
                        role="progressbar" 
                        style={{ width: '25%' }}
                        aria-valuenow="25" 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      ></div>
                    </div>
                    <div className="text-white">
                      250 / 1,000
                    </div>
                  </div>
                  <div className="text-muted mt-2">
                    API calls reset on June 1st
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Container>
        );
        
      case 'documentation':
        return <Documentation />;
        
      default:
        return (
          <Container fluid className="py-5 text-center">
            <h2 className="text-white mb-4">Welcome to Banking Intelligence API</h2>
            <p className="text-muted">Select a section from the sidebar to get started.</p>
            <div className="mt-4">
              <Button 
                variant="success" 
                size="lg"
                className="me-3"
                onClick={() => setActiveSection('playground')}
              >
                Try the Playground
              </Button>
              <Button 
                variant="outline-light"
                size="lg"
                onClick={() => setActiveSection('documentation')}
              >
                Read Documentation
              </Button>
            </div>
          </Container>
        );
    }
  };
  
  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h4 className="text-success mb-0">Banking Intelligence API</h4>
          <div className="preview-badge">Preview</div>
        </div>
        
        <Nav className="sidebar-nav">
          <Nav.Link 
            onClick={() => setActiveSection('home')} 
            className={`sidebar-link ${activeSection === 'home' ? 'active' : ''}`}
          >
            Home
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('documentation')} 
            className={`sidebar-link ${activeSection === 'documentation' ? 'active' : ''}`}
          >
            Documentation
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('playground')} 
            className={`sidebar-link ${activeSection === 'playground' ? 'active' : ''}`}
          >
            Playground
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('dashboard')} 
            className={`sidebar-link ${activeSection === 'dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('api-keys')} 
            className={`sidebar-link ${activeSection === 'api-keys' ? 'active' : ''}`}
          >
            API Keys
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('insights')} 
            className={`sidebar-link ${activeSection === 'insights' ? 'active' : ''}`}
          >
            Insights
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('usage')} 
            className={`sidebar-link ${activeSection === 'usage' ? 'active' : ''}`}
          >
            Usage
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('team-members')} 
            className={`sidebar-link ${activeSection === 'team-members' ? 'active' : ''}`}
          >
            Team Members
          </Nav.Link>
        </Nav>
      </div>
      
      {/* Main content area */}
      <div className="main-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;