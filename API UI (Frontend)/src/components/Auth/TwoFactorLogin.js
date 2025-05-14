// src/components/Auth/TwoFactorLogin.js
import React, { useState } from 'react';
import { Card, Form, Button, Alert, Spinner, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { authService } from '../../services/auth';
import logger from '../../utils/logger';

const TwoFactorLogin = ({ userId, email, onSuccess, onCancel }) => {
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('token');

  // Handle token verification
  const handleVerifyToken = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      // Call the API to verify the token
      const authResult = await authService.verify2FA(userId, token);

      // Log success
      logger.info('2FA verification successful');

      // Make sure tokens are set in localStorage
      if (authResult.accessToken) {
        localStorage.setItem('token', authResult.accessToken);
      }

      if (authResult.refreshToken) {
        localStorage.setItem('refreshToken', authResult.refreshToken);
      }

      // Call onSuccess with the authentication result
      if (typeof onSuccess === 'function') {
        onSuccess(authResult);
      }
    } catch (err) {
      logger.error('2FA verification error:', err);
      setError(err.message || 'Failed to verify token');
      setVerifying(false);
    }
  };

  // Handle backup code verification
  const handleVerifyBackupCode = async (e) => {
    e.preventDefault();

    if (!backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      // Call the API to verify the backup code
      const authResult = await authService.verifyBackupCode(userId, backupCode);

      // Log success
      logger.info('Backup code verification successful');

      // Call onSuccess with the authentication result
      if (typeof onSuccess === 'function') {
        onSuccess(authResult);
      }
    } catch (err) {
      logger.error('Backup code verification error:', err);
      setError(err.message || 'Failed to verify backup code');
      setVerifying(false);
    }
  };

  return (
    <Card>
      <Card.Body className="p-4">
        <Card.Title className="mb-4">Two-Factor Authentication</Card.Title>

        {error && (
          <Alert variant="danger" className="mb-4">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </Alert>
        )}

        <div className="mb-3">
          <div className="text-muted small mb-3">
            Verifying for account: <strong>{email}</strong>
          </div>
        </div>

        <Tabs
          activeKey={activeTab}
          onSelect={setActiveTab}
          className="mb-3"
        >
          <Tab eventKey="token" title="Authentication Code">
            <Form onSubmit={handleVerifyToken} className="mt-3">
              <p>
                Open your authenticator app and enter the 6-digit code for this account.
              </p>

              <Form.Group className="mb-3">
                <Form.Label>Authentication Code</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter 6-digit code"
                    disabled={verifying}
                    autoComplete="one-time-code"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </InputGroup>
              </Form.Group>

              <div className="d-grid">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={verifying || !token.trim()}
                >
                  {verifying ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Verifying...
                    </>
                  ) : 'Verify Code'}
                </Button>
              </div>
            </Form>
          </Tab>

          <Tab eventKey="backup" title="Backup Code">
            <Form onSubmit={handleVerifyBackupCode} className="mt-3">
              <p>
                If you can't access your authenticator app, enter one of your backup codes.
              </p>

              <Form.Group className="mb-3">
                <Form.Label>Backup Code</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder="Enter backup code"
                    disabled={verifying}
                  />
                </InputGroup>
                <Form.Text className="text-muted">
                  Each backup code can only be used once.
                </Form.Text>
              </Form.Group>

              <div className="d-grid">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={verifying || !backupCode.trim()}
                >
                  {verifying ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Verifying...
                    </>
                  ) : 'Use Backup Code'}
                </Button>
              </div>
            </Form>
          </Tab>
        </Tabs>

        <div className="text-center mt-4">
          <Button
            variant="link"
            className="text-muted"
            onClick={onCancel}
            disabled={verifying}
          >
            Cancel
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TwoFactorLogin;