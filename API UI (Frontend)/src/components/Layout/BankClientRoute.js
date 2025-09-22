// src/components/Layout/BankClientRoute.js
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Alert, Button, Spinner } from 'react-bootstrap';

/**
 * Specialized route component for bank client dashboard
 * Only allows access to users with an active client status who are not admins
 */
const BankClientRoute = () => {
	const { isAuthenticated, isLoading, clientStatus, isAdmin, user } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<Container className="d-flex justify-content-center align-items-center vh-100">
				<Spinner animation="border" role="status">
					<span className="visually-hidden">Loading...</span>
				</Spinner>
			</Container>
		);
	}

	// Redirect to login if not authenticated
	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	// Redirect admin users to admin dashboard
	if (isAdmin) {
		return <Navigate to="/admin" replace />;
	}

	// Handle different client statuses
	switch (clientStatus) {
		case 'active':
			// Allow access to bank dashboard for active clients
			return <Outlet />;

		case 'pending':
			// Show pending approval message
			return (
				<Container className="py-5">
					<Alert variant="warning">
						<Alert.Heading>Client Account Pending Approval</Alert.Heading>
						<p>
							Your client account is currently awaiting approval. You will be able to
							access the Bank Dashboard once your account has been approved by an administrator.
						</p>
						<p>
							This typically takes 1-2 business days. You will be notified by email
							when your account has been approved.
						</p>
						<hr />
						<p className="mb-0">
							Client ID: {user?.clientId}
						</p>
					</Alert>
					<div className="text-center mt-4">
						<Button
							variant="primary"
							onClick={() => window.location.href = '/dashboard'}
						>
							Return to Dashboard
						</Button>
					</div>
				</Container>
			);

		case 'suspended':
			// Show suspended account message
			return (
				<Container className="py-5">
					<Alert variant="danger">
						<Alert.Heading>Client Account Suspended</Alert.Heading>
						<p>
							Your client account has been suspended. You cannot access the Bank Dashboard
							while your account is suspended.
						</p>
						<p>
							Please contact our support team for assistance regarding your account status.
						</p>
						<hr />
						<p className="mb-0">
							Client ID: {user?.clientId}
						</p>
					</Alert>
					<div className="text-center mt-4">
						<Button
							variant="primary"
							onClick={() => window.location.href = '/dashboard'}
						>
							Return to Dashboard
						</Button>
					</div>
				</Container>
			);

		case 'revoked':
			// Show revoked account message
			return (
				<Container className="py-5">
					<Alert variant="danger">
						<Alert.Heading>Client Account Revoked</Alert.Heading>
						<p>
							Your client account has been revoked. You cannot access the Bank Dashboard
							as your client privileges have been revoked.
						</p>
						<p>
							Please contact our support team if you believe this is an error.
						</p>
						<hr />
						<p className="mb-0">
							Client ID: {user?.clientId}
						</p>
					</Alert>
					<div className="text-center mt-4">
						<Button
							variant="primary"
							onClick={() => window.location.href = '/dashboard'}
						>
							Return to Dashboard
						</Button>
					</div>
				</Container>
			);

		default:
			// For unknown status or users without a client, redirect to dashboard
			return <Navigate to="/dashboard" replace />;
	}
};

export default BankClientRoute;