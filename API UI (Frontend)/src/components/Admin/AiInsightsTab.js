// src/components/Admin/AiInsightsTab.js
import React, { useState } from 'react';
import { Row, Col, Card, Tabs, Tab, Badge } from 'react-bootstrap';
import InsightMetricsPanel from './InsightMetricsPanel';
import UserInsightMetrics from './UserInsightMetrics';

/**
 * AI Insights Analytics Tab Component
 * This component serves as a container for various AI analytics components
 */
const AiInsightsTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('system-metrics');
  
  return (
    <Row className="mt-4">
      <Col xs={12}>
        <Card className="mb-4">
          <Card.Header className="bg-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">AI Insights Analytics</h5>
              <Badge bg="success">AI-Enhanced</Badge>
            </div>
            <p className="text-muted small mt-2 mb-0">
              Monitor the performance of your AI-powered financial insights system
            </p>
          </Card.Header>
          <Card.Body>
            <Tabs
              activeKey={activeSubTab}
              onSelect={(k) => setActiveSubTab(k)}
              className="mb-4"
            >
              <Tab eventKey="system-metrics" title="System Metrics">
                <div className="pt-3">
                  <InsightMetricsPanel />
                </div>
              </Tab>
              <Tab eventKey="user-analytics" title="User Analytics">
                <div className="pt-3">
                  <UserInsightMetrics />
                </div>
              </Tab>
              <Tab eventKey="query-analytics" title="Query Analytics">
                <div className="pt-3">
                  <Card className="text-center py-5">
                    <Card.Body>
                      <h4 className="text-muted">Query Analytics Dashboard</h4>
                      <p className="text-muted">
                        This dashboard displays analytics about user queries, including common question types, 
                        trending topics, and query patterns over time.
                      </p>
                    </Card.Body>
                  </Card>
                </div>
              </Tab>
            </Tabs>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default AiInsightsTab;