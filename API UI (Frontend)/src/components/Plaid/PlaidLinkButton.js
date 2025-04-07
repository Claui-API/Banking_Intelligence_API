// src/components/Plaid/PlaidLinkButton.js
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';
import api from '../../services/api';
import logger from '../../utils/logger';

const PlaidLinkButton = ({ onSuccess, onExit, buttonText = 'Connect your bank account' }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Function to get a link token from your backend
  const getLinkToken = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/plaid/create-link-token');
      
      if (response.data.success) {
        setLinkToken(response.data.data.link_token);
        logger.info('Link token created successfully');
      } else {
        throw new Error(response.data.message || 'Failed to create link token');
      }
    } catch (err) {
      logger.logError('Link Token Error', err);
      setError('Failed to initialize Plaid Link');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Get link token on component mount
  useEffect(() => {
    getLinkToken();
  }, [getLinkToken]);
  
  // Handle successful link
  const handleSuccess = useCallback(async (publicToken, metadata) => {
    try {
      setLoading(true);
      
      logger.info('Plaid Link success', {
        institution: metadata.institution.name,
        accounts: metadata.accounts.length
      });
      
      // Exchange public token for access token (server-side)
      const response = await api.post('/plaid/exchange-public-token', {
        publicToken
      });
      
      if (response.data.success) {
        // Call the onSuccess callback with the item ID and metadata
        onSuccess && onSuccess({
          itemId: response.data.data.itemId,
          metadata
        });
      } else {
        throw new Error(response.data.message || 'Token exchange failed');
      }
    } catch (err) {
      logger.logError('Public Token Exchange Error', err);
      setError('Failed to connect bank account');
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);
  
  // Handle exit from Plaid Link
  const handleExit = useCallback((err, metadata) => {
    if (err) {
      logger.logError('Plaid Link Exit Error', err);
    }
    
    logger.info('Plaid Link exit', metadata);
    onExit && onExit(err, metadata);
  }, [onExit]);
  
  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
    // Optional: Customize the Plaid Link experience
    // https://plaid.com/docs/link/customization/
  });
  
  return (
    <>
      <Button 
        variant="primary"
        disabled={!ready || loading || !linkToken}
        onClick={() => open()}
        className="d-flex align-items-center justify-content-center"
      >
        {loading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            <span>Connecting...</span>
          </>
        ) : (
          <span>{buttonText}</span>
        )}
      </Button>
      
      {error && (
        <div className="text-danger mt-2 small">
          {error}
        </div>
      )}
    </>
  );
};

export default PlaidLinkButton;