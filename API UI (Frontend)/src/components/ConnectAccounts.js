// src/components/ConnectAccounts.js
import React, { useState } from 'react';
import { Container, Card, Alert, Button, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PlaidLinkButton from './Plaid/PlaidLinkButton';
import logger from '../utils/logger';

const ConnectAccounts = () => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [institution, setInstitution] = useState('');
  const navigate = useNavigate();
  
  const handlePlaidSuccess = ({ itemId, metadata }) => {
    try {
      // Save institution name for display
      setInstitution(metadata.institution.name);
      
      // Mark as connected
      setConnected(true);
      
      // Log success
      logger.info('Bank account connected successfully', {
        institution: metadata.institution.name,
        accounts: metadata.accounts.length
      });
    } catch (err) {
      logger.logError('Plaid Success Handling Error', err);
      setError('Error processing bank connection');
    }
  };
  
  const handlePlaidExit = (err, metadata) => {
    if (err) {
      setError(err.message || 'Error connecting to bank account');
    }
  };
  
  const handleContinue = () => {
    navigate('/dashboard');
  };
  
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card>
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">Connect Your Bank Accounts</h4>
            </Card.Header>
            
            <Card.Body>
              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}
              
              {connected ? (
                <div className="text-center">
                  <div className="mb-4">
                    <i className="bi bi-check-circle-fill text-success fs-1"></i>
                  </div>
                  
                  <h5 className="mb-3">Account Connected Successfully!</h5>
                  
                  <p className="mb-4">
                    Your accounts from <strong>{institution}</strong> have been successfully connected.
                    You can now view your financial data in the dashboard.
                  </p>
                  
                  <Button 
                    variant="primary" 
                    size="lg" 
                    onClick={handleContinue}
                  >
                    Continue to Dashboard
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-4">
                    Connect your bank accounts to get started with our financial insights platform.
                    We use Plaid to securely connect to your financial institutions.
                  </p>
                  
                  <div className="d-grid">
                    <PlaidLinkButton 
                      onSuccess={handlePlaidSuccess}
                      onExit={handlePlaidExit}
                      buttonText="Connect Your Bank Account"
                    />
                  </div>
                  
                  <div className="mt-4 small text-muted">
                    <p className="mb-2">
                      <i className="bi bi-shield-lock me-2"></i>
                      Your credentials are never stored on our servers. We use Plaid's secure API to access your financial data.
                    </p>
                    <p className="mb-0">
                      <i className="bi bi-info-circle me-2"></i>
                      By connecting your accounts, you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ConnectAccounts;