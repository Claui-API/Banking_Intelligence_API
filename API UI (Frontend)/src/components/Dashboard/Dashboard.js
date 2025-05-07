import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Nav, Form, InputGroup, Badge, Dropdown } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import Documentation from '../Documentation/Documentation';
import './Dashboard.css';
import APIKeysManagement from '../APITokenManagement';

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
  // Changed the default active section from 'playground' to 'home'
  const [activeSection, setActiveSection] = useState('home');
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
        
      case 'api-keys':
        return <APIKeysManagement />;
        
      case 'documentation':
        return <Documentation />;
        
      case 'home':
      default:
        return (
          <Container fluid className="py-5">
            <Row className="justify-content-center text-center mb-5">
              <Col md={10}>
                <h2 className="text-white mb-4">Welcome to Banking Intelligence API</h2>
                <p className="text-white mb-4">Add AI-powered financial insights to your banking application</p>
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
              </Col>
            </Row>
            
            <Row className="mb-5 justify-content-center">
              <Col md={10}>
                <Card className="bg-black text-white">
                  <Card.Body className=" bg-black p-4">
                    <h3 className="text-success justify-content-center mb-3">Getting Started</h3>
                    <p>
                      The Banking Intelligence API lets you enhance your application with AI-powered financial insights.
                      Analyze transactions, provide budget recommendations, and help your users make better financial decisions.
                    </p>
                    
                    <Row className="mt-4 text-center">
                      <Col md={4}>
                        <div className="mb-3">
                          <i className="bi bi-chat-dots text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Try the Playground</h5>
                        <p className="small">Test queries and see responses in real-time</p>
                      </Col>
                      <Col md={4}>
                        <div className="mb-3">
                          <i className="bi bi-key text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Get Your API Keys</h5>
                        <p className="small">Generate keys to integrate with your app</p>
                      </Col>
                      <Col md={4}>
                        <div className="mb-3">
                          <i className="bi bi-book text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Read the Docs</h5>
                        <p className="small">Explore API endpoints and implementation</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            <h3 className="text-white text-center mb-4">Explore Our Features</h3>
            
            <Row className="g-4">
              <Col lg={4}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-chat-text text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">Playground</h4>
                    </div>
                    <p>
                      Test our AI in an interactive chat interface. Ask financial questions and see how the API responds in real-time.
                    </p>
                    <Button 
                      variant="outline-success" 
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('playground')}
                    >
                      Open Playground
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col lg={4}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-key-fill text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">API Keys</h4>
                    </div>
                    <p>
                      Manage your API keys and credentials for integrating the Banking Intelligence API with your applications and monitor your usage.
                    </p>
                    <Button 
                      variant="outline-success" 
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('api-keys')}
                    >
                      Manage API Keys
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col lg={4}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-book-half text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">Documentation</h4>
                    </div>
                    <p>
                      Comprehensive guides, API references, and code examples to help you integrate our financial AI into your app.
                    </p>
                    <Button 
                      variant="outline-success" 
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('documentation')}
                    >
                      View Documentation
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        );
    }
  };
  
  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h4 className="text-success mb-0">
            <a href="/" className="logo-link">
              <img 
                src="/images/chat-icon.png" 
                alt="AI Assistant" 
                className="sidebar-image-clau"/>
            </a>
          </h4>
        </div>
        
        <Nav className="sidebar-nav">
          <Nav.Link 
            onClick={() => setActiveSection('home')} 
            className={`sidebar-link ${activeSection === 'home' ? 'active' : ''}`}
          >
            <i className="bi bi-house-door me-2"></i>
            Home
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('documentation')} 
            className={`sidebar-link ${activeSection === 'documentation' ? 'active' : ''}`}
          >
            <i className="bi bi-book me-2"></i>
            Documentation
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('playground')} 
            className={`sidebar-link ${activeSection === 'playground' ? 'active' : ''}`}
          >
            <i className="bi bi-chat-text me-2"></i>
            Playground
          </Nav.Link>
          <Nav.Link 
            onClick={() => setActiveSection('api-keys')} 
            className={`sidebar-link ${activeSection === 'api-keys' ? 'active' : ''}`}
          >
            <i className="bi bi-key me-2"></i>
            API Keys
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