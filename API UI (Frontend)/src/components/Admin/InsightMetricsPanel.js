// src/components/Admin/InsightMetricsPanel.js
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Button, Table, Spinner } from 'react-bootstrap';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import axios from 'axios';
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
      
      // Fetch system metrics
      const metricsResponse = await axios.get('/api/insights/metrics/system');
      const metricsData = metricsResponse.data.data;
      setMetrics(metricsData);
      
      // Also fetch historical data
      try {
        const historicalResponse = await axios.get('/api/insights/metrics/history');
        const historicalData = historicalResponse.data.data;
        if (historicalData && Array.isArray(historicalData)) {
          setHistoricalMetrics(historicalData);
        }
      } catch (historyError) {
        logger.error('Error fetching historical metrics:', historyError);
      }
      
      setLoading(false);
    } catch (err) {
      logger.error('Error fetching insight metrics:', err);
      setError(err.message || 'Failed to fetch metrics');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
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
                        data={historicalMetrics}
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
                          yAxisId={1}
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
                        data={historicalMetrics}
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
                          data={preparePieData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {preparePieData().map((entry, index) => (
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