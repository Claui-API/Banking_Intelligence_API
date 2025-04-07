// src/components/Auth/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, Modal } from 'react-bootstrap';
import logger from '../../utils/logger';

const Login = () => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginResult = await login({ clientId, clientSecret });
      
      // Check if this is a first-time login or requires additional steps
      if (loginResult.requiresTokenGeneration) {
        // Show modal for token generation
        setGeneratedToken(loginResult.token);
        setShowTokenModal(true);
      } else {
        // Standard login - navigate to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      logger.logError('Login Error', err);
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTokenModal = () => {
    if (generatedToken) {
      // Store the generated token
      localStorage.setItem('token', generatedToken);
    }
    
    setShowTokenModal(false);
    navigate('/dashboard');
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      logger.info('Authentication token copied to clipboard');
    }
  };

  return (
    <>
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Card className="w-100" style={{ maxWidth: '400px' }}>
          <Card.Body>
            <h2 className="text-center mb-4">Sign in to your account</h2>

            {error && (
              <Alert variant="danger">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Client ID</Form.Label>
                <Form.Control
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  placeholder="Enter Client ID"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Client Secret</Form.Label>
                <Form.Control
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                  placeholder="Enter Client Secret"
                />
              </Form.Group>

              <Button
                variant="success"
                type="submit"
                className="w-100"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center mt-3">
                <a href="/register" className="text-decoration-none">
                  Don't have an account? Register
                </a>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>

      {/* Token Generation Modal */}
      <Modal show={showTokenModal} onHide={handleCloseTokenModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Authentication Token</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            This is your unique authentication token. Please save it securely.
            You'll need this token to access the API.
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label>Your Authentication Token</Form.Label>
            <Form.Control
              type="text"
              value={generatedToken || ''}
              readOnly
              className="text-monospace"
            />
          </Form.Group>
          
          <div className="d-flex justify-content-between">
            <Button 
              variant="outline-secondary" 
              onClick={handleCopyToken}
            >
              Copy Token
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCloseTokenModal}
            >
              Continue to Dashboard
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer className="text-muted small">
          <p>
            <i className="bi bi-exclamation-triangle me-2"></i>
            Keep this token confidential. Do not share it with anyone.
          </p>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Login;