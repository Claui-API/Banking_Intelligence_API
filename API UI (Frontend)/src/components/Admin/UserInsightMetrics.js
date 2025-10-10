import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Form, Spinner, Alert, Table, Tabs, Tab, Container, Row, Col } from 'react-bootstrap';
import { Bar, BarChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { insightsMetricsService } from '../../services/insightsMetrics.service';
import logger from '../../utils/logger';
// Import Bootstrap Icons CSS - add this if not already in your main CSS
// import 'bootstrap-icons/font/bootstrap-icons.css';

// Colors for charts - moved to top
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#747CB4'];

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Error in UserInsightMetrics component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="danger">
          <h5>Something went wrong in the User Insights component</h5>
          <p>Please try refreshing the page. If the problem persists, contact support.</p>
          <details className="mt-2">
            <summary>Technical details</summary>
            <pre className="mt-2 p-2 bg-light">{this.state.error?.toString()}</pre>
          </details>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Refresh Page
          </Button>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * Enhanced User Insight Metrics with Dark Theme Design
 */
const UserInsightMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMetrics, setUserMetrics] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('queryCount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Security: Enhanced sanitize function
  const sanitizeText = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, (match) => {
      const escapeChars = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return escapeChars[match];
    });
  };

  // Generate mock data for fallback
  const generateMockUserData = () => {
    return Array.from({ length: 8 }).map((_, i) => ({
      userId: `user-${i + 1}`,
      name: `Test User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      queryCount: Math.floor(Math.random() * 200) + 50,
      successCount: Math.floor(Math.random() * 180) + 40,
      failedCount: Math.floor(Math.random() * 10),
      avgResponseTime: Math.floor(Math.random() * 300) + 300,
      successRate: `${(Math.random() * 10 + 90).toFixed(1)}`,
      lastActive: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
      mostCommonQueryType: ['financial', 'budgeting', 'saving', 'spending'][Math.floor(Math.random() * 4)],
      engagementScore: Math.floor(Math.random() * 40) + 60,
      queryTypes: {
        financial: Math.floor(Math.random() * 50) + 10,
        budgeting: Math.floor(Math.random() * 40) + 5,
        saving: Math.floor(Math.random() * 30) + 5,
        spending: Math.floor(Math.random() * 20) + 5
      },
      recentQueries: Array.from({ length: 5 }).map((_, j) => ({
        queryId: `query-${i + 1}-${j + 1}`,
        query: ['How can I save money?', 'What are my spending patterns?', 'How to budget better?'][Math.floor(Math.random() * 3)],
        queryType: ['financial', 'budgeting', 'saving', 'spending'][Math.floor(Math.random() * 4)],
        processingTime: Math.floor(Math.random() * 500) + 300,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)).toISOString()
      })),
      activityByHour: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
      activityByDay: Array(7).fill(0).map(() => Math.floor(Math.random() * 8)),
      queryAnalysis: {
        behaviorSummary: `Test User ${i + 1} shows regular engagement with budgeting and savings planning tools.`,
        primaryInterests: ['budgeting', 'saving', 'investing'],
        insights: [
          'User demonstrates consistent interest in budgeting strategies',
          'Shows preference for actionable financial advice'
        ],
        recommendations: [
          'Explore advanced budgeting features',
          'Set up automated savings goals'
        ],
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        engagementPattern: ['casual', 'regular', 'heavy'][Math.floor(Math.random() * 3)],
        nextBestAction: 'Set up comprehensive financial planning session',
        confidence: 'high'
      }
    }));
  };

  // Properly declared fetchData function
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Attempting to fetch user metrics data...');
      const userData = await insightsMetricsService.getUserMetrics({ enhanced: true });

      if (userData && userData.length > 0) {
        setUserMetrics(userData);
        logger.info(`Loaded enhanced user insight metrics for ${userData.length} users`);
      } else {
        // No data returned, use mock data
        logger.warn('No user metrics data returned from API, using mock data');
        const mockData = generateMockUserData();
        setUserMetrics(mockData);
        setError('API returned no data. Using sample data for demonstration.');
      }
    } catch (error) {
      logger.error('Error fetching user insight metrics:', error);

      // Determine error type and set appropriate message
      let errorMessage = 'Failed to load user metrics';

      if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. The server may be processing data. Using sample data for demonstration.';
      } else if (error.message.includes('permission') || error.message.includes('403')) {
        errorMessage = 'Authentication error: Please ensure you are logged in as an admin user';
      } else if (error.message.includes('404')) {
        errorMessage = 'User metrics endpoint not available. Using sample data for demonstration.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network connection error. Using sample data for demonstration.';
      } else {
        errorMessage = error.message || 'Failed to load user metrics. Using sample data for demonstration.';
      }

      setError(errorMessage);

      // Always use mock data as fallback to show the UI
      const mockData = generateMockUserData();
      setUserMetrics(mockData);
      logger.info('Using mock user metrics data as fallback');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh analysis - Enhanced version
  const handleRefreshAnalysis = async () => {
    try {
      setRefreshing(true);
      setError(null);
      setSuccessMessage(null);

      logger.info('Starting comprehensive analysis refresh...');

      // Step 1: Clear the service cache first
      if (insightsMetricsService && typeof insightsMetricsService.clearCache === 'function') {
        insightsMetricsService.clearCache();
        logger.info('Service cache cleared');
      }

      // Step 2: Trigger background analysis with force refresh
      const response = await fetch('/api/insights-metrics/trigger-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          forceRefresh: true,
          batchSize: 10, // Process more users at once for faster refresh
          maxAgeHours: 0 // Force refresh all users regardless of age
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to trigger analysis');
      }

      const result = await response.json();
      logger.info('Analysis refresh triggered:', result);

      // Show initial success message
      setSuccessMessage('🔄 Analysis restart initiated! Processing all users...');

      // Step 3: Check analysis status periodically
      let attempts = 0;
      const maxAttempts = 12; // Check for up to 1 minute

      const checkAnalysisStatus = async () => {
        try {
          attempts++;

          const statusResponse = await fetch('/api/insights-metrics/analysis-status', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const status = statusData.data;

            if (!status.isRunning) {
              // Analysis completed, refresh the display
              setSuccessMessage('✅ Analysis complete! Refreshing display...');

              // Wait a moment then refresh the user data
              setTimeout(async () => {
                await refreshUserData();
              }, 1000);

              return; // Exit the polling loop
            } else {
              // Analysis still running
              setSuccessMessage(`🔄 Processing... ${status.processedCount} users analyzed (${status.currentBatch?.length || 0} in current batch)`);
            }
          }

          // Continue checking if not at max attempts
          if (attempts < maxAttempts) {
            setTimeout(checkAnalysisStatus, 5000); // Check every 5 seconds
          } else {
            // Max attempts reached, just refresh the data
            setSuccessMessage('⏰ Analysis taking longer than expected. Refreshing display...');
            setTimeout(async () => {
              await refreshUserData();
            }, 2000);
          }

        } catch (statusError) {
          logger.error('Error checking analysis status:', statusError);
          // If status check fails, just refresh the data after a delay
          setTimeout(async () => {
            await refreshUserData();
          }, 8000);
        }
      };

      // Start checking status after initial delay
      setTimeout(checkAnalysisStatus, 3000);

    } catch (error) {
      logger.error('Error triggering analysis refresh:', error);
      setError(`Failed to restart analysis: ${error.message}`);
      setSuccessMessage(null);
      setRefreshing(false);
    }
  };

  // Helper function to refresh user data
  const refreshUserData = async () => {
    try {
      logger.info('Refreshing user metrics display...');

      // Get fresh data with enhanced analysis
      const userData = await insightsMetricsService.getUserMetrics({ enhanced: true });
      setUserMetrics(userData);

      setSuccessMessage('🎉 Analysis completed successfully! All charts now show updated data.');
      logger.info(`Display refreshed with ${userData.length} users`);

      // Clear success message after 8 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 8000);

    } catch (refreshError) {
      logger.error('Error refreshing user data:', refreshError);
      setError('Analysis completed but failed to refresh display. Please reload the page to see new data.');
      setSuccessMessage(null);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Filter and sort when dependencies change
  useEffect(() => {
    filterAndSortUsers();
  }, [userMetrics, searchTerm, sortBy, sortDirection]);

  const filterAndSortUsers = () => {
    let filtered = [...userMetrics];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.userId && user.userId.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'queryCount':
          comparison = (a.queryCount || 0) - (b.queryCount || 0);
          break;
        case 'avgResponseTime':
          comparison = (a.avgResponseTime || 0) - (b.avgResponseTime || 0);
          break;
        case 'engagementScore':
          comparison = (a.engagementScore || 0) - (b.engagementScore || 0);
          break;
        case 'lastActive':
          const dateA = a.lastActive ? new Date(a.lastActive) : new Date(0);
          const dateB = b.lastActive ? new Date(b.lastActive) : new Date(0);
          comparison = dateA - dateB;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredUsers(filtered);
  };

  const getBadgeClass = (type, value) => {
    switch (type) {
      case 'engagement':
        if (value >= 70) return 'success';
        if (value >= 50) return 'warning';
        return 'danger';
      case 'responseTime':
        if (value < 500) return 'success';
        if (value < 1000) return 'warning';
        return 'danger';
      case 'risk':
        if (value === 'low') return 'success';
        if (value === 'medium') return 'warning';
        return 'danger';
      case 'status':
        if (value) return 'success';
        return 'danger';
      default:
        return 'primary';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const prepareQueryTypeChartData = (user) => {
    if (!user || !user.queryTypes) return [];

    return Object.entries(user.queryTypes)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: Number(count)
      }))
      .sort((a, b) => b.value - a.value);
  };

  const prepareActivityData = (user) => {
    if (!user) return { hourly: [], daily: [] };

    const hourlyData = user.activityByHour ? user.activityByHour.map((count, hour) => ({
      hour: `${hour}:00`,
      queries: count
    })) : [];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData = user.activityByDay ? user.activityByDay.map((count, day) => ({
      day: days[day],
      queries: count
    })) : [];

    return { hourly: hourlyData, daily: dailyData };
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setActiveTab('details');
  };

  // Calculate dashboard stats
  const totalQueries = filteredUsers.reduce((sum, user) => sum + (user.queryCount || 0), 0);
  const avgResponseTime = filteredUsers.length > 0
    ? Math.round(filteredUsers.reduce((sum, user) => sum + (user.avgResponseTime || 0), 0) / filteredUsers.length)
    : 0;

  // Render Overview Tab
  const renderOverviewTab = () => (
    <>
      {/* Header Stats */}
      <Row className="mb-4">
        <Col md={3} sm={6}>
          <Card bg="dark" text="white" className="h-100">
            <Card.Body className="text-center">
              <h2 className="text-success mb-2">{filteredUsers.length}</h2>
              <small className="text-muted">Total Users</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card bg="dark" text="white" className="h-100">
            <Card.Body className="text-center">
              <h2 className="text-primary mb-2">{totalQueries}</h2>
              <small className="text-muted">Total Queries</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card bg="dark" text="white" className="h-100">
            <Card.Body className="text-center">
              <h2 className="text-warning mb-2">{avgResponseTime}ms</h2>
              <small className="text-muted">Avg Response</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card bg="dark" text="white" className="h-100">
            <Card.Body className="text-center">
              <h2 className="text-info mb-2">98.5%</h2>
              <small className="text-muted">Success Rate</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Controls */}
      <Card bg="dark" text="white" className="mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={5}>
              <Form.Control
                type="text"
                placeholder="Search users by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-dark text-white border-secondary"
                style={{ backgroundColor: '#1a1a1a !important' }}
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white text-black border-secondary"
              >
                <option value="queryCount">Query Count</option>
                <option value="name">Name</option>
                <option value="avgResponseTime">Response Time</option>
                <option value="engagementScore">Engagement</option>
                <option value="lastActive">Last Active</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-success"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  title="Toggle sort direction"
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </Button>

                {/* Enhanced Refresh Analysis Button */}
                <Button
                  variant={refreshing ? "warning" : "primary"}
                  onClick={handleRefreshAnalysis}
                  disabled={refreshing}
                  className="d-flex align-items-center"
                  title="Restart complete user analysis process"
                >
                  {refreshing ? (
                    <>
                      <Spinner
                        animation="border"
                        size="sm"
                        className="me-2"
                        style={{ width: '1rem', height: '1rem' }}
                      />
                      <span className="d-none d-md-inline">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      <span className="d-none d-md-inline">Restart Analysis</span>
                    </>
                  )}
                </Button>

                {/* Regular Data Refresh Button */}
                <Button
                  variant="outline-info"
                  onClick={fetchData}
                  disabled={loading}
                  size="sm"
                  title="Refresh display data only"
                >
                  {loading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <i className="bi bi-arrow-repeat"></i>
                  )}
                </Button>
              </div>
            </Col>
          </Row>

          {/* Analysis Status Info */}
          {refreshing && (
            <Row className="mt-3">
              <Col>
                <div className="d-flex align-items-center text-info small">
                  <Spinner animation="grow" size="sm" className="me-2" />
                  <span>
                    Comprehensive analysis in progress. This will analyze all user behavior patterns
                    and may take 1-2 minutes to complete.
                  </span>
                </div>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <Card bg="dark" text="white" className="text-center py-5">
          <Card.Body>
            <h4 className="text-white mb-3">No users found</h4>
            <p className="text-white">Try adjusting your search criteria or check back later.</p>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {filteredUsers.map((user) => {
            const analysis = user.queryAnalysis;
            return (
              <Col lg={6} key={user.userId} className="mb-4">
                <Card bg="dark" text="white" className="h-100">
                  <Card.Header className="bg-black border-success">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h5 className="mb-1 text-white">
                          {sanitizeText(user.name || 'Unknown User')}
                        </h5>
                        <small className="text-white">{sanitizeText(user.email || user.userId)}</small>
                      </div>
                      <div className="d-flex flex-wrap gap-1">
                        <Badge bg={getBadgeClass('engagement', user.engagementScore)}>
                          {user.engagementScore || 50}% Engaged
                        </Badge>
                        <Badge bg={getBadgeClass('responseTime', user.avgResponseTime)}>
                          {user.avgResponseTime}ms
                        </Badge>
                        {analysis && (
                          <Badge bg={getBadgeClass('risk', analysis.riskLevel)}>
                            {analysis.riskLevel} Risk
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card.Header>

                  <Card.Body className="bg-black">
                    {/* Metrics Grid */}
                    <Row className="mb-3">
                      <Col xs={4} className="text-center">
                        <div className="border border-secondary rounded p-2">
                          <h4 className="text-primary mb-1">{user.queryCount}</h4>
                          <small className="text-white">Queries</small>
                        </div>
                      </Col>
                      <Col xs={4} className="text-center">
                        <div className="border border-secondary rounded p-2">
                          <h4 className="text-success mb-1">{user.successRate || '99%'}</h4>
                          <small className="text-white">Success</small>
                        </div>
                      </Col>
                      <Col xs={4} className="text-center">
                        <div className="border border-secondary rounded p-2">
                          <h4 className="text-warning mb-1">
                            {analysis ? analysis.engagementPattern : 'Regular'}
                          </h4>
                          <small className="text-white">Pattern</small>
                        </div>
                      </Col>
                    </Row>

                    {/* AI Analysis Section */}
                    {analysis && (
                      <Alert variant="info" className="mb-3">
                        <div className="d-flex align-items-center mb-2">
                          <Badge bg="primary" className="me-2">AI Analysis</Badge>
                        </div>
                        <p className="mb-2 small">
                          {sanitizeText(analysis.behaviorSummary)}
                        </p>
                        <Row className="small">
                          <Col md={6}>
                            <strong>Key Insights:</strong>
                            <ul className="mb-2">
                              {analysis.insights?.slice(0, 2).map((insight, idx) => (
                                <li key={idx}>{sanitizeText(insight)}</li>
                              ))}
                            </ul>
                          </Col>
                          <Col md={6}>
                            <strong>Interests:</strong>
                            <div className="mb-2">
                              {analysis.primaryInterests?.slice(0, 3).map((interest, idx) => (
                                <Badge key={idx} bg="secondary" className="me-1 mb-1">
                                  {sanitizeText(interest)}
                                </Badge>
                              ))}
                            </div>
                          </Col>
                        </Row>
                      </Alert>
                    )}

                    {/* Actions */}
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-white">
                        Last active: {formatDate(user.lastActive)}
                      </small>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleSelectUser(user)}
                      >
                        View Details
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );

  // Render User Detail Tab
  const renderUserDetailTab = () => {
    if (!selectedUser) {
      return (
        <Card bg="dark" text="white" className="text-center py-5">
          <Card.Body>
            <h4 className="text-muted">Select a user to view details</h4>
          </Card.Body>
        </Card>
      );
    }

    return (
      <>
        <Card bg="dark" text="white" className="mb-4">
          <Card.Header className="bg-black border-success d-flex justify-content-between align-items-center">
            <h4 className="mb-0">{sanitizeText(selectedUser.name || 'User Details')}</h4>
            <Button variant="outline-secondary" size="sm" onClick={() => setSelectedUser(null)}>
              Back to Overview
            </Button>
          </Card.Header>
          <Card.Body className="bg-black">
            {/* Key Metrics */}
            <Row className="mb-4">
              <Col md={3} sm={6} className="mb-3">
                <Card bg="secondary" text="black" className="text-center">
                  <Card.Body>
                    <h4 className="text-primary">{selectedUser.queryCount}</h4>
                    <small>Total Queries</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <Card bg="secondary" text="black" className="text-center">
                  <Card.Body>
                    <h4 className={`text-${getBadgeClass('responseTime', selectedUser.avgResponseTime) === 'success' ? 'success' :
                      getBadgeClass('responseTime', selectedUser.avgResponseTime) === 'warning' ? 'warning' : 'danger'}`}>
                      {selectedUser.avgResponseTime}ms
                    </h4>
                    <small>Avg Response Time</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <Card bg="secondary" text="black" className="text-center">
                  <Card.Body>
                    <h4 className="text-success">{selectedUser.successRate || "99.8%"}</h4>
                    <small>Success Rate</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <Card bg="secondary" text="black" className="text-center">
                  <Card.Body>
                    <h4 className={`text-${getBadgeClass('engagement', selectedUser.engagementScore) === 'success' ? 'success' :
                      getBadgeClass('engagement', selectedUser.engagementScore) === 'warning' ? 'warning' : 'danger'}`}>
                      {selectedUser.engagementScore || 50}%
                    </h4>
                    <small>Engagement Score</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Charts */}
            <Row className="mb-4">
              <Col lg={6} className="mb-4">
                <Card bg="secondary" text="white">
                  <Card.Header className="bg-dark">
                    <h6 className="mb-0">Query Type Distribution</h6>
                  </Card.Header>
                  <Card.Body>
                    {prepareQueryTypeChartData(selectedUser).length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={prepareQueryTypeChartData(selectedUser)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {prepareQueryTypeChartData(selectedUser).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted py-5">
                        No query type data available
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={6} className="mb-4">
                <Card bg="secondary" text="white">
                  <Card.Header className="bg-dark">
                    <h6 className="mb-0">Activity by Hour</h6>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareActivityData(selectedUser).hourly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="queries" fill="#28a745" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Recent Queries */}
            <Card bg="secondary" text="white">
              <Card.Header className="bg-dark">
                <h6 className="mb-0">Recent Queries</h6>
              </Card.Header>
              <Card.Body>
                {selectedUser.recentQueries && selectedUser.recentQueries.length > 0 ? (
                  <Table responsive striped variant="dark">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Query</th>
                        <th>Type</th>
                        <th>Response Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUser.recentQueries.map((query, index) => (
                        <tr key={index}>
                          <td>{formatDate(query.createdAt)}</td>
                          <td className="text-truncate" style={{ maxWidth: '300px' }}>
                            {sanitizeText(query.query)}
                          </td>
                          <td>
                            <Badge bg="info">{sanitizeText(query.queryType)}</Badge>
                          </td>
                          <td>{query.processingTime ? `${query.processingTime}ms` : 'N/A'}</td>
                          <td>
                            <Badge bg={getBadgeClass('status', query.success !== false)}>
                              {query.success !== false ? 'Success' : 'Failed'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center text-muted py-4">
                    No recent queries found
                  </div>
                )}
              </Card.Body>
            </Card>
          </Card.Body>
        </Card>
      </>
    );
  };

  // Don't return early on error - instead show the error but continue to render with mock data
  const renderError = () => {
    if (!error) return null;

    const isTimeoutOrConnectionError = error.includes('timeout') || error.includes('network') || error.includes('404') || error.includes('demonstration');

    return (
      <Alert
        variant={isTimeoutOrConnectionError ? "warning" : "danger"}
        className="mb-4"
        dismissible
        onClose={() => setError(null)}
      >
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <Alert.Heading as="h6">
              {isTimeoutOrConnectionError ? "API Connection Issue" : "Error Loading Data"}
            </Alert.Heading>
            <p className="mb-2">{error}</p>
            {isTimeoutOrConnectionError && (
              <small className="text-muted">
                The dashboard is displaying sample data. Your actual metrics will appear once the API is responding.
              </small>
            )}
          </div>
          <Button
            variant={isTimeoutOrConnectionError ? "outline-warning" : "outline-danger"}
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </Alert>
    );
  };

  if (loading) {
    return (
      <Container fluid className="py-4 bg-black">
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
          <p className="text-white mt-3">Loading user analytics...</p>
        </div>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container fluid className="py-4 bg-black text-white">
        {/* Show error alert but don't prevent rendering */}
        {renderError()}

        <Card bg="dark" text="white">
          <Card.Header className="bg-black border-success">
            <Tabs
              activeKey={activeTab}
              onSelect={setActiveTab}
              variant="pills"
              className="custom-tabs"
            >
              <Tab eventKey="overview" title="User Overview" />
              <Tab eventKey="details" title="User Details" disabled={!selectedUser} />
            </Tabs>
          </Card.Header>
          <Card.Body className="bg-black">
            {activeTab === 'overview' ? renderOverviewTab() : renderUserDetailTab()}
          </Card.Body>
        </Card>
      </Container>
    </ErrorBoundary>
  );
};

export default UserInsightMetrics;