import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Alert, InputGroup, Row, Col, Spinner, Badge } from 'react-bootstrap';
import { authService } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import logger from '../utils/logger';

const APITokenManagement = () => {
  const { user, isAdmin } = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [clientId, setClientId] = useState('');

  // Fetch client data on component mount
  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);

        // Fetch clients directly from the database
        const response = await api.get('/clients/user-client');

        if (response.data && response.data.success) {
          const clientsData = response.data.data;

          // Just use the first client (assuming one client per user)
          if (clientsData.length > 0) {
            const client = clientsData[0];
            setClientData(client);
            setClientId(client.clientId);

            logger.info('Client data fetched successfully');
          } else {
            throw new Error('No clients found for your account');
          }
        } else {
          throw new Error(response.data?.message || 'Failed to fetch client data');
        }
      } catch (err) {
        logger.logError('Client Data Fetch', err);
        setError(err.message || 'Failed to fetch client data');
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [user]);

  // API Token generation
  const handleGenerateToken = async () => {
    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      // For admin users, show different message
      if (isAdmin) {
        setSuccess('As an admin, you have direct API access without needing to generate a token');
        setToken('Admin users have privileged access');
        setIsGenerating(false);
        return;
      }

      if (!clientId) {
        throw new Error('Client ID not found. Please contact support.');
      }

      if (!clientSecret.trim()) {
        throw new Error('Please enter your client secret to generate an API token');
      }

      const response = await api.post('/auth/generate-token', {
        clientId,
        clientSecret
      });

      const generatedToken = response.data.data.token;
      setToken(generatedToken);
      setSuccess('API token generated successfully');

      // SECURITY FIX: Remove the localStorage line
      // localStorage.setItem('apiToken', generatedToken);

      // Clear the secret field after successful generation for security
      setClientSecret('');

      logger.info('API token generated');

      // Refresh client data after token generation
      await refreshClientData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate API token');
      logger.logError('API Token Generation', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Refresh client data after actions
  const refreshClientData = async () => {
    try {
      if (!clientId) return;

      const response = await api.get(`/clients/status/${clientId}`);
      if (response.data && response.data.success) {
        setClientData(response.data.data);
      }
    } catch (err) {
      logger.logError('Client Data Refresh', err);
    }
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setSuccess('API token copied to clipboard');
      logger.info('API token copied to clipboard');
    }
  };

  const handleCopyClientId = () => {
    if (clientId) {
      navigator.clipboard.writeText(clientId);
      setSuccess('Client ID copied to clipboard');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Calculate percentage of usage quota
  const calculateUsagePercentage = () => {
    if (!clientData) return 0;
    return Math.min(100, Math.round((clientData.usageCount / clientData.usageQuota) * 100));
  };

  // Determine progress bar color based on usage
  const getProgressBarColor = () => {
    const percentage = calculateUsagePercentage();
    if (percentage < 50) return 'bg-success';
    if (percentage < 80) return 'bg-warning';
    return 'bg-danger';
  };

  return (
    <Container fluid className="py-4 px-4">
      <h2 className="text-white mb-4">API Keys</h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {loading ? (
        <Card className="content-card mb-4">
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="success" />
            <p className="mt-3 text-white">Loading client information...</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="content-card mb-4">
            <Card.Header>Your API Keys</Card.Header>
            <Card.Body>
              {clientData ? (
                <>
                  <div className="mb-4">
                    <h5 className="mb-3 text-black">Client Credentials</h5>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Client ID</Form.Label>
                          <InputGroup>
                            <Form.Control
                              type="text"
                              value={clientId}
                              readOnly
                              className="input-dark"
                            />
                            <Button variant="outline-secondary" onClick={handleCopyClientId}>
                              <i className="bi bi-clipboard"></i> Copy
                            </Button>
                          </InputGroup>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Client Secret</Form.Label>
                          <InputGroup>
                            <Form.Control
                              type={showSecret ? "text" : "password"}
                              placeholder="Enter your client secret here"
                              value={clientSecret}
                              onChange={(e) => setClientSecret(e.target.value)}
                              className="input-dark"
                            />
                            <Button
                              variant="outline-secondary"
                              onClick={() => setShowSecret(!showSecret)}
                            >
                              <i className={`bi ${showSecret ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                            </Button>
                          </InputGroup>
                          <Form.Text className="text-muted">
                            Your client secret is required to generate API tokens and is never stored.
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <div className="mb-4">
                    <h5 className="mb-3 text-black">API Token</h5>
                    <p className="text-black mb-3">Generate a token to use the API with your client credentials.</p>

                    <div className="mb-3">
                      <Button
                        variant="success"
                        onClick={handleGenerateToken}
                        disabled={isGenerating || !clientSecret.trim() || clientData?.status !== 'active'}
                      >
                        {isGenerating ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-key-fill me-2"></i>
                            Generate New API Token
                          </>
                        )}
                      </Button>

                      {clientData?.status !== 'active' && (
                        <div className="text-warning mt-2">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Your client must be active to generate API tokens
                        </div>
                      )}
                    </div>

                    {token && (
                      <Form.Group className="mb-3">
                        <Form.Label className="text-black">Your API Token</Form.Label>
                        <div className="d-flex">
                          <Form.Control
                            type="text"
                            value={token}
                            readOnly
                            className="text-monospace me-2 input-dark"
                          />
                          <Button
                            variant="outline-secondary"
                            onClick={handleCopyToken}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="d-flex align-items-center mt-2">
                          <Badge bg="info" className="me-2">API Token</Badge>
                          <Form.Text className="text-muted">
                            Keep this token secure and do not share it with anyone.
                          </Form.Text>
                        </div>
                      </Form.Group>
                    )}
                  </div>
                </>
              ) : (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  No client found for your account. Please contact an administrator.
                </Alert>
              )}
            </Card.Body>
          </Card>

          {clientData && (
            <Card className="content-card">
              <Card.Header>API Usage</Card.Header>
              <Card.Body>
                <p className="text-black">Your API key carries many privileges. Please keep it secure! Do not share your API key in publicly accessible areas such as GitHub, client-side code, or in requests to our API.</p>

                <h5 className="mt-4 mb-3 text-black">Authentication</h5>
                <p className="text-black">Use your API key to authenticate requests to the Banking Intelligence API by providing it in the Authorization header:</p>
                <div className="code-snippet mb-4 bg-dark p-3 rounded">
                  <code className="text-white">Authorization: Bearer YOUR_API_KEY</code>
                </div>

                <div className="usage-stats p-4 bg-dark rounded">
                  <h6 className='text-white'>This Month's Usage</h6>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="progress flex-grow-1 me-3" style={{ height: '10px' }}>
                      <div
                        className={`progress-bar ${getProgressBarColor()}`}
                        role="progressbar"
                        style={{ width: `${calculateUsagePercentage()}%` }}
                        aria-valuenow={calculateUsagePercentage()}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      ></div>
                    </div>
                    <div className="text-white">
                      {clientData.usageCount} / {clientData.usageQuota}
                    </div>
                  </div>
                  <div className="text-white mt-2">
                    API calls reset on {formatDate(clientData.resetDate)}
                  </div>
                </div>

                <div className="mt-4">
                  <h5 className="mb-3 text-black">Client Status</h5>
                  <div className="p-3 bg-dark rounded">
                    <div className="d-flex justify-content-between">
                      <div>
                        <strong className='text-white'>Status:</strong>
                      </div>
                      <div>
                        <span className={`badge bg-${clientData.status === 'active' ? 'success' :
                          clientData.status === 'pending' ? 'warning' :
                            'danger'
                          }`}>
                          {clientData.status}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex justify-content-between mt-2">
                      <div>
                        <strong className='text-white'>Last Activity:</strong>
                      </div>
                      <div className="text-white">
                        {formatDate(clientData.lastUsedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}

      {isAdmin && (
        <Card className="content-card mt-4">
          <Card.Header>Admin Functions</Card.Header>
          <Card.Body>
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              As an admin user, you have additional privileges including the ability to manage client status and quotas.
            </Alert>

            <div className="d-flex gap-2 mt-3">
              <Button
                variant="outline-success"
                onClick={() => window.location.href = '/admin'}
              >
                <i className="bi bi-speedometer me-2"></i>
                Go to Admin Dashboard
              </Button>

              <Button
                variant="outline-primary"
                onClick={() => window.location.href = '/admin/clients'}
              >
                <i className="bi bi-people me-2"></i>
                Manage Clients
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default APITokenManagement;