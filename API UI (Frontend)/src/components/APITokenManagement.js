// src/components/APITokenManagement.js
import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Alert } from 'react-bootstrap';
import { authService } from '../services/auth';
import logger from '../utils/logger';

const APITokenManagement = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerateToken = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // You might want to get these from a form or context
      const clientId = localStorage.getItem('clientId');
      const clientSecret = localStorage.getItem('clientSecret');

      if (!clientId || !clientSecret) {
        throw new Error('Client credentials not found');
      }

      const generatedToken = await authService.generateApiToken(
        clientId, 
        clientSecret
      );

      setToken(generatedToken);
      setSuccess('API token generated successfully');
      
      // Optional: Save token to local storage
      localStorage.setItem('apiToken', generatedToken);

      logger.info('API Token generated');
    } catch (err) {
      setError(err.message || 'Failed to generate API token');
      logger.logError('API Token Generation', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      logger.info('API token copied to clipboard');
    }
  };

  return (
    <Container className="mt-5">
      <Card>
        <Card.Header>API Token Management</Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <div className="mb-3">
            <Button 
              variant="primary" 
              onClick={handleGenerateToken}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate New API Token'}
            </Button>
          </div>

          {token && (
            <Form.Group className="mb-3">
              <Form.Label>Your API Token</Form.Label>
              <div className="d-flex">
                <Form.Control
                  type="text"
                  value={token}
                  readOnly
                  className="text-monospace me-2"
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={handleCopyToken}
                >
                  Copy
                </Button>
              </div>
              <Form.Text className="text-muted">
                Keep this token secure and do not share it with anyone.
              </Form.Text>
            </Form.Group>
          )}

          <div className="mt-3">
            <h5>How to Use Your API Token</h5>
            <ol>
              <li>Generate a new token using the button above</li>
              <li>Copy the token</li>
              <li>Use the token in the Authorization header of your API requests</li>
              <li>Example: <code>Authorization: Bearer YOUR_TOKEN</code></li>
            </ol>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default APITokenManagement;