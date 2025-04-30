// src/components/Admin/RagMetricsPanel.js
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Button, Table, Spinner } from 'react-bootstrap';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { ragMetricsService } from '../../services/ragMetrics.service';
import logger from '../../utils/logger';

/**
 * Component to display RAG (Retrieval Augmented Generation) metrics
 * for admin dashboard
 */
const RagMetricsPanel = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Historical metrics for charts (in a real implementation, this would come from the API)
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  
  // Fetch metrics on component mount
  useEffect(() => {
    fetchMetrics();
  }, []);
  
  // Function to fetch metrics from API
  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      
      const metricsData = await ragMetricsService.getSystemMetrics();
      setMetrics(metricsData);
      
      // Also fetch historical data if available from the API
      try {
        const historicalData = await ragMetricsService.getHistoricalMetrics();
        if (historicalData && Array.isArray(historicalData)) {
          setHistoricalMetrics(historicalData);
        }
      } catch (historyError) {
        logger.error('Error fetching historical metrics:', historyError);
        // Keep using existing historical data if available
      }
      
      setLoading(false);
    } catch (err) {
      logger.error('Error fetching RAG metrics:', err);
      setError(err.message || 'Failed to fetch metrics');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Format historical data for display
  const formatHistoricalData = (data) => {
    // If no data is provided, return empty array
    if (!Array.isArray(data) || data.length === 0) return [];
    
    // Process the data to ensure it has all required fields
    return data.map(item => ({
      date: new Date(item.timestamp || item.date).toLocaleDateString(),
      totalQueries: item.totalQueries || 0,
      cachedQueries: item.cachedQueries || 0,
      directApiCalls: item.directApiCalls || 0,
      cacheHitRate: typeof item.cacheHitRate === 'string' 
        ? item.cacheHitRate.replace('%', '') 
        : (item.cacheHitRate || 0).toFixed(1),
      apiCallRate: typeof item.apiCallRate === 'string' 
        ? item.apiCallRate.replace('%', '') 
        : (item.apiCallRate || 0).toFixed(1),
      estimatedApiSavings: typeof item.estimatedApiSavings === 'string'
        ? item.estimatedApiSavings
        : (item.estimatedApiSavings || 0).toFixed(2)
    }));
  };
  
  // Prepare pie chart data
  const preparePieData = () => {
    if (!metrics) return [];
    
    return [
      { name: 'Cached Queries', value: metrics.cachedQueries },
      { name: 'Direct API Calls', value: metrics.directApiCalls }
    ];
  };
  
  // Colors for the pie chart
  const COLORS = ['#28a745', '#dc3545'];
  
  // Calculate monetary savings
  const calculateSavings = () => {
    if (!metrics) return '$0.00';
    
    // Assuming $0.02 per API call saved
    const savings = metrics.cachedQueries * 0.02;
    return `$${savings.toFixed(2)}`;
  };
  
  if (loading && !metrics) {
    return (
      <Card className="mb-4">
        <Card.Header className="bg-white">RAG System Metrics</Card.Header>
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="success" />
          <p className="mt-3 text-muted">Loading RAG metrics...</p>
        </Card.Body>
      </Card>
    );
  }
  
  return (
    <Card className="mb-4">
      <Card.Header className="bg-white d-flex justify-content-between align-items-center">
        <span>RAG System Metrics</span>
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
                  <h6 className="text-muted">Cache Hit Rate</h6>
                  <h2 className="mb-0 text-success">{metrics.cacheHitRate}</h2>
                </div>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">API Call Rate</h6>
                  <h2 className="mb-0 text-danger">{metrics.apiCallRate}</h2>
                </div>
              </Col>
              <Col md={3} sm={6} className="mb-3">
                <div className="border rounded p-3 h-100">
                  <h6 className="text-muted">Est. API Cost Savings</h6>
                  <h2 className="mb-0 text-success">{calculateSavings()}</h2>
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
                        <Tooltip formatter={(value) => [value, 'Queries']} />
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
                          dataKey="cachedQueries"
                          name="Cached Queries"
                          stroke="#28a745"
                        />
                        <Line
                          type="monotone"
                          dataKey="directApiCalls"
                          name="Direct API Calls"
                          stroke="#dc3545"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
                
                <Card>
                  <Card.Header className="bg-white">Cache Hit Rate Trend</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={historicalMetrics}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => [`${value}%`, 'Rate']} />
                        <Legend />
                        <Bar
                          dataKey="cacheHitRate"
                          name="Cache Hit Rate"
                          fill="#28a745"
                        />
                        <Bar
                          dataKey="apiCallRate"
                          name="API Call Rate"
                          fill="#dc3545"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="mb-4">
                  <Card.Header className="bg-white">Query Distribution</Card.Header>
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
                  <Card.Header className="bg-white">Detailed Metrics</Card.Header>
                  <Card.Body className="p-0">
                    <Table striped bordered hover size="sm" className="mb-0 table-light">
                      <tbody>
                        <tr>
                          <td>Total Queries</td>
                          <td className="text-end">{metrics.totalQueries}</td>
                        </tr>
                        <tr>
                          <td>Cached Queries</td>
                          <td className="text-end">{metrics.cachedQueries}</td>
                        </tr>
                        <tr>
                          <td>Direct API Calls</td>
                          <td className="text-end">{metrics.directApiCalls}</td>
                        </tr>
                        <tr>
                          <td>Cache Hit Rate</td>
                          <td className="text-end">{metrics.cacheHitRate}</td>
                        </tr>
                        <tr>
                          <td>API Call Rate</td>
                          <td className="text-end">{metrics.apiCallRate}</td>
                        </tr>
                        <tr>
                          <td>Est. API Cost Savings</td>
                          <td className="text-end">${metrics.estimatedApiSavings}</td>
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
              <h6><i className="bi bi-info-circle me-2"></i>About RAG Metrics</h6>
              <p className="mb-0 small">
                RAG (Retrieval Augmented Generation) enhances AI responses by retrieving relevant information before generating answers.
                This dashboard shows performance metrics including cache hit rates (when answers are served from cache instead of calling the API)
                and estimated cost savings. A higher cache hit rate indicates better system efficiency and lower operating costs.
              </p>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default RagMetricsPanel;