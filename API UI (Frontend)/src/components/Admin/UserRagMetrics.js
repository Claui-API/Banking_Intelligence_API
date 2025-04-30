// src/components/Admin/UserRagMetrics.js
import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ragMetricsService } from '../../services/ragMetrics.service';
import logger from '../../utils/logger';

/**
 * Component to display per-user RAG metrics for admin analytics
 */
const UserRagMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMetrics, setUserMetrics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('queryCount');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Fetch user metrics and query types from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch user metrics
        const userData = await ragMetricsService.getUserMetrics();
        
        // Process the data to ensure correct format
        const processedData = processUserData(userData);
        setUserMetrics(processedData);
        
        // Also fetch query type distribution for chart
        try {
          const queryTypeData = await ragMetricsService.getQueryTypeMetrics();
          
          // If we get query type data, update user metrics with it
          if (queryTypeData && queryTypeData.distribution) {
            // Map query distribution to each user based on their total query count
            // This is an approximation since we don't have per-user query type data
            const updatedUserMetrics = processedData.map(user => {
              const queryTypes = {};
              const totalSystemQueries = Object.values(queryTypeData.distribution).reduce((sum, val) => sum + val, 0);
              
              // Only calculate if we have system-wide data
              if (totalSystemQueries > 0) {
                Object.entries(queryTypeData.distribution).forEach(([type, count]) => {
                  // Estimate this user's queries of this type based on their proportion of total queries
                  const estimatedCount = Math.round(user.queryCount * (count / totalSystemQueries));
                  queryTypes[type] = estimatedCount;
                });
              }
              
              return {
                ...user,
                queryTypes
              };
            });
            
            setUserMetrics(updatedUserMetrics);
          }
        } catch (queryTypeError) {
          logger.error('Error fetching query type distribution:', queryTypeError);
          // Continue with user data we already have
        }
        
        setLoading(false);
        logger.info('Loaded user RAG metrics from API');
      } catch (err) {
        logger.error('Error fetching user RAG metrics:', err);
        setError(err.message || 'Failed to load user metrics');
        setLoading(false);
        
        // In development, set empty array to show no data message instead of spinner
        if (process.env.NODE_ENV !== 'production') {
          setUserMetrics([]);
        }
      }
    };
    
    fetchData();
  }, []);
  
  // Process user data from API to ensure it has the right format
  const processUserData = (userData) => {
    if (!Array.isArray(userData)) return [];
    
    return userData.map(user => {
      // Ensure all required fields are present
      return {
        userId: user.userId || 'unknown',
        name: user.name || 'Unknown User',
        email: user.email || 'unknown@example.com',
        queryCount: parseInt(user.queryCount) || 0,
        cachedCount: parseInt(user.cachedCount) || 0,
        directApiCount: parseInt(user.directApiCount) || 0,
        cacheHitRate: user.cacheHitRate ? String(user.cacheHitRate).replace('%', '') : '0.0',
        costSavings: user.costSavings || '0.00',
        queryTypes: user.queryTypes || {},
        lastActive: user.lastActive || new Date().toISOString(),
        documentsCount: user.documentsCount || 0
      };
    });
  };
  
  // Handle sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new column
      setSortBy(column);
      setSortDirection('desc');
    }
  };
  
  // Get sorted and filtered data
  const getSortedAndFilteredData = () => {
    const filteredData = userMetrics.filter(user => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchTermLower) ||
        user.email.toLowerCase().includes(searchTermLower) ||
        user.userId.toLowerCase().includes(searchTermLower)
      );
    });
    
    return filteredData.sort((a, b) => {
      let comparison = 0;
      
      // Define sort comparisons for different columns
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'queryCount':
          comparison = a.queryCount - b.queryCount;
          break;
        case 'cachedCount':
          comparison = a.cachedCount - b.cachedCount;
          break;
        case 'cacheHitRate':
          comparison = parseFloat(a.cacheHitRate) - parseFloat(b.cacheHitRate);
          break;
        case 'costSavings':
          comparison = parseFloat(a.costSavings) - parseFloat(b.costSavings);
          break;
        case 'lastActive':
          comparison = new Date(a.lastActive) - new Date(b.lastActive);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };
  
  // Prepare data for the bar chart
  const prepareQueryTypeChartData = () => {
    if (!userMetrics.length) return [];
    
    const queryTypeData = [];
    const queryTypeLabels = ['financial', 'budgeting', 'spending', 'saving', 'investing', 'greeting'];
    
    // Sum up query types across all filtered users
    const sortedAndFilteredData = getSortedAndFilteredData();
    
    queryTypeLabels.forEach(type => {
      const count = sortedAndFilteredData.reduce((sum, user) => 
        sum + (user.queryTypes[type] || 0), 0);
      
      queryTypeData.push({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        queries: count
      });
    });
    
    return queryTypeData;
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  if (loading) {
    return (
      <Card className="mb-4">
        <Card.Header className="bg-white">User RAG Analytics</Card.Header>
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="success" />
          <p className="mt-3 text-muted">Loading user analytics...</p>
        </Card.Body>
      </Card>
    );
  }
  
  const sortedAndFilteredData = getSortedAndFilteredData();
  
  return (
    <div className="user-rag-metrics">
      <Card className="mb-4">
        <Card.Header className="bg-white">Query Type Distribution</Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={prepareQueryTypeChartData()}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="queries" name="Query Count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <span>Per-User RAG Performance</span>
          <Form.Control
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-auto"
            size="sm"
          />
        </Card.Header>
        <Card.Body className="p-0">
          {error ? (
            <Alert variant="danger" className="m-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </Alert>
          ) : (
            <Table responsive striped hover className="mb-0 table-light">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    User
                    {sortBy === 'name' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                  <th onClick={() => handleSort('queryCount')} style={{ cursor: 'pointer' }}>
                    Queries
                    {sortBy === 'queryCount' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                  <th onClick={() => handleSort('cachedCount')} style={{ cursor: 'pointer' }}>
                    Cached
                    {sortBy === 'cachedCount' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                  <th onClick={() => handleSort('cacheHitRate')} style={{ cursor: 'pointer' }}>
                    Hit Rate
                    {sortBy === 'cacheHitRate' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                  <th onClick={() => handleSort('costSavings')} style={{ cursor: 'pointer' }}>
                    Savings
                    {sortBy === 'costSavings' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                  <th onClick={() => handleSort('lastActive')} style={{ cursor: 'pointer' }}>
                    Last Active
                    {sortBy === 'lastActive' && (
                      <i className={`bi bi-caret-${sortDirection === 'asc' ? 'up' : 'down'}-fill ms-1`}></i>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredData.length > 0 ? (
                  sortedAndFilteredData.map(user => (
                    <tr key={user.userId}>
                      <td>
                        <div>
                          <div className="fw-bold">{user.name}</div>
                          <small className="text-muted">{user.email}</small>
                        </div>
                      </td>
                      <td>{user.queryCount}</td>
                      <td>{user.cachedCount}</td>
                      <td>
                        <Badge 
                          bg={parseFloat(user.cacheHitRate) > 60 ? 'success' : 
                            parseFloat(user.cacheHitRate) > 30 ? 'warning' : 'danger'}
                        >
                          {user.cacheHitRate}%
                        </Badge>
                      </td>
                      <td>${user.costSavings}</td>
                      <td>{formatDate(user.lastActive)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <p className="text-muted mb-0">No users matching your search</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default UserRagMetrics;