// src/components/Dashboard/RecentTransactions.js
import React, { useEffect } from 'react';
import { Card, Table } from 'react-bootstrap';
import logger from '../../utils/logger';

const RecentTransactions = ({ transactions }) => {
  useEffect(() => {
    try {
      if (!transactions || transactions.length === 0) {
        logger.warn('No transactions found in RecentTransactions');
        return;
      }
      
      logger.info('Rendering Recent Transactions', {
        totalTransactions: transactions.length,
        transactionCategories: [...new Set(transactions.map(t => t.category))]
      });
    } catch (error) {
      logger.logError('RecentTransactions Logging', error);
    }
  }, [transactions]);
  
  if (!transactions || transactions.length === 0) {
    return null;
  }
  
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
  
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      logger.logError('Date Formatting', error);
      return dateString;
    }
  };
  
  return (
    <Card>
      <Card.Header>Recent Transactions</Card.Header>
      <Card.Body className="p-0">
        <Table striped hover responsive className="mb-0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              try {
                return (
                  <tr key={transaction.transactionId}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.category}</td>
                    <td className={transaction.amount < 0 ? 'text-danger' : 'text-success'}>
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                );
              } catch (error) {
                logger.logError(`Transaction Rendering Error for ${transaction.transactionId}`, error);
                return null;
              }
            }).filter(Boolean)}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default RecentTransactions;