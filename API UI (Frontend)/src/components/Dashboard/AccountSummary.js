// src/components/Dashboard/AccountSummary.js
import React, { useEffect } from 'react';
import { Card, Table } from 'react-bootstrap';
import logger from '../../utils/logger';

const AccountSummary = ({ data }) => {
  const { accounts } = data;
  
  useEffect(() => {
    try {
      if (!accounts || accounts.length === 0) {
        logger.warn('No accounts found in AccountSummary');
        return;
      }
      
      logger.info('Rendering Account Summary', {
        totalAccounts: accounts.length,
        accountTypes: accounts.map(a => a.type)
      });
    } catch (error) {
      logger.logError('AccountSummary Logging', error);
    }
  }, [accounts]);
  
  if (!accounts || accounts.length === 0) {
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
  
  return (
    <Card>
      <Card.Header>Accounts</Card.Header>
      <Card.Body className="p-0">
        <Table striped hover responsive className="mb-0">
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              try {
                return (
                  <tr key={account.accountId}>
                    <td>{account.name || account.type}</td>
                    <td>{account.type}</td>
                    <td className={account.balance < 0 ? 'text-danger' : 'text-dark'}>
                      {formatCurrency(account.balance)}
                    </td>
                  </tr>
                );
              } catch (error) {
                logger.logError(`Account Rendering Error for ${account.accountId}`, error);
                return null;
              }
            }).filter(Boolean)}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default AccountSummary;