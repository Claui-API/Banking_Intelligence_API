// src/components/Auth/Register.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, InputGroup } from 'react-bootstrap';
import logger from '../../utils/logger';

const Register = () => {
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    // Confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Validate form fields
    if (!validateForm()) {
      setLoading(false);
      return;
    }
    
    try {
      // Call the register function from AuthContext
      const result = await register({ 
        clientName, 
        email,
        password,
        description 
      });
      
      setSuccess(result.data);
      setCredentialsSaved(false);
      
      // Store the client ID in localStorage for later use
      localStorage.setItem('clientId', result.data.clientId);
      
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
  
  const handleLoginRedirect = () => {
    navigate('/login');
  };

  return (
    <Container className="bg-transparent d-flex justify-content-center align-items-center vh-100">
      <Card className="w-100 bg-white" style={{ maxWidth: '500px' }}>
        <Card.Body>
          <h2 className="text-center mb-4 text-black">Register a new account</h2>
          
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
                  <h5 className="mb-3 text-danger">API Credentials</h5>
                  
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
                  
                  <Alert variant="info">
                    <strong>Note:</strong> You can now login with either your email/password or these API credentials.
                  </Alert>
                  
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
                    onClick={handleLoginRedirect}
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
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                />
                <Form.Text className="text-muted">
                  Password must be at least 8 characters long
                </Form.Text>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Description (Optional)</Form.Label>
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
                {loading ? 'Registering...' : 'Register Account'}
              </Button>
              
              <div className="text-center mt-3">
                <a href="/login" className="text-decoration-none">
                  Already have an account? <span className="login-link">Login here</span>
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