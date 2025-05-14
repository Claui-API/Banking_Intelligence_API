// src/components/Auth/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, Modal } from 'react-bootstrap';
import logger from '../../utils/logger';
import TwoFactorLogin from './TwoFactorLogin';

const Login = () => {
  // User credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // API credentials state
  const [clientId, setClientId] = useState(localStorage.getItem('clientId') || '');
  const [clientSecret, setClientSecret] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState('user'); // 'user' or 'api'
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Handle successful 2FA verification
   */
  const handleTwoFactorSuccess = (authResult) => {
    setLoading(false);
    setRequireTwoFactor(false);

    // Store the token and navigate to dashboard
    localStorage.setItem('token', authResult.accessToken);
    if (authResult.refreshToken) {
      localStorage.setItem('refreshToken', authResult.refreshToken);
    }

    navigate('/dashboard');
  };

  /**
   * Cancel 2FA verification and go back to login form
   */
  const handleTwoFactorCancel = () => {
    setRequireTwoFactor(false);
    setTwoFactorData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Choose credentials based on login method
      const credentials = loginMethod === 'user'
        ? { email, password }
        : { clientId, clientSecret };

      // Validate required fields
      if (loginMethod === 'user' && (!email || !password)) {
        throw new Error('Email and password are required');
      } else if (loginMethod === 'api' && (!clientId || !clientSecret)) {
        throw new Error('Client ID and Client Secret are required');
      }

      const loginResult = await login(credentials);

      // Check if 2FA is required
      if (loginResult.requireTwoFactor) {
        setTwoFactorData({
          userId: loginResult.userId,
          email: loginResult.email
        });
        setRequireTwoFactor(true);
        setLoading(false);
        return;
      }

      // Check if this is a first-time login or requires token generation
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
      {requireTwoFactor ? (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <div style={{ maxWidth: '500px', width: '100%' }}>
            <TwoFactorLogin
              userId={twoFactorData.userId}
              email={twoFactorData.email}
              onSuccess={handleTwoFactorSuccess}
              onCancel={handleTwoFactorCancel}
            />
          </div>
        </Container>
      ) : (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Card className="w-100 bg-white" style={{ maxWidth: '450px' }}>
            <Card.Body>
              <h2 className="text-center mb-4 text-black">Sign in to your account</h2>

              {error && (
                <Alert variant="danger">
                  {error}
                </Alert>
              )}
              <div className="mb-4">
                <ul className="nav nav-tabs d-flex justify-content-center gap-2">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${loginMethod === 'user' ? 'active' : ''}`}
                      onClick={() => {
                        setLoginMethod('user');
                        setError(''); // Clear error when switching tabs
                      }}
                    >
                      Email & Password
                    </button>
                  </li>
                  <li className="nav-item gap-2">
                    <button
                      className={`nav-link ${loginMethod === 'api' ? 'active' : ''}`}
                      onClick={() => {
                        setLoginMethod('api');
                        setError(''); // Clear error when switching tabs
                      }}
                    >
                      API Credentials
                    </button>
                  </li>
                </ul>

                <div className="tab-content">
                  <div className={`tab-pane fade ${loginMethod === 'user' ? 'show active' : ''}`}>
                    {/* Email & Password Form */}
                    <Form onSubmit={handleSubmit} className="mt-4">
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError(''); // Clear error when user changes input
                          }}
                          placeholder="Enter your email"
                          required={loginMethod === 'user'}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError(''); // Clear error when user changes input
                          }}
                          placeholder="Enter your password"
                          required={loginMethod === 'user'}
                        />
                      </Form.Group>

                      <Button
                        variant="success"
                        type="submit"
                        className="w-100"
                        disabled={loading || (loginMethod === 'user' && (!email || !password))}
                      >
                        {loading ? 'Signing in...' : 'Sign In'}
                      </Button>
                    </Form>
                  </div>

                  <div className={`tab-pane fade ${loginMethod === 'api' ? 'show active' : ''}`}>
                    {/* API Credentials Form */}
                    <Form onSubmit={handleSubmit} className="mt-4">
                      <Form.Group className="mb-3">
                        <Form.Label>Client ID</Form.Label>
                        <Form.Control
                          type="text"
                          value={clientId}
                          onChange={(e) => {
                            setClientId(e.target.value);
                            if (error) setError(''); // Clear error when user changes input
                          }}
                          placeholder="Enter Client ID"
                          required={loginMethod === 'api'}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Client Secret</Form.Label>
                        <Form.Control
                          type="password"
                          value={clientSecret}
                          onChange={(e) => {
                            setClientSecret(e.target.value);
                            if (error) setError(''); // Clear error when user changes input
                          }}
                          placeholder="Enter Client Secret"
                          required={loginMethod === 'api'}
                        />
                      </Form.Group>

                      <Button
                        variant="success"
                        type="submit"
                        className="w-100"
                        disabled={loading || (loginMethod === 'api' && (!clientId || !clientSecret))}
                      >
                        {loading ? 'Signing in...' : 'Sign In'}
                      </Button>
                    </Form>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3">
                <Link to="/register" className="text-decoration-none">
                  Don't have an account? <span className="register-link">Register here</span>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Container>
      )}

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