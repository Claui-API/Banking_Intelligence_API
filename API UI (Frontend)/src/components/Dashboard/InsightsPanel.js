// src/components/Dashboard/InsightsPanel.js with request ID tracking
import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, InputGroup, Alert, Spinner } from 'react-bootstrap';
import logger from '../../utils/logger';

const InsightsPanel = ({ insightsData, onInsightRequest, loading, error }) => {
  const [query, setQuery] = useState('');
  // Add a ref to track the latest request ID
  const latestRequestIdRef = useRef(null);
  // Add state to store the currently displayed insight
  const [currentInsight, setCurrentInsight] = useState(null);
  
  // Generate a unique request ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };
  
  // Log insights data when it changes to help with debugging
  useEffect(() => {
    if (insightsData) {
      logger.info('Insights data received in panel:', {
        hasInsight: !!insightsData.insights,
        timestamp: insightsData.timestamp,
        requestId: insightsData.requestId // We'll add this to the insights data
      });
      
      // Only update the current insight if this response matches the latest request
      // or if this is the first insight we're receiving
      if (!latestRequestIdRef.current || insightsData.requestId === latestRequestIdRef.current) {
        setCurrentInsight(insightsData);
        logger.info('Updated displayed insight with latest data', {
          requestId: insightsData.requestId
        });
      } else {
        logger.info('Ignoring outdated insight response', {
          received: insightsData.requestId,
          expected: latestRequestIdRef.current
        });
      }
    }
  }, [insightsData]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      try {
        // Generate a new request ID for this query
        const requestId = generateRequestId();
        latestRequestIdRef.current = requestId;
        
        logger.info(`Insight query submitted: ${query}`, {
          requestId: requestId
        });
        
        // Pass the request ID along with the query
        onInsightRequest(query, requestId);
      } catch (error) {
        logger.logError('Insight Request Submission', error);
      }
    }
  };
  
  // Format insight text to handle markdown-style formatting
  const formatInsight = (text) => {
    if (!text) return '';
    
    try {
      // Replace ** bold ** with actual bold text
      const boldFormatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Handle line breaks
      const withLineBreaks = boldFormatted
        .replace(/\n\n/g, '<br /><br />')
        .replace(/\n/g, '<br />');
      
      // Handle bullet points
      const withBullets = withLineBreaks.replace(/- (.*?)(<br \/>|$)/g, '<li>$1</li>');
      
      // Wrap bullet points in ul if they exist
      const finalText = withBullets.includes('<li>') 
        ? withBullets.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>') 
        : withBullets;
      
      return finalText;
    } catch (formatError) {
      logger.logError('Insight Formatting', formatError);
      return text;
    }
  };
  
  // Extract insight text from various possible formats
  const getInsightText = () => {
    if (!currentInsight || !currentInsight.insights) return '';
    
    // Try different possible formats
    if (typeof currentInsight.insights === 'string') {
      return currentInsight.insights;
    }
    
    if (currentInsight.insights.insight) {
      return currentInsight.insights.insight;
    }
    
    if (currentInsight.insights.text) {
      return currentInsight.insights.text;
    }
    
    // Last resort: stringify the object
    return JSON.stringify(currentInsight.insights);
  };
  
  const suggestedQuestions = [
    "How is my spending compared to last month?",
    "Where am I spending the most money?",
    "How can I improve my financial health?",
    "Am I on track for my savings goals?"
  ];
  
  const handleSuggestedQuestion = (suggestion) => {
    try {
      // Generate a new request ID for the suggested question
      const requestId = generateRequestId();
      latestRequestIdRef.current = requestId;
      
      logger.info(`Selected suggested insight: ${suggestion}`, {
        requestId: requestId
      });
      
      setQuery(suggestion);
      onInsightRequest(suggestion, requestId);
    } catch (error) {
      logger.logError('Suggested Question Handling', error);
    }
  };
  
  return (
    <Card>
      <Card.Header>Financial Insights</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit} className="mb-4">
          <Form.Label>Ask about your finances</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., How is my spending this month?"
            />
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading || !query.trim()}
            >
              Ask
            </Button>
          </InputGroup>
        </Form>
        
        <Card bg="light" className="mb-3">
          <Card.Body>
            {loading ? (
              <div className="text-center p-4">
                <Spinner animation="border" size="sm" className="me-2" />
                <span className="text-muted">Generating insights...</span>
              </div>
            ) : error && !currentInsight ? (
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error || "Unable to generate insights. Please try again later."}
              </Alert>
            ) : currentInsight ? (
              <>
                <div className="text-muted small mb-2">
                  {new Date(currentInsight.timestamp).toLocaleString()}
                </div>
                <div 
                  className="insights-content"
                  dangerouslySetInnerHTML={{ __html: formatInsight(getInsightText()) }}
                />
              </>
            ) : (
              <div className="text-center text-muted p-4">
                <i className="bi bi-lightbulb me-2"></i>
                Ask a question about your finances to get personalized insights.
              </div>
            )}
          </Card.Body>
        </Card>
        
        <div>
          <h6 className="text-muted mb-3">Suggested questions:</h6>
          <div className="d-grid gap-2">
            {suggestedQuestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline-secondary"
                size="sm"
                className="text-start"
                onClick={() => handleSuggestedQuestion(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default InsightsPanel;