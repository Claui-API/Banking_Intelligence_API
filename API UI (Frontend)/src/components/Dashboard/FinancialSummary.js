// src/components/Dashboard/FinancialSummary.js
import React, { useEffect } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import logger from '../../utils/logger';

const FinancialSummary = ({ data }) => {
  const { totalBalance, netWorth } = data;
  
  useEffect(() => {
    try {
      logger.info('Rendering Financial Summary', {
        totalBalance,
        netWorth
      });
    } catch (error) {
      logger.logError('FinancialSummary Logging', error);
    }
  }, [totalBalance, netWorth]);
  
  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    } catch (error) {
      logger.logError('Currency Formatting', error);
      return amount.toString();
    }
  };
  
  return (
    <Card>
      <Card.Header>Financial Overview</Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <div className="bg-light p-3 rounded">
              <div className="text-muted small mb-2">Total Balance</div>
              <div className="h4">
                {formatCurrency(totalBalance)}
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="bg-light p-3 rounded">
              <div className="text-muted small mb-2">Net Worth</div>
              <div className="h4">
                {formatCurrency(netWorth)}
              </div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default FinancialSummary;