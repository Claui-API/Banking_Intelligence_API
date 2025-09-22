// src/components/Layout/PrivateRoute.js
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner, Alert } from 'react-bootstrap';

const PrivateRoute = () => {
  const { isAuthenticated, isLoading, clientStatus, isAdmin } = useAuth();
  const location = useLocation();

  // Check if trying to access bank dashboard routes
  const isBankRoute = location.pathname.startsWith('/bank-dashboard');

  // Only allow active clients who are not admins to access bank routes
  const canAccessBankRoutes = isAuthenticated && clientStatus === 'active' && !isAdmin;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block access to bank routes if not an active client
  if (isBankRoute && !canAccessBankRoutes) {
    // If user has a pending or suspended client, show a message before redirecting
    if (clientStatus === 'pending' || clientStatus === 'suspended') {
      // This could be replaced with a more user-friendly page/component
      return (
        <div className="container mt-5">
          <Alert variant={clientStatus === 'pending' ? 'warning' : 'danger'}>
            <Alert.Heading>Access Restricted</Alert.Heading>
            {clientStatus === 'pending' ? (
              <p>Your client account is pending approval. You will be able to access the Bank Dashboard once approved.</p>
            ) : (
              <p>Your client account has been suspended. Please contact support for assistance.</p>
            )}
          </Alert>
          <div className="text-center mt-4">
            <button
              className="btn btn-primary"
              onClick={() => window.location.href = '/dashboard'}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    // For other cases (admin users or users without a client), just redirect
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise, render the protected route
  return <Outlet />;
};

export default PrivateRoute;