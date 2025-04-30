// src/components/Admin/AiInsightsTab.js
import React, { useState } from 'react';
import { Row, Col, Card, Tabs, Tab, Badge } from 'react-bootstrap';
import RagMetricsPanel from './RagMetricsPanel';
import UserRagMetrics from './UserRagMetrics';

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
              <Badge bg="success">RAG-Enhanced</Badge>
            </div>
            <p className="text-muted small mt-2 mb-0">
              Monitor the performance of your Retrieval Augmented Generation (RAG) system and user insights
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
                  <RagMetricsPanel />
                </div>
              </Tab>
              <Tab eventKey="user-analytics" title="User Analytics">
                <div className="pt-3">
                  <UserRagMetrics />
                </div>
              </Tab>
              <Tab eventKey="document-analytics" title="Document Analytics">
                <div className="pt-3">
                  <Card className="text-center py-5">
                    <Card.Body>
                      <h4 className="text-muted">Document Analytics Coming Soon</h4>
                      <p className="text-muted">
                        This feature will allow you to analyze document usage and relevance in RAG processes
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