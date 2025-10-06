// src/components/Admin/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin';
import ClientStatusBadge from './ClientStatusBadge';
import InsightMetricsPanel from './InsightMetricsPanel';
import UserInsightMetrics from './UserInsightMetrics';
import AiInsightsTab from './AiInsightsTab';
import DataRetentionTab from './DataRetentionTab';
import EmailMonitoringTab from './EmailMonitoringTab';
import logger from '../../utils/logger';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [pendingClients, setPendingClients] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch system stats
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const statsData = await adminService.getSystemStats();
        setStats(statsData);
        setError('');
      } catch (err) {
        setError(`Error loading stats: ${err.message}`);
        logger.error('Failed to load admin stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [isAdmin, navigate]);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoadingClients(true);
        const result = await adminService.listClients(1, 10);
        setClients(result.clients);

        // Fetch pending clients separately
        const pendingResult = await adminService.listClients(1, 5, 'pending');
        setPendingClients(pendingResult.clients);

        setError('');
      } catch (err) {
        setError(`Error loading clients: ${err.message}`);
        logger.error('Failed to load clients:', err);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  // Handle client approval
  const handleApproveClient = async (clientId) => {
    try {
      await adminService.approveClient(clientId);

      // Update pending clients list
      setPendingClients(prev => prev.filter(client => client.clientId !== clientId));

      // Update all clients list if the client is in there
      setClients(prev =>
        prev.map(client =>
          client.clientId === clientId
            ? { ...client, status: 'active' }
            : client
        )
      );

      logger.info(`Approved client ${clientId}`);
    } catch (err) {
      setError(`Error approving client: ${err.message}`);
      logger.error(`Failed to approve client ${clientId}:`, err);
    }
  };

  // Handle client suspension
  const handleSuspendClient = async (clientId) => {
    try {
      const reason = prompt('Please enter a reason for suspending this client:');
      if (!reason) return; // Cancelled

      await adminService.suspendClient(clientId, reason);

      // Update clients list
      setClients(prev =>
        prev.map(client =>
          client.clientId === clientId
            ? { ...client, status: 'suspended' }
            : client
        )
      );

      logger.info(`Suspended client ${clientId}`);
    } catch (err) {
      setError(`Error suspending client: ${err.message}`);
      logger.error(`Failed to suspend client ${clientId}:`, err);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Render dashboard overview
  const renderOverview = () => (
    <>
      <Row className="mt-4">
        <Col md={12} lg={8}>
          <Card className="mb-4">
            <Card.Header className="bg-white">System Overview</Card.Header>
            <Card.Body>
              {loadingStats ? (
                <div className="text-center p-4">
                  <Spinner animation="border" variant="success" />
                  <p className="mt-2">Loading statistics...</p>
                </div>
              ) : stats ? (
                <Row>
                  <Col sm={4} className="mb-3">
                    <div className="stats-card">
                      <h2 className="text-success">{stats.clients.total}</h2>
                      <p className="text-muted">Total Clients</p>
                    </div>
                  </Col>
                  <Col sm={4} className="mb-3">
                    <div className="stats-card">
                      <h2 className="text-success">{stats.users.total}</h2>
                      <p className="text-muted">Registered Users</p>
                    </div>
                  </Col>
                  <Col sm={4} className="mb-3">
                    <div className="stats-card">
                      <h2 className="text-success">{stats.usage?.total || 0}</h2>
                      <p className="text-muted">Total API Calls</p>
                    </div>
                  </Col>

                  <Col xs={12}>
                    <h5 className="mt-4 mb-3">Client Status Breakdown</h5>
                    <Row>
                      <Col sm={3} xs={6} className="mb-3">
                        <div className="status-card text-white bg-success">
                          <h4>{stats.clients.byStatus?.active || 0}</h4>
                          <p className="mb-0">Active</p>
                        </div>
                      </Col>
                      <Col sm={3} xs={6} className="mb-3">
                        <div className="status-card text-white bg-warning">
                          <h4>{stats.clients.byStatus?.pending || 0}</h4>
                          <p className="mb-0">Pending</p>
                        </div>
                      </Col>
                      <Col sm={3} xs={6} className="mb-3">
                        <div className="status-card text-white bg-danger">
                          <h4>{stats.clients.byStatus?.suspended || 0}</h4>
                          <p className="mb-0">Suspended</p>
                        </div>
                      </Col>
                      <Col sm={3} xs={6} className="mb-3">
                        <div className="status-card text-white bg-dark">
                          <h4>{stats.clients.byStatus?.revoked || 0}</h4>
                          <p className="mb-0">Revoked</p>
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              ) : (
                <Alert variant="warning">Failed to load system statistics</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={12} lg={4}>
          <Card className="mb-4">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <span>Pending Approvals</span>
                {pendingClients.length > 0 && (
                  <Badge bg="warning" pill>{pendingClients.length}</Badge>
                )}
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {loadingClients ? (
                <div className="text-center p-4">
                  <Spinner animation="border" variant="success" size="sm" />
                  <p className="mt-2">Loading clients...</p>
                </div>
              ) : pendingClients.length > 0 ? (
                <Table responsive borderless className="mb-0">
                  <tbody>
                    {pendingClients.map(client => (
                      <tr key={client.clientId}>
                        <td>
                          <div className="d-flex flex-column">
                            <small className="text-success">{client.clientId}</small>
                            <span className='text-success'>{client.user.name}</span>
                            <small className="text-white">{client.user.email}</small>
                          </div>
                        </td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleApproveClient(client.clientId)}
                          >
                            Approve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4 text-muted">
                  <i className="bi bi-check-circle-fill mb-2" style={{ fontSize: '2rem' }}></i>
                  <p>No pending approvals</p>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="bg-white">Recent Activity</Card.Header>
            <Card.Body>
              {loadingStats ? (
                <div className="text-center p-4">
                  <Spinner animation="border" variant="success" size="sm" />
                  <p className="mt-2">Loading activity...</p>
                </div>
              ) : stats?.recentActivity?.clients ? (
                <div className="activity-list">
                  {stats.recentActivity.clients.map((client, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        <i className="bi bi-person-plus-fill"></i>
                      </div>
                      <div className="activity-content">
                        <div>New client registration: <strong>{client.userName}</strong></div>
                        <small className="text-muted">{formatDate(client.createdAt)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No recent activity to display</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* InsightMetricsPanel - Updated component */}
      <Row className="mt-4">
        <Col xs={12}>
          <InsightMetricsPanel />
        </Col>
      </Row>
    </>
  );

  // Render client management tab
  const renderClientManagement = () => (
    <Row className="mt-4">
      <Col xs={12}>
        <Card>
          <Card.Header className="bg-white">Client Management</Card.Header>
          <Card.Body className="p-0">
            {loadingClients ? (
              <div className="text-center p-4">
                <Spinner animation="border" variant="success" />
                <p className="mt-2">Loading clients...</p>
              </div>
            ) : clients.length > 0 ? (
              <Table responsive striped hover className="mb-0 table-light">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Usage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client.clientId}>
                      <td className="text-truncate" style={{ maxWidth: '150px' }}>
                        {client.clientId}
                      </td>
                      <td>
                        <div>
                          <div>{client.user.name}</div>
                          <small className="text-muted">{client.user.email}</small>
                        </div>
                      </td>
                      <td>
                        <ClientStatusBadge status={client.status} />
                      </td>
                      <td>{formatDate(client.createdAt)}</td>
                      <td>
                        {client.usageCount} / {client.usageQuota}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          {client.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApproveClient(client.clientId)}
                            >
                              Approve
                            </Button>
                          )}

                          {client.status === 'active' && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleSuspendClient(client.clientId)}
                            >
                              Suspend
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="info"
                            onClick={() => navigate(`/admin/clients/${client.clientId}`)}
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center p-4 text-muted">
                <p>No clients found</p>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );

  // Add Data Retention Tab render function
  const renderDataRetention = () => (
    <DataRetentionTab />
  );

  // New tab for AI Insights Analytics
  const renderAiAnalytics = () => (
    <AiInsightsTab />
  );

  // New tab for Email Monitoring
  const renderEmailMonitoring = () => (
    <EmailMonitoringTab />
  );

  return (
    <Container fluid className="py-4 px-md-4 admin-dashboard-container">
      <h1 className="mb-4 text-white">Admin Dashboard</h1>

      {error && (
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </Alert>
      )}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="overview" title="Overview">
          {renderOverview()}
        </Tab>
        <Tab eventKey="clients" title="Client Management">
          {renderClientManagement()}
        </Tab>
        <Tab eventKey="ai-analytics" title="AI Insights Analytics">
          {renderAiAnalytics()}
        </Tab>
        <Tab eventKey="email-monitoring" title="Email Monitoring">
          {renderEmailMonitoring()}
        </Tab>
        <Tab eventKey="data-retention" title="Data Retention">
          {renderDataRetention()}
        </Tab>
      </Tabs>
    </Container>
  );
};

export default AdminDashboard;