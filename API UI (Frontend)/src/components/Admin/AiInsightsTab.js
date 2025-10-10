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
            </Tabs>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default AiInsightsTab;