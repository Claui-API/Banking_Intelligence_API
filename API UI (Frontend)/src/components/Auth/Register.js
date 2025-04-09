// src/components/Auth/Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, InputGroup, Modal } from 'react-bootstrap';

const Register = () => {
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const result = await register({ clientName, description });
      setSuccess(result.data);
      setCredentialsSaved(false);
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleCredentialsSaved = () => {
    setCredentialsSaved(true);
  };

  return (
    <Container className="bg-transparent d-flex justify-content-center align-items-center vh-100">
      <Card className="w-100 bg-white" style={{ maxWidth: '500px' }}>
        <Card.Body>
          <h2 className="text-center mb-4">Register a new application</h2>
          
          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}
          
          {success ? (
            <div>
              <Alert variant="warning" className="text-center">
                <strong>Important:</strong> Please save these credentials securely. 
                They will only be shown once!
              </Alert>
              
              <Card className="mb-3 border-danger bg-white">
                <Card.Body>
                  <h5 className="mb-3 text-danger">Client Credentials</h5>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Client ID</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        readOnly
                        value={success.clientId}
                        className="text-monospace"
                      />
                      <Button 
                        variant="outline-secondary" 
                        onClick={() => handleCopyToClipboard(success.clientId)}
                      >
                        Copy
                      </Button>
                    </InputGroup>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Client Secret</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        readOnly
                        value={success.clientSecret}
                        className="text-monospace"
                      />
                      <Button 
                        variant="outline-secondary" 
                        onClick={() => handleCopyToClipboard(success.clientSecret)}
                      >
                        Copy
                      </Button>
                    </InputGroup>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Check 
                      type="checkbox"
                      id="credentials-saved"
                      label="I have saved my credentials securely"
                      checked={credentialsSaved}
                      onChange={() => setCredentialsSaved(!credentialsSaved)}
                    />
                  </Form.Group>
                  
                  <Button 
                    variant="primary" 
                    className="w-100" 
                    disabled={!credentialsSaved}
                    onClick={() => navigate('/login')}
                  >
                    Proceed to Login
                  </Button>
                </Card.Body>
              </Card>

                  <div className="text-center text-muted small">
                    <p>
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      Do not share these credentials with anyone
                    </p>
                  </div>
            </div>
          ) : (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Application Name</Form.Label>
                <Form.Control
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  placeholder="My Banking App"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of your application"
                />
              </Form.Group>
              
              <Button 
                variant="success" 
                type="submit" 
                className="w-100" 
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Register Application'}
              </Button>
              
              <div className="text-center mt-3">
                <a href="/login" className="text-decoration-none">
                  Already have an account? Sign in
                </a>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Register;