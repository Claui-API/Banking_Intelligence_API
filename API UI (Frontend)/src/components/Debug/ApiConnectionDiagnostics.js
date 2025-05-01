// src/components/Debug/ApiConnectionDiagnostics.js
import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import api from '../../services/api';
import logger from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';

/**
 * API Connection Diagnostics Tool
 * Use this component to test API connectivity and auth issues
 */
const ApiConnectionDiagnostics = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState({});
  const { isAuthenticated, isAdmin, user } = useAuth();

  // List of endpoints to test
  useEffect(() => {
    // Define endpoints to test
    const endpointsList = [
      { name: 'Health Check', url: '/health', requiresAuth: false },
      { name: 'API Tokens', url: '/api-tokens', requiresAuth: true },
      { name: 'Admin Stats', url: '/admin/stats', requiresAuth: true, requiresAdmin: true },
      { name: 'Admin Clients', url: '/admin/clients', requiresAuth: true, requiresAdmin: true },
      { name: 'Insights Metrics - System', url: '/insights/metrics/system', requiresAuth: true, requiresAdmin: true },
      { name: 'Insights Metrics - Users', url: '/insights/metrics/users', requiresAuth: true, requiresAdmin: true },
      { name: 'Insights Metrics - History', url: '/insights/metrics/history', requiresAuth: true, requiresAdmin: true }
    ];
    
    setEndpoints(endpointsList);
  }, []);

  // Run API tests
  const runApiTests = async () => {
    setTesting(true);
    const results = {};
    
    logger.info('Starting API connection diagnostics');
    
    // Check authentication status first
    results.auth = {
      success: isAuthenticated,
      message: isAuthenticated ? 'Authenticated' : 'Not authenticated',
      admin: isAdmin,
      userId: user?.userId,
      role: user?.role
    };
    
    // Check token
    const token = localStorage.getItem('token');
    results.token = {
      exists: !!token,
      length: token ? token.length : 0,
      // Add a preview of the token (first 10 chars)
      preview: token ? `${token.substring(0, 10)}...` : 'N/A'
    };
    
    // Test each endpoint
    for (const endpoint of endpoints) {
      try {
        logger.info(`Testing endpoint: ${endpoint.url}`);
        
        // Skip admin endpoints if not admin
        if (endpoint.requiresAdmin && !isAdmin) {
          results[endpoint.url] = {
            success: false,
            status: 'Skipped',
            message: 'Admin rights required'
          };
          continue;
        }
        
        // Skip auth endpoints if not authenticated
        if (endpoint.requiresAuth && !isAuthenticated) {
          results[endpoint.url] = {
            success: false,
            status: 'Skipped',
            message: 'Authentication required'
          };
          continue;
        }
        
        // Make the request
        const response = await api.get(endpoint.url);
        
        // Store results
        results[endpoint.url] = {
          success: true,
          status: response.status,
          message: 'Success',
          data: response.data
        };
        
        logger.info(`Endpoint ${endpoint.url} test success:`, {
          status: response.status,
          dataSize: JSON.stringify(response.data).length
        });
      } catch (error) {
        // Log the error
        logger.error(`Endpoint ${endpoint.url} test failed:`, error);
        
        // Store error results
        results[endpoint.url] = {
          success: false,
          status: error.response?.status || 'N/A',
          message: error.message,
          details: error.response?.data || {}
        };
      }
    }
    
    setTestResults(results);
    setTesting(false);
    logger.info('API diagnostics completed');
  };

  return (
    <Card className="mb-4">
      <Card.Header className="bg-white d-flex justify-content-between align-items-center">
        <span>API Connection Diagnostics</span>
        <Button
          variant={testing ? "secondary" : "primary"}
          onClick={runApiTests}
          disabled={testing}
        >
          {testing ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Testing...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>
      </Card.Header>
      <Card.Body>
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle me-2"></i>
          Use this tool to diagnose API connection and authentication issues. This can help identify
          why certain components are not loading data properly.
        </Alert>
        
        {Object.keys(testResults).length > 0 && (
          <>
            <h5 className="mb-3">Authentication Status</h5>
            <Card className="mb-4">
              <Card.Body>
                <div className="d-flex justify-content-between">
                  <div>
                    <p className="mb-1">
                      <strong>Authentication:</strong> {testResults.auth?.success ? 'Authenticated' : 'Not Authenticated'}
                    </p>
                    <p className="mb-1">
                      <strong>Admin Role:</strong> {testResults.auth?.admin ? 'Yes' : 'No'}
                    </p>
                    <p className="mb-1">
                      <strong>User ID:</strong> {testResults.auth?.userId || 'N/A'}
                    </p>
                    <p className="mb-0">
                      <strong>Role:</strong> {testResults.auth?.role || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1">
                      <strong>Token:</strong> {testResults.token?.exists ? 'Present' : 'Missing'}
                    </p>
                    <p className="mb-1">
                      <strong>Token Length:</strong> {testResults.token?.length || 0} chars
                    </p>
                    <p className="mb-0">
                      <strong>Token Preview:</strong> {testResults.token?.preview || 'N/A'}
                    </p>
                  </div>
                </div>
              </Card.Body>
            </Card>
            
            <h5 className="mb-3">Endpoint Test Results</h5>
            <Table responsive striped bordered className="table-light">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(endpoint => {
                  const result = testResults[endpoint.url];
                  return (
                    <tr key={endpoint.url}>
                      <td>
                        <div className="fw-bold">{endpoint.name}</div>
                        <div className="small text-muted">{endpoint.url}</div>
                        <div className="small">
                          {endpoint.requiresAuth && (
                            <Badge bg="info" className="me-1">Auth</Badge>
                          )}
                          {endpoint.requiresAdmin && (
                            <Badge bg="warning">Admin</Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        {result ? (
                          <Badge 
                            bg={
                              result.status === 'Skipped' ? 'secondary' :
                                (result.success ? 'success' : 'danger')
                            }
                          >
                            {result.status}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">Not tested</Badge>
                        )}
                      </td>
                      <td>{result ? (result.success ? 'Success' : 'Failed') : 'N/A'}</td>
                      <td>{result?.message || 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={() => {
                // Copy results to clipboard
                navigator.clipboard.writeText(JSON.stringify(testResults, null, 2));
              }}
            >
              Copy Results to Clipboard
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default ApiConnectionDiagnostics;