// src/components/Auth/TwoFactorSetup.js
import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { authService } from '../../services/auth';

const TwoFactorSetup = ({ onComplete }) => {
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('generate'); // generate, verify, complete
  
  // Generate 2FA secret on component mount
  useEffect(() => {
    const generateSecret = async () => {
      try {
        setLoading(true);
        const response = await authService.generate2FASecret();
        
        setSecret(response.secret);
        setQrCode(response.qrCodeUrl);
      } catch (err) {
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
      
      const result = await authService.enable2FA(secret, token);
      
      // Save backup codes
      setBackupCodes(result.backupCodes || []);
      
      // Move to completion step
      setStep('complete');
    } catch (err) {
      setError(err.message || 'Failed to verify token');
    } finally {
      setVerifying(false);
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
              <p className="text-muted small">
                Save these backup codes in a secure place. You can use them to sign in if you lose access 
                to your authenticator app. Each code can only be used once.
              </p>
              
              <div className="backup-codes bg-light p-3 rounded mb-3">
                <div className="row">
                  {backupCodes.map((code, index) => (
                    <div className="col-6 mb-2" key={index}>
                      <code>{code}</code>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="d-flex justify-content-between">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    const text = backupCodes.join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                >
                  <i className="bi bi-clipboard me-1"></i>
                  Copy Codes
                </Button>
                
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    const element = document.createElement("a");
                    const file = new Blob([backupCodes.join('\n')], {type: 'text/plain'});
                    element.href = URL.createObjectURL(file);
                    element.download = "2fa-backup-codes.txt";
                    document.body.appendChild(element);
                    element.click();
                  }}
                >
                  <i className="bi bi-download me-1"></i>
                  Download Codes
                </Button>
              </div>
            </div>
            
            <div className="text-center mt-4">
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
