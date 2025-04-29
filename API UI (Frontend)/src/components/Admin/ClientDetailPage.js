// src/components/Admin/ClientDetailPage.js
import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/admin';
import ClientStatusBadge from './ClientStatusBadge';
import logger from '../../utils/logger';
import './ClientDetailPage.css';

const ClientDetailPage = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [newQuota, setNewQuota] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ type: '', reason: '' });
  
  // Fetch client details
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const clientData = await adminService.getClient(clientId);
        setClient(clientData);
        setError('');
      } catch (err) {
        setError(`Error loading client: ${err.message}`);
        logger.error(`Failed to load client ${clientId}:`, err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClient();
  }, [clientId]);
  
  // Handle quota update
  const handleUpdateQuota = async () => {
    try {
      if (!newQuota || isNaN(parseInt(newQuota)) || parseInt(newQuota) < 0) {
        setError('Please enter a valid quota value (positive number)');
        return;
      }
      
      await adminService.updateClientQuota(clientId, parseInt(newQuota));
      
      // Update client in state
      setClient(prev => ({
        ...prev,
        usageQuota: parseInt(newQuota)
      }));
      
      setShowQuotaModal(false);
      logger.info(`Updated quota for client ${clientId} to ${newQuota}`);
    } catch (err) {
      setError(`Error updating quota: ${err.message}`);
      logger.error(`Failed to update quota for client ${clientId}:`, err);
    }
  };
  
  // Handle client status change
  const handleStatusChange = async () => {
    try {
      const { type, reason } = confirmAction;
      let result;
      
      switch (type) {
        case 'approve':
          result = await adminService.approveClient(clientId);
          setClient(prev => ({
            ...prev,
            status: 'active',
            approvedAt: new Date().toISOString(),
            approvedBy: 'You'
          }));
          break;
        case 'suspend':
          result = await adminService.suspendClient(clientId, reason);
          setClient(prev => ({
            ...prev,
            status: 'suspended'
          }));
          break;
        case 'revoke':
          result = await adminService.revokeClient(clientId, reason);
          setClient(prev => ({
            ...prev,
            status: 'revoked'
          }));
          break;
        case 'reset':
          result = await adminService.resetClientUsage(clientId);
          setClient(prev => ({
            ...prev,
            usageCount: 0
          }));
          break;
        default:
          throw new Error('Invalid action type');
      }
      
      setShowConfirmModal(false);
      logger.info(`Changed client ${clientId} status to ${type}`);
    } catch (err) {
      setError(`Error changing client status: ${err.message}`);
      logger.error(`Failed to change status for client ${clientId}:`, err);
      setShowConfirmModal(false);
    }
  };
  
  // Prepare confirmation
  const prepareConfirmation = (type) => {
    setConfirmAction({
      type,
      reason: ''
    });
    setShowConfirmModal(true);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Format percentage
  const formatUsagePercentage = (count, quota) => {
    const percentage = (count / quota) * 100;
    return `${percentage.toFixed(1)}%`;
  };
  
  // Get usage bar color based on percentage
  const getUsageColor = (count, quota) => {
    const percentage = (count / quota) * 100;
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'danger';
  };
  
  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" variant="success" />
        <p className="mt-2">Loading client details...</p>
      </Container>
    );
  }
  
  if (!client) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error || 'Client not found'}
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/admin')}>
          Back to Admin Dashboard
        </Button>
      </Container>
    );
  }
  
  return (
    <Container fluid className="py-4 px-md-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={() => navigate('/admin')}
            className="mb-2"
          >
            <i className="bi bi-arrow-left me-1"></i> Back to Dashboard
          </Button>
          <h1 className="mb-0">Client Details</h1>
        </div>
        <ClientStatusBadge status={client.status} />
      </div>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </Alert>
      )}
      
      <Row>
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header className="bg-white">Client Information</Card.Header>
            <Card.Body>
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Client ID:</Col>
                <Col sm={9} className="text-break">
                  <code>{client.clientId}</code>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">User:</Col>
                <Col sm={9}>
                  <div>{client.user.name}</div>
                  <div className="text-muted">{client.user.email}</div>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Description:</Col>
                <Col sm={9}>
                  {client.description || 'No description provided'}
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Created:</Col>
                <Col sm={9}>{formatDate(client.createdAt)}</Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Status:</Col>
                <Col sm={9}>
                  <ClientStatusBadge status={client.status} />
                  {client.status === 'active' && client.approvedAt && (
                    <div className="text-muted small mt-1">
                      Approved on {formatDate(client.approvedAt)}
                      {client.approvedBy && ` by ${client.approvedBy}`}
                    </div>
                  )}
                </Col>
              </Row>
              
              <Row>
                <Col sm={3} className="text-muted">Last Activity:</Col>
                <Col sm={9}>{client.lastUsedAt ? formatDate(client.lastUsedAt) : 'Never'}</Col>
              </Row>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header className="bg-white">Usage Information</Card.Header>
            <Card.Body>
              <Row className="mb-4">
                <Col xs={12}>
                  <div className="d-flex justify-content-between mb-2">
                    <div>API Usage: <strong>{client.usageCount} / {client.usageQuota}</strong></div>
                    <div>{formatUsagePercentage(client.usageCount, client.usageQuota)}</div>
                  </div>
                  <div className="progress">
                    <div 
                      className={`progress-bar bg-${getUsageColor(client.usageCount, client.usageQuota)}`}
                      style={{ width: formatUsagePercentage(client.usageCount, client.usageQuota) }}
                    ></div>
                  </div>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Reset Date:</Col>
                <Col sm={9}>{formatDate(client.resetDate)}</Col>
              </Row>
              
              <Row className="mb-4">
                <Col sm={3} className="text-muted">Tokens Created:</Col>
                <Col sm={9}>{client.tokenCount || 0}</Col>
              </Row>
              
              <Row>
                <Col xs={12}>
                  <div className="d-flex flex-wrap gap-2">
                    <Button 
                      variant="outline-success" 
                      onClick={() => {
                        setNewQuota(client.usageQuota.toString());
                        setShowQuotaModal(true);
                      }}
                    >
                      <i className="bi bi-gear-fill me-1"></i> Adjust Quota
                    </Button>
                    
                    <Button 
                      variant="outline-warning" 
                      onClick={() => prepareConfirmation('reset')}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Usage Counter
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header className="bg-white">Actions</Card.Header>
            <Card.Body>
              <div className="d-grid gap-3">
                {client.status === 'pending' && (
                  <Button 
                    variant="success" 
                    onClick={() => prepareConfirmation('approve')}
                  >
                    <i className="bi bi-check-circle-fill me-1"></i> Approve Client
                  </Button>
                )}
                
                {client.status === 'active' && (
                  <Button 
                    variant="warning" 
                    onClick={() => prepareConfirmation('suspend')}
                  >
                    <i className="bi bi-pause-circle-fill me-1"></i> Suspend Client
                  </Button>
                )}
                
                {(client.status === 'active' || client.status === 'suspended') && (
                  <Button 
                    variant="danger" 
                    onClick={() => prepareConfirmation('revoke')}
                  >
                    <i className="bi bi-x-circle-fill me-1"></i> Revoke Client
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header className="bg-white">Security Information</Card.Header>
            <Card.Body>
              <div className="security-info">
                <div className="security-item">
                  <div className="security-icon">
                    <i className="bi bi-shield-lock-fill"></i>
                  </div>
                  <div className="security-content">
                    <div className="security-title">Client Secret</div>
                    <div className="security-value">
                      <span className="text-muted">Hidden for security</span>
                    </div>
                  </div>
                </div>
                
                <div className="security-item">
                  <div className="security-icon">
                    <i className="bi bi-key-fill"></i>
                  </div>
                  <div className="security-content">
                    <div className="security-title">Access Type</div>
                    <div className="security-value">
                      API Access
                    </div>
                  </div>
                </div>
                
                <div className="security-item">
                  <div className="security-icon">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div className="security-content">
                    <div className="security-title">Token Expiration</div>
                    <div className="security-value">
                      30 days
                    </div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Update Quota Modal */}
      <Modal show={showQuotaModal} onHide={() => setShowQuotaModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Usage Quota</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>New Monthly API Call Quota</Form.Label>
            <Form.Control 
              type="number" 
              value={newQuota}
              onChange={(e) => setNewQuota(e.target.value)}
              min="0"
            />
            <Form.Text className="text-muted">
              This is the maximum number of API calls this client can make per month
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowQuotaModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleUpdateQuota}>
            Update Quota
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmAction.type === 'approve' && (
            <p>Are you sure you want to approve this client? They will have immediate access to the API.</p>
          )}
          
          {confirmAction.type === 'suspend' && (
            <>
              <p>Are you sure you want to suspend this client? This will temporarily block their API access.</p>
              <Form.Group>
                <Form.Label>Reason for suspension</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={confirmAction.reason}
                  onChange={(e) => setConfirmAction(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a reason for this action"
                />
              </Form.Group>
            </>
          )}
          
          {confirmAction.type === 'revoke' && (
            <>
              <p>Are you sure you want to revoke this client? This will permanently block their API access.</p>
              <Form.Group>
                <Form.Label>Reason for revocation</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={confirmAction.reason}
                  onChange={(e) => setConfirmAction(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a reason for this action"
                />
              </Form.Group>
            </>
          )}
          
          {confirmAction.type === 'reset' && (
            <p>Are you sure you want to reset the usage counter for this client? This will set their API usage back to 0.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button 
            variant={
              confirmAction.type === 'approve' ? 'success' : 
              confirmAction.type === 'suspend' ? 'warning' : 
              confirmAction.type === 'revoke' ? 'danger' : 'primary'
            } 
            onClick={handleStatusChange}
            disabled={
              (confirmAction.type === 'suspend' || confirmAction.type === 'revoke') && 
              !confirmAction.reason
            }
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ClientDetailPage;