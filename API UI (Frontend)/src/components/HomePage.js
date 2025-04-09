// src/components/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Image } from 'react-bootstrap';
import './HomePage.css'; // Import the CSS file

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="home-page-container">
      {/* Header section */}
      <div className="text-center py-4">
        <Container>
          <h1 className="text-white mb-0" style={{ 
            fontSize: '3.5rem', 
            fontWeight: '900', 
            letterSpacing: '-0.03em',
            fontFamily: "'Inter Display', 'Inter', sans-serif",
            textTransform: 'none'
          }}>Banking Intelligence API</h1>
        </Container>
      </div>

      {/* App Overview section */}
      <Container className="py-4 text-center">
        <div className="mb-4">
          <div 
            className="mx-auto mb-5" 
            style={{ 
              maxWidth: '600px', 
              background: 'linear-gradient(90deg, #00c6ff, #ff00de)', 
              padding: '2px',
              borderRadius: '4px'
            }}
          >
            <div style={{ background: '#222', padding: '15px' }}>
              {/* YouTube video embed */}
              <div className="ratio ratio-16x9" style={{ maxWidth: '100%' }}>
                <iframe
                  src="https://www.youtube.com/embed/hMO6E50YSXU?si=KLrgifAyC5Pb1uCC"
                  title="Banking Intelligence Demo"
                  allowFullScreen
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                ></iframe>
              </div>
            </div>
          </div>
          
          <p className="text-white mx-auto" style={{ maxWidth: '600px', fontSize: '1.5rem' }}>
          Add AI-powered financial insights to your banking application with the CLAU Banking Intelligence API
          </p>
          
          <div className="d-flex justify-content-center gap-3 mt-4">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-success">
                Go to API Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-success">
                  Get Your API Key
                </Link>
                <Link to="/docs" className="btn btn-outline-success">
                  View Documentation
                </Link>
              </>
            )}
          </div>
        </div>
      </Container>

      {/* Features section */}
      <Container className="py-5">
        <h2 className="text-success text-center mb-5">Key Features</h2>
        <Row className="g-4">
          <Col md={4}>
            <Card className="h-100 text-white border-secondary">
              <Card.Body>
                <div className="text-success mb-3">
                  <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem' }}></i>
                </div>
                <Card.Title>Contextualized Insights</Card.Title>
                <Card.Text>
                  Transform raw financial data into personalized insights that help your users make better financial decisions.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="h-100 text-white border-secondary">
              <Card.Body>
                <div className="text-success mb-3">
                  <i className="bi bi-robot" style={{ fontSize: '2rem' }}></i>
                </div>
                <Card.Title>AI-Powered Analysis</Card.Title>
                <Card.Text>
                  CLAU's advanced AI analyzes spending patterns, identifies savings opportunities, and provides smart recommendations.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="h-100 text-white border-secondary">
              <Card.Body>
                <div className="text-success mb-3">
                  <i className="bi bi-code-square" style={{ fontSize: '2rem' }}></i>
                </div>
                <Card.Title>Simple Integration</Card.Title>
                <Card.Text>
                  Easy-to-use REST API with comprehensive documentation. Integrate with your app in minutes, not days.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* How it works section */}
      <Container className="py-5 rounded my-5">
        <h2 className="text-success text-center mb-5">How It Works</h2>
        
        <Row className="align-items-center mb-5">
          <Col md={6}>
            <div className="bg-success p-4 rounded mb-3 mb-md-0">
              <h4 className="text-white">1. Register for an API Key</h4>
              <p className="text-light">Create an account and get your API key to integrate our services.</p>
            </div>
          </Col>
          <Col md={6}>
            <pre className="bg-black p-3 rounded text-white">
              <code>
              # Step 1: Create an account and get your API key
              API_KEY = "your_api_key_here"
              </code>
            </pre>
          </Col>
        </Row>
        
        <Row className="align-items-center mb-5">
          <Col md={{span: 6, order: 'last'}}>
            <div className="bg-success p-4 rounded mb-3 mb-md-0">
              <h4 className="text-white">2. Connect User Data</h4>
              <p className="text-light">Send financial data to our API via secure endpoints.</p>
            </div>
          </Col>
          <Col md={6}>
            <pre className="bg-black p-3 rounded text-white">
              <code>
              # Step 2: Send financial data
              user_data = {"{"}
                "accounts": [...],
                "transactions": [...]
              {"}"}
              </code>
            </pre>
          </Col>
        </Row>
        
        <Row className="align-items-center">
          <Col md={6}>
            <div className="bg-success p-4 rounded mb-3 mb-md-0">
              <h4 className="text-white">3. Get Personalized Insights</h4>
              <p className="text-light">Receive AI-powered financial insights to display in your app.</p>
            </div>
          </Col>
          <Col md={6}>
            <pre className="bg-black p-3 rounded text-white">
              <code>
              # Step 3: Request insights
              insights = api.get_insights(
                query="How can I save money?",
                user_data=user_data
              )
              </code>
            </pre>
          </Col>
        </Row>
      </Container>

      {/* Call to action */}
      <Container className="py-5 text-center">
        <h2 className="text-success mb-4">Ready to enhance your banking app?</h2>
        <p className="text-light mb-4">Join fintech companies already using our API to provide personalized financial guidance</p>
        <Link to="/register" className="btn btn-success btn-lg">
          Get Started Today
        </Link>
      </Container>
    </div>
  );
};

export default HomePage;