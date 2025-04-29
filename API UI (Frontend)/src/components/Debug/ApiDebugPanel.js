// src/components/Debug/ApiDebugPanel.js
import React, { useState, useEffect } from 'react';
import { Card, Button, Accordion, Badge } from 'react-bootstrap';
import api from '../../services/api';
import logger from '../../utils/logger';

/**
 * Debug panel to show API responses and help troubleshoot data issues
 * Add this component to your Dashboard to see what's happening with API calls
 */
const ApiDebugPanel = () => {
  const [lastApiCall, setLastApiCall] = useState(null);
  const [apiResponses, setApiResponses] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  // Start listening for API calls
  useEffect(() => {
    if (!isListening) return;

    // Store the original request/response interceptors
    const originalRequestInterceptor = api.interceptors.request.use;
    const originalResponseInterceptor = api.interceptors.response.use;

    // Set up request interceptor
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        const timestamp = new Date().toISOString();
        const callId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Store information about this request
        setLastApiCall({
          id: callId,
          url: config.url,
          method: config.method,
          timestamp,
          data: config.data,
          status: 'pending'
        });
        
        // Add callId to request for tracking
        config.headers = {
          ...config.headers,
          'X-Debug-Call-ID': callId
        };
        
        return config;
      },
      (error) => {
        // Log request errors
        logger.error('API Request Error in Debug Panel', error);
        return Promise.reject(error);
      }
    );

    // Set up response interceptor
    const responseInterceptor = api.interceptors.response.use(
      (response) => {
        const callId = response.config.headers['X-Debug-Call-ID'];
        
        // Find and update the API call
        if (callId) {
          setLastApiCall(prev => {
            if (prev && prev.id === callId) {
              return {
                ...prev,
                status: 'success',
                responseTimestamp: new Date().toISOString(),
                responseData: response.data,
                statusCode: response.status
              };
            }
            return prev;
          });
          
          // Add to stored responses
          setApiResponses(prev => {
            const newResponse = {
              id: callId,
              url: response.config.url,
              method: response.config.method,
              requestTimestamp: response.config.timestamp || new Date().toISOString(),
              responseTimestamp: new Date().toISOString(),
              requestData: response.config.data,
              responseData: response.data,
              statusCode: response.status,
              isMockData: _checkIfMockData(response.data)
            };
            
            // Keep only the last 10 responses
            const updatedResponses = [newResponse, ...prev];
            if (updatedResponses.length > 10) {
              return updatedResponses.slice(0, 10);
            }
            return updatedResponses;
          });
        }
        
        return response;
      },
      (error) => {
        // Handle errors in the response
        const callId = error.config?.headers?.['X-Debug-Call-ID'];
        
        if (callId) {
          setLastApiCall(prev => {
            if (prev && prev.id === callId) {
              return {
                ...prev,
                status: 'error',
                responseTimestamp: new Date().toISOString(),
                error: error.response?.data || error.message,
                statusCode: error.response?.status || 0
              };
            }
            return prev;
          });
          
          // Add to stored responses
          setApiResponses(prev => {
            const newResponse = {
              id: callId,
              url: error.config.url,
              method: error.config.method,
              requestTimestamp: error.config.timestamp || new Date().toISOString(),
              responseTimestamp: new Date().toISOString(),
              requestData: error.config.data,
              error: error.response?.data || error.message,
              statusCode: error.response?.status || 0,
              isMockData: false
            };
            
            // Keep only the last 10 responses
            const updatedResponses = [newResponse, ...prev];
            if (updatedResponses.length > 10) {
              return updatedResponses.slice(0, 10);
            }
            return updatedResponses;
          });
        }
        
        return Promise.reject(error);
      }
    );

    // Cleanup function to remove interceptors
    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [isListening]);

  // Helper function to check if data appears to be mock data
  const _checkIfMockData = (data) => {
    // Check for patterns that indicate mock data
    if (!data) return false;
    
    const responseData = data.data || data;
    
    // Check if accounts have mock in their IDs
    const hasMockAccounts = responseData.accounts && 
      responseData.accounts.some(acc => 
        acc.accountId && acc.accountId.includes('mock')
      );
    
    // Check if transactions have mock in their IDs
    const hasMockTransactions = responseData.recentTransactions && 
      responseData.recentTransactions.some(tx => 
        tx.transactionId && tx.transactionId.includes('mock')
      );
    
    // Check for the isMock flag
    const hasIsMockFlag = responseData.isMock === true;
    
    return hasMockAccounts || hasMockTransactions || hasIsMockFlag;
  };

  // Toggle listening state
  const toggleListening = () => {
    setIsListening(!isListening);
  };

  // Clear stored responses
  const clearResponses = () => {
    setApiResponses([]);
    setLastApiCall(null);
  };

  // Toggle expanded state for an item
  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <Card className="mt-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>API Debug Panel</span>
        <div>
          <Button 
            variant={isListening ? "danger" : "success"} 
            size="sm"
            onClick={toggleListening}
            className="me-2"
          >
            {isListening ? "Stop Monitoring" : "Start Monitoring"}
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={clearResponses}
          >
            Clear Log
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {!isListening && (
          <div className="alert alert-info">
            Click "Start Monitoring" to begin capturing API calls and responses.
          </div>
        )}
        
        {isListening && apiResponses.length === 0 && (
          <div className="alert alert-info">
            Monitoring active. Make an API request to see the results.
          </div>
        )}
        
        {apiResponses.length > 0 && (
          <div className="api-responses">
            <h5>Recent API Calls</h5>
            {apiResponses.map((response, index) => (
              <div key={response.id} className="api-response mb-3 border p-3 rounded">
                <div 
                  className="d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleExpanded(response.id)}
                >
                  <div>
                    <Badge bg={response.statusCode >= 200 && response.statusCode < 300 ? "success" : "danger"}>
                      {response.method.toUpperCase()} {response.statusCode}
                    </Badge>
                    <span className="ms-2">{response.url}</span>
                    {response.isMockData && (
                      <Badge bg="warning" className="ms-2">Mock Data</Badge>
                    )}
                  </div>
                  <span>
                    {new Date(response.responseTimestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {expandedItems[response.id] && (
                  <div className="mt-3">
                    <h6>Request</h6>
                    <pre className="bg-light p-2 rounded">
                      {typeof response.requestData === 'string' 
                        ? response.requestData 
                        : JSON.stringify(response.requestData, null, 2) || 'No request data'}
                    </pre>
                    
                    <h6>Response</h6>
                    <pre className="bg-light p-2 rounded">
                      {response.error 
                        ? JSON.stringify(response.error, null, 2) 
                        : JSON.stringify(response.responseData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ApiDebugPanel;