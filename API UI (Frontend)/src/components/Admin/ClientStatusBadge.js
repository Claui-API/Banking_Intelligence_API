import React from 'react';
import { Badge } from 'react-bootstrap';

const ClientStatusBadge = ({ status }) => {
  const getVariant = () => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'danger';
      case 'revoked':
        return 'dark';
      default:
        return 'secondary';
    }
  };
  
  const getTextClass = () => {
    return status === 'revoked' ? 'text-white' : '';
  };
  
  return (
    <Badge 
      bg={getVariant()} 
      className={`text-capitalize ${getTextClass()}`}
    >
      {status}
    </Badge>
  );
};

export default ClientStatusBadge;