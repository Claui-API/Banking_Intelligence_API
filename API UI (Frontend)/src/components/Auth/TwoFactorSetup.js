// src/components/Auth/TwoFactorSetup.js
import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, InputGroup, Row, Col } from 'react-bootstrap';
import { authService } from '../../services/auth';
import logger from '../../utils/logger';

const TwoFactorSetup = ({ onComplete, onCancel }) => {
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [step, setStep] = useState('generate'); // generate, verify, complete

  // Generate 2FA secret on component mount
  useEffect(() => {
    const generateSecret = async () => {
      try {
        setLoading(true);

        const response = await authService.generate2FASecret();

        setSecret(response.secret);
        setQrCode(response.qrCodeUrl);
        setError('');

        logger.info('2FA secret generated successfully');
      } catch (err) {
        logger.error('Failed to generate 2FA secret:', err);
        setError(err.message || 'Failed to generate 2FA secret');
      } finally {
        setLoading(false);
      }
    };

    generateSecret();
  }, []);

  // Handle token verification and 2FA enablement
  const handleVerify = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      // Call the API to verify the token and enable 2FA
      const result = await authService.enable2FA(secret, token);

      // Save backup codes
      setBackupCodes(result.backupCodes || []);

      // Move to completion step
      setStep('complete');

      logger.info('2FA enabled successfully');
    } catch (err) {
      logger.error('Failed to verify token:', err);
      setError(err.message || 'Failed to verify token');
    } finally {
      setVerifying(false);
    }
  };

  // Handle copy backup codes to clipboard
  const handleCopyBackupCodes = () => {
    try {
      const text = backupCodes.join('\n');
      navigator.clipboard.writeText(text);
      setCopySuccess(true);

      // Reset success message after a few seconds
      setTimeout(() => setCopySuccess(false), 3000);

      logger.info('Backup codes copied to clipboard');
    } catch (err) {
      logger.error('Failed to copy backup codes:', err);
      setError('Failed to copy backup codes to clipboard');
    }
  };

  // Handle download backup codes
  const handleDownloadBackupCodes = () => {
    try {
      const text = backupCodes.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = '2fa-backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.info('Backup codes downloaded');
    } catch (err) {
      logger.error('Failed to download backup codes:', err);
      setError('Failed to download backup codes');
    }
  };

  // Handle completion
  const handleComplete = () => {
    if (typeof onComplete === 'function') {
      onComplete();
    }
  };

  // Render setup steps
  const renderStep = () => {
    switch (step) {
      case 'generate':
        return (
          <>
            <Card.Title className="mb-4">Set Up Two-Factor Authentication</Card.Title>

            {error && (
              <Alert variant="danger" className="mb-4">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Generating your 2FA secret...</p>
              </div>
            ) : (
              <>
                <Alert variant="info" className="mb-4">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Enhanced Security:</strong> Two-factor authentication adds an extra layer of security to your account by requiring a one-time code in addition to your password.
                </Alert>

                <p>
                  Scan this QR code with your authenticator app (like Google Authenticator,
                  Microsoft Authenticator, or Authy) to set up two-factor authentication.
                </p>

                <div className="qr-container text-center mb-4">
                  <img
                    src={qrCode}
                    alt="2FA QR Code"
                    className="img-fluid border rounded"
                    style={{ maxWidth: '200px' }}
                  />
                </div>

                <Alert variant="info" className="mb-4">
                  <strong>Manual Setup:</strong> If you can't scan the QR code, enter this
                  secret key manually: <code className="mx-1">{secret}</code>
                </Alert>

                <Form onSubmit={handleVerify}>
                  <Form.Group className="mb-3">
                    <Form.Label>Verification Code</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Enter the 6-digit code"
                        required
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
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
                        ) : 'Verify & Enable'}
                      </Button>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Enter the verification code from your authenticator app
                    </Form.Text>
                  </Form.Group>
                </Form>
              </>
            )}

            <div className="d-flex justify-content-between mt-4">
              <Button
                variant="outline-secondary"
                onClick={onCancel}
                disabled={verifying}
              >
                Cancel
              </Button>
            </div>
          </>
        );

      case 'complete':
        return (
          <>
            <Card.Title className="mb-3 text-success">
              <i className="bi bi-shield-check me-2"></i>
              Two-Factor Authentication Enabled
            </Card.Title>

            <Alert variant="success" className="mb-4">
              <p className="mb-0">
                <strong>Success!</strong> Your account is now protected with two-factor authentication.
              </p>
            </Alert>

            <div className="mb-4">
              <h5>Your Backup Codes</h5>
              <p className="text-danger small fw-bold">
                <i className="bi bi-exclamation-triangle me-1"></i>
                IMPORTANT: Save these backup codes in a secure place.
                Each code can only be used once if you lose access to your authenticator app.
              </p>

              <div className="backup-codes bg-light p-3 rounded mb-3">
                {copySuccess && (
                  <Alert variant="success" className="py-1 px-2 mb-2">
                    <i className="bi bi-check-circle me-1"></i>
                    Backup codes copied to clipboard!
                  </Alert>
                )}

                <Row>
                  {backupCodes.map((code, index) => (
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
                  onClick={handleCopyBackupCodes}
                >
                  <i className="bi bi-clipboard me-1"></i>
                  Copy Codes
                </Button>

                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleDownloadBackupCodes}
                >
                  <i className="bi bi-download me-1"></i>
                  Download Codes
                </Button>
              </div>
            </div>

            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Important:</strong> If you lose access to your authenticator app and backup codes,
              you will need to contact support to regain access to your account.
            </Alert>

            <div className="d-grid mt-4">
              <Button
                variant="primary"
                onClick={handleComplete}
              >
                Continue
              </Button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <Card.Body className="p-4">
        {renderStep()}
      </Card.Body>
    </Card>
  );
};

export default TwoFactorSetup;