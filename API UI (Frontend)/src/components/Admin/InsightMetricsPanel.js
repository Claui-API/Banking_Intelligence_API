// src/components/Admin/InsightMetricsPanel.js
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Button, Table, Spinner } from 'react-bootstrap';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { insightsMetricsService } from '../../services/insightsMetrics.service';
import logger from '../../utils/logger';

/**
 * Component to display AI Insights performance metrics
 * for admin dashboard
 */
const InsightMetricsPanel = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Historical metrics for charts
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  
  // Fetch metrics on component mount
  useEffect(() => {
    fetchMetrics();
  }, []);
  
  // Function to fetch metrics from API
  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      
      // Fetch system metrics using the service
      const metricsData = await insightsMetricsService.getSystemMetrics();
      setMetrics(metricsData);
      
      logger.info('InsightMetricsPanel: Metrics data loaded successfully');
      
      // Also fetch historical data using the service
      try {
        const historicalData = await insightsMetricsService.getHistoricalMetrics(7);
        if (historicalData && Array.isArray(historicalData)) {
          logger.info(`Loaded ${historicalData.length} historical data points`);
          setHistoricalMetrics(historicalData);
        }
      } catch (historyError) {
        logger.error('Error fetching historical metrics:', historyError);
      }
      
      setLoading(false);
    } catch (err) {
      logger.error('Error fetching insight metrics:', err);
      
      // Check for authentication issues
      if (err.message && err.message.includes('permission')) {
        setError('Authentication error: Please ensure you are logged in as an admin user');
      } else {
        setError(err.message || 'Failed to fetch metrics');
      }
      
      // Use mock data for development/preview only if we have no data
      if (process.env.NODE_ENV !== 'production' && !metrics) {
        setMetrics(getMockMetrics());
        setHistoricalMetrics(getMockHistoricalData());
        logger.info('Using mock metrics data for preview');
      }
      
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Generate mock data for development/preview
  const getMockMetrics = () => {
    return {
      totalQueries: 1432,
      successfulQueries: 1398,
      failedQueries: 34,
      successRate: '97.6%',
      avgResponseTime: 456,
      minResponseTime: 250,
      maxResponseTime: 1750,
      todayQueries: Math.floor(Math.random() * 100) + 50,
      queryTypeDistribution: {
        financial: 487,
        budgeting: 302,
        saving: 276,
        spending: 201,
        investing: 89,
        debt: 77
      },
      timestamp: new Date().toISOString()
    };
  };
  
  // Generate mock historical data for development/preview
  const getMockHistoricalData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        totalQueries: Math.floor(Math.random() * 100) + 50,
        avgResponseTime: Math.floor(Math.random() * 200) + 350,
        responseTime: Math.floor(Math.random() * 200) + 350
      });
    }
    
    return data;
  };
  
  // Format historical data for display
  const formatHistoricalData = (data) => {
    if (!Array.isArray(data) || data.length === 0) return [];
    
    return data.map(item => ({
      date: new Date(item.timestamp || item.date).toLocaleDateString(),
      totalQueries: item.totalQueries || 0,
      avgResponseTime: item.avgResponseTime || 0,
      responseTime: item.avgResponseTime || 0
    }));
  };
  
  // Prepare pie chart data for query types
  const preparePieData = () => {
    if (!metrics || !metrics.queryTypeDistribution) return [];
    
    return Object.entries(metrics.queryTypeDistribution).map(([type, count]) => ({
      name: type,
      value: count
    }));
  };
  
  // Colors for the pie chart
  const COLORS = ['#28a745', '#0d6efd', '#dc3545', '#fd7e14', '#6610f2', '#20c997'];
  
  if (loading && !metrics) {
    return (
      <Card className="mb-4">
        <Card.Header className="bg-white">AI Insights Performance</Card.Header>
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="success" />
          <p className="mt-3 text-muted">Loading metrics...</p>
        </Card.Body>
      </Card>
    );
  }
  
  // Format the data for display
  const formattedHistoricalData = formatHistoricalData(historicalMetrics);
  const pieData = preparePieData();
  
  return (
    <Card className="mb-4">
      <Card.Header className="bg-white d-flex justify-content-between align-items-center">
        <span>AI Insights Performance</span>
        <Button
          variant="outline-success"
          size="sm"
          onClick={fetchMetrics}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Refreshing...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Refresh
            </>
          )}
        </Button>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" className="mb-4">
            <i className="bi bi-exclamation-circle-fill me-2"></i>
            {error}
          </Alert>
        )}
        
        {metrics && (
          <>
            <Row className="mb-4">
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">Total Queries</h6>
                  <h2 className="mb-0 text-primary">{metrics.totalQueries}</h2>
                </div>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">Avg Response Time</h6>
                  <h2 className="mb-0 text-success">{metrics.avgResponseTime}ms</h2>
                </div>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">Today's Queries</h6>
                  <h2 className="mb-0 text-info">{metrics.todayQueries}</h2>
                </div>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">Success Rate</h6>
                  <h2 className="mb-0 text-success">{metrics.successRate || "99.8%"}</h2>
                </div>
              </Col>
            </Row>
            
            <Row className="mb-4">
              <Col lg={8}>
                <Card className="mb-4">
                  <Card.Header className="bg-white">Query Performance Over Time</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={formattedHistoricalData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="totalQueries"
                          name="Total Queries"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avgResponseTime"
                          name="Avg Response Time (ms)"
                          stroke="#28a745"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
                
                <Card>
                  <Card.Header className="bg-white">Response Time Trend</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={formattedHistoricalData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="responseTime"
                          name="Response Time (ms)"
                          fill="#28a745"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="mb-4">
                  <Card.Header className="bg-white">Query Type Distribution</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
                
                <Card>
                  <Card.Header className="bg-white">Performance Metrics</Card.Header>
                  <Card.Body className="p-0">
                    <Table striped bordered hover size="sm" className="mb-0 table-light">
                      <tbody>
                        <tr>
                          <td>Total Queries</td>
                          <td className="text-end">{metrics.totalQueries}</td>
                        </tr>
                        <tr>
                          <td>Average Response Time</td>
                          <td className="text-end">{metrics.avgResponseTime}ms</td>
                        </tr>
                        <tr>
                          <td>Fastest Response</td>
                          <td className="text-end">{metrics.minResponseTime || "250"}ms</td>
                        </tr>
                        <tr>
                          <td>Slowest Response</td>
                          <td className="text-end">{metrics.maxResponseTime || "1250"}ms</td>
                        </tr>
                        <tr>
                          <td>Success Rate</td>
                          <td className="text-end">{metrics.successRate || "99.8%"}</td>
                        </tr>
                        <tr>
                          <td>Last Updated</td>
                          <td className="text-end">
                            {new Date(metrics.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            <div className="bg-light p-3 rounded">
              <h6><i className="bi bi-info-circle me-2"></i>About AI Insights Metrics</h6>
              <p className="mb-0 small">
                The AI Insights system uses the Cohere API with specialized prompts tailored to different financial query types.
                This dashboard shows performance metrics including response times, query volumes, and query type distribution.
                Lower response times indicate better system efficiency and improved user experience.
              </p>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default InsightMetricsPanel;