// src/components/Auth/Register.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, InputGroup, Modal, Row, Col } from 'react-bootstrap';
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
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);

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

    // Validate form
    if (!validateForm()) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Register user
      const result = await register({
        clientName,
        email,
        password,
        description
      });

      // Store credentials
      setSuccess(result.data);
      setCredentialsSaved(false);

      // Store the client ID in localStorage for later use
      localStorage.setItem('clientId', result.data.clientId);

      // Check if 2FA was auto-enabled and setup info returned
      if (result.data.twoFactorEnabled && result.data.twoFactorSecret) {
        setTwoFactorData({
          secret: result.data.twoFactorSecret,
          qrCode: result.data.twoFactorQrCode,
          backupCodes: result.data.backupCodes
        });

        // Show 2FA setup
        setShowTwoFactorSetup(true);
      }
    } catch (err) {
      logger.error('Registration Error', err);
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
                <Link to="/login" className="text-decoration-none">
                  Already have an account? <span className="login-link">Login here</span>
                </Link>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>

      {/* 2FA Setup Modal */}
      <Modal
        show={showTwoFactorSetup}
        onHide={() => setShowTwoFactorSetup(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Set Up Two-Factor Authentication</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <strong>Two-Factor Authentication Required:</strong> For enhanced security, 2FA has been enabled for your account.
            Please complete the setup by scanning the QR code with your authenticator app.
          </Alert>

          <div className="text-center mb-4">
            <img
              src={twoFactorData?.qrCode}
              alt="2FA QR Code"
              className="img-fluid border rounded"
              style={{ maxWidth: '200px' }}
            />
          </div>

          <p><strong>Secret Key:</strong> <code>{twoFactorData?.secret}</code></p>

          <hr />

          <h5 className="mb-3">Backup Codes</h5>
          <p className="text-danger small fw-bold">
            <i className="bi bi-exclamation-triangle me-1"></i>
            IMPORTANT: Save these backup codes in a secure place.
            Each code can only be used once if you lose access to your authenticator app.
          </p>

          <div className="backup-codes bg-light p-3 rounded mb-3">
            <Row>
              {twoFactorData?.backupCodes?.map((code, index) => (
                <Col xs={6} md={4} className="mb-2" key={index}>
                  <code className="user-select-all">{code}</code>
                </Col>
              ))}
            </Row>
          </div>

          <div className="d-flex justify-content-between">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                if (twoFactorData?.backupCodes) {
                  navigator.clipboard.writeText(twoFactorData.backupCodes.join('\n'));
                  // Show a success message
                }
              }}
            >
              <i className="bi bi-clipboard me-1"></i>
              Copy Codes
            </Button>

            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                if (twoFactorData?.backupCodes) {
                  // Handle download of backup codes
                  const element = document.createElement("a");
                  const file = new Blob([twoFactorData.backupCodes.join('\n')], { type: 'text/plain' });
                  element.href = URL.createObjectURL(file);
                  element.download = "2fa-backup-codes.txt";
                  document.body.appendChild(element);
                  element.click();
                }
              }}
            >
              <i className="bi bi-download me-1"></i>
              Download Codes
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => {
              setShowTwoFactorSetup(false);
              // Proceed with normal registration flow
            }}
          >
            I've Saved My Codes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Register;