// src/components/Admin/UserInsightMetrics.js
import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Button, Alert, Spinner, Badge, Tabs, Tab, Row, Col } from 'react-bootstrap';
import { Bar, BarChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { insightsMetricsService } from '../../services/insightsMetrics.service';
import logger from '../../utils/logger';

/**
 * Component to display per-user insight metrics for admin analytics
 */
const UserInsightMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMetrics, setUserMetrics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('queryCount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Fetch user metrics
  useEffect(() => {
    fetchData();
  }, []);
  
  // Function to fetch data from API using the service
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user metrics using the service
      const userData = await insightsMetricsService.getUserMetrics();
      
      setUserMetrics(userData);
      setLoading(false);
      
      if (userData.length > 0) {
        setSelectedUser(userData[0]);
      }
      
      logger.info(`Loaded user insight metrics for ${userData.length} users`);
    } catch (error) {
      logger.error('Error fetching user insight metrics:', error);
      
      // Check for authentication issues
      if (error.message && error.message.includes('permission')) {
        setError('Authentication error: Please ensure you are logged in as an admin user');
      } else {
        setError(error.message || 'Failed to load user metrics');
      }
      
      // Use mock data for development/preview only if we have no data
      if (process.env.NODE_ENV !== 'production' && userMetrics.length === 0) {
        const mockData = generateMockUserData();
        setUserMetrics(mockData);
        if (mockData.length > 0) {
          setSelectedUser(mockData[0]);
        }
        logger.info('Using mock user metrics data for preview');
      }
      
      setLoading(false);
    }
  };

  // Generate mock user data for development/preview
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
      activityByDay: Array(7).fill(0).map(() => Math.floor(Math.random() * 8))
    }));
  };
  
  // Handle user selection for detailed view
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setActiveTab('details');
  };
  
  // Get sorted and filtered user list
  const getSortedAndFilteredUsers = () => {
    return userMetrics
      .filter(user => {
        const searchTermLower = searchTerm.toLowerCase();
        return (
          (user.name && user.name.toLowerCase().includes(searchTermLower)) ||
          (user.email && user.email.toLowerCase().includes(searchTermLower)) ||
          (user.userId && user.userId.toLowerCase().includes(searchTermLower))
        );
      })
      .sort((a, b) => {
        let comparison = 0;
        
        switch(sortBy) {
          case 'name':
            comparison = (a.name || '').localeCompare(b.name || '');
            break;
          case 'queryCount':
            comparison = (a.queryCount || 0) - (b.queryCount || 0);
            break;
          case 'avgResponseTime':
            comparison = (a.avgResponseTime || 0) - (b.avgResponseTime || 0);
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
  };
  
  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Prepare query type chart data for a user
  const prepareQueryTypeChartData = (user) => {
    if (!user || !user.queryTypes) return [];
    
    return Object.entries(user.queryTypes).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count
    }));
  };
  
  // Prepare activity data for charts
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
  
  // Render the overview tab with user list
  const renderOverviewTab = () => {
    const sortedUsers = getSortedAndFilteredUsers();
    
    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Form.Control
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-auto"
          />
        </div>
        
        {sortedUsers.length > 0 ? (
          <Table responsive striped hover className='table-light'>
            <thead>
              <tr>
                <th onClick={() => setSortBy('name')} className="cursor-pointer">User</th>
                <th onClick={() => setSortBy('queryCount')} className="cursor-pointer">Queries</th>
                <th onClick={() => setSortBy('avgResponseTime')} className="cursor-pointer">Avg Response Time</th>
                <th onClick={() => setSortBy('lastActive')} className="cursor-pointer">Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <div className="fw-bold">{user.name || 'Unknown'}</div>
                    <div className="small text-muted">{user.email || user.userId}</div>
                  </td>
                  <td>{user.queryCount}</td>
                  <td>
                    <Badge 
                      bg={parseFloat(user.avgResponseTime) < 500 ? 'success' : 
                        parseFloat(user.avgResponseTime) < 1000 ? 'warning' : 'danger'}
                    >
                      {user.avgResponseTime}ms
                    </Badge>
                  </td>
                  <td>{user.lastActive ? formatDate(user.lastActive) : 'N/A'}</td>
                  <td>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleSelectUser(user)}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert variant="info">No users match your search criteria</Alert>
        )}
      </>
    );
  };
  
  // Render the user detail tab
  const renderUserDetailTab = () => {
    if (!selectedUser) {
      return <Alert variant="info">Select a user to view details</Alert>;
    }
    
    const queryTypeData = prepareQueryTypeChartData(selectedUser);
    const activityData = prepareActivityData(selectedUser);
    
    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4>{selectedUser.name || 'User Details'}</h4>
          <Badge bg="info">{selectedUser.email || selectedUser.userId}</Badge>
        </div>
        
        <Row className="mb-4">
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="text-center">
                <h6 className="text-muted">Total Queries</h6>
                <h2>{selectedUser.queryCount}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="text-center">
                <h6 className="text-muted">Avg Response Time</h6>
                <h2>{selectedUser.avgResponseTime}ms</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="text-center">
                <h6 className="text-muted">Most Common Query</h6>
                <h2>{selectedUser.mostCommonQueryType}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="text-center">
                <h6 className="text-muted">Success Rate</h6>
                <h2>{selectedUser.successRate || "99.8%"}</h2>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row className="mb-4">
          <Col md={6}>
            <Card>
              <Card.Header>Query Type Distribution</Card.Header>
              <Card.Body>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={queryTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {queryTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card>
              <Card.Header>Activity by Hour</Card.Header>
              <Card.Body>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activityData.hourly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="queries" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Card>
          <Card.Header>Recent Queries</Card.Header>
          <Card.Body>
            {selectedUser.recentQueries && selectedUser.recentQueries.length > 0 ? (
              <Table responsive striped className='table-light'>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Query</th>
                    <th>Type</th>
                    <th>Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.recentQueries.map((query, index) => (
                    <tr key={index}>
                      <td>{formatDate(query.createdAt)}</td>
                      <td>{query.query}</td>
                      <td>{query.queryType}</td>
                      <td>{query.processingTime ? `${query.processingTime}ms` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-center text-muted">No recent queries found</p>
            )}
          </Card.Body>
        </Card>
      </>
    );
  };
  
  return (
    <div className="user-insight-metrics">
      {loading ? (
        <div className="text-center p-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading user metrics...</p>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <Card>
          <Card.Header>
            <Tabs
              activeKey={activeTab}
              onSelect={setActiveTab}
              className="card-header-tabs"
            >
              <Tab eventKey="overview" title="User Overview" />
              <Tab eventKey="details" title="User Details" disabled={!selectedUser} />
            </Tabs>
          </Card.Header>
          <Card.Body>
            {activeTab === 'overview' ? renderOverviewTab() : renderUserDetailTab()}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#747CB4'];

export default UserInsightMetrics;