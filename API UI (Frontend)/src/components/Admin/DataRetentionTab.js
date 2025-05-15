// src/components/Admin/DataRetentionTab.js - With Fixed Policy Overview
import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Badge, Alert, Spinner, Tabs, Tab, Row, Col, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import logger from '../../utils/logger';

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		logger.error('Error in component:', error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<Alert variant="danger">
					<h5>Something went wrong in {this.props.section || 'this component'}</h5>
					<p>Please try refreshing the page. If the problem persists, contact support.</p>
					<details className="mt-2">
						<summary>Technical details</summary>
						<pre className="mt-2 p-2 bg-light">{this.state.error?.toString()}</pre>
					</details>
					<Button
						variant="outline-primary"
						size="sm"
						onClick={() => window.location.reload()}
						className="mt-2"
					>
						Refresh Page
					</Button>
				</Alert>
			);
		}

		return this.props.children;
	}
}

/**
 * Data Retention Administration Tab for the Admin Dashboard
 */
const DataRetentionTab = () => {
	const navigate = useNavigate();

	// State for policy stats
	const [policyStats, setPolicyStats] = useState(null);
	const [loadingStats, setLoadingStats] = useState(true);

	// State for marked for deletion accounts
	const [markedAccounts, setMarkedAccounts] = useState([]);
	const [loadingMarked, setLoadingMarked] = useState(true);

	// State for audit logs
	const [retentionLogs, setRetentionLogs] = useState([]);
	const [loadingLogs, setLoadingLogs] = useState(true);

	// State for the active inner tab
	const [activeInnerTab, setActiveInnerTab] = useState('overview');

	// State for error/success messages
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	// State for action confirmations
	const [showReactivateModal, setShowReactivateModal] = useState(false);
	const [showForceDeleteModal, setShowForceDeleteModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
	const [deleteReason, setDeleteReason] = useState('');
	const [deleteConfirmation, setDeleteConfirmation] = useState('');
	const [actionLoading, setActionLoading] = useState(false);

	// Safely fetch data from API
	const fetchData = async (endpoint, setLoading, setData, errorMessage) => {
		try {
			setLoading(true);
			const response = await api.get(endpoint);

			if (response.data && response.data.success) {
				// Extract the right data shape depending on the endpoint
				if (endpoint.endsWith('/stats')) {
					setData(response.data.data);
				} else if (endpoint.includes('marked-for-deletion')) {
					setData(response.data.data?.accounts || []);
				} else if (endpoint.includes('logs')) {
					setData(response.data.data?.logs || []);
				} else {
					setData(response.data.data);
				}
			} else {
				// Don't throw here, just log the error
				logger.warn(`API returned error for ${endpoint}:`, response.data);
			}
		} catch (err) {
			logger.error(`Error fetching from ${endpoint}:`, err);
			// Don't set errors directly to avoid UI disruptions
		} finally {
			setLoading(false);
		}
	};

	// Initialize component
	useEffect(() => {
		// Fetch initial data
		logger.info('Initializing Data Retention Tab');

		const fetchInitialData = async () => {
			try {
				// Fetch policy stats first
				await fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats, 'Failed to load policy stats');

				// Then fetch accounts marked for deletion
				await fetchData('/admin/retention/marked-for-deletion', setLoadingMarked, setMarkedAccounts, 'Failed to load marked accounts');

				// Then fetch retention logs
				await fetchData('/admin/retention/logs', setLoadingLogs, setRetentionLogs, 'Failed to load retention logs');
			} catch (err) {
				// Log the error but don't disrupt the UI
				logger.error('Error initializing data retention tab:', err);
			}
		};

		fetchInitialData();
	}, []);

	// Format date for display
	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		try {
			return new Date(dateString).toLocaleString();
		} catch (error) {
			return 'Invalid Date';
		}
	};

	// Handle reactivation of an account
	const handleReactivateAccount = async () => {
		if (!selectedUser) return;

		try {
			setActionLoading(true);

			const response = await api.put(`/admin/retention/users/${selectedUser.id}`, {
				status: 'active'
			});

			if (response.data && response.data.success) {
				// Remove from marked accounts list
				setMarkedAccounts(prev => prev.filter(account => account.id !== selectedUser.id));

				setSuccess(`Account for ${selectedUser.email} has been reactivated`);
				setShowReactivateModal(false);

				// Refresh policy stats
				fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats);
			} else {
				throw new Error(response.data?.message || 'Failed to reactivate account');
			}
		} catch (err) {
			logger.error('Failed to reactivate account:', err);
			setError(`Failed to reactivate account: ${err.message}`);
		} finally {
			setActionLoading(false);
			setSelectedUser(null);
		}
	};

	// Handle force delete of an account
	const handleForceDelete = async () => {
		if (!selectedUser || deleteConfirmation !== 'CONFIRM_PERMANENT_DELETION' || !deleteReason) return;

		try {
			setActionLoading(true);

			const response = await api({
				method: 'delete',
				url: `/admin/retention/users/${selectedUser.id}/force`,
				data: {
					confirmDeletion: deleteConfirmation,
					deletionReason: deleteReason
				}
			});
			console.log('Sending deletion request:', {
				confirmDeletion: deleteConfirmation,
				deletionReason: deleteReason,
				url: `/admin/retention/users/${selectedUser.id}/force`
			});

			if (response.data && response.data.success) {
				// Remove from marked accounts list
				setMarkedAccounts(prev => prev.filter(account => account.id !== selectedUser.id));

				setSuccess(`Account for ${selectedUser.email} has been permanently deleted`);
				setShowForceDeleteModal(false);

				// Refresh policy stats
				fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats);
			} else {
				throw new Error(response.data?.message || 'Failed to delete account');
			}
		} catch (err) {
			logger.error('Failed to delete account:', err);
			setError(`Failed to delete account: ${err.message}`);
		} finally {
			setActionLoading(false);
			setSelectedUser(null);
			setDeleteConfirmation('');
			setDeleteReason('');
		}
	};

	// Run manual retention audit
	const handleRunManualAudit = async () => {
		try {
			setLoadingStats(true);
			setError('');
			setSuccess('');

			const response = await api.post('/admin/retention/audit');

			if (response.data && response.data.success) {
				setSuccess('Retention policy audit completed successfully');
				// Refresh the stats
				fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats);
			} else {
				throw new Error(response.data?.message || 'Failed to run retention audit');
			}
		} catch (err) {
			logger.error('Failed to run retention audit:', err);
			setError(`Failed to run retention audit: ${err.message}`);
		} finally {
			setLoadingStats(false);
		}
	};

	// Run manual data cleanup
	const handleRunManualCleanup = async () => {
		try {
			setLoadingStats(true);
			setError('');
			setSuccess('');

			const response = await api.post('/v1/data/retention/cleanup');

			if (response.data && response.data.success) {
				setSuccess('Manual data retention cleanup completed successfully');
				// Refresh everything
				fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats);
				fetchData('/admin/retention/marked-for-deletion', setLoadingMarked, setMarkedAccounts);
				fetchData('/admin/retention/logs', setLoadingLogs, setRetentionLogs);
			} else {
				throw new Error(response.data?.message || 'Failed to run manual cleanup');
			}
		} catch (err) {
			logger.error('Failed to run manual cleanup:', err);
			setError(`Failed to run manual cleanup: ${err.message}`);
		} finally {
			setLoadingStats(false);
		}
	};

	// Render the overview tab content - FIXED VERSION
	const renderOverview = () => {
		// If loading, show spinner
		if (loadingStats) {
			return (
				<div className="text-center py-5">
					<Spinner animation="border" variant="success" />
					<p className="mt-3 text-white">Loading retention policy statistics...</p>
				</div>
			);
		}

		// If no data, show placeholder
		if (!policyStats) {
			return (
				<Card>
					<Card.Body>
						<Alert variant="info">
							<Alert.Heading>Policy Statistics Not Available</Alert.Heading>
							<p>
								Data retention policy statistics could not be loaded. This could be because:
							</p>
							<ul>
								<li>The backend API is still being set up</li>
								<li>The required database tables have not been created yet</li>
								<li>There was a temporary network issue</li>
							</ul>
							<div className="mt-3">
								<Button variant="outline-primary" onClick={() => fetchData('/admin/retention/stats', setLoadingStats, setPolicyStats)}>
									Refresh Data
								</Button>
							</div>
						</Alert>
					</Card.Body>
				</Card>
			);
		}

		// Safely access data with fallbacks
		const safeStats = {
			markedForDeletion: policyStats.markedForDeletion || 0,
			disconnectedPlaidItems: policyStats.disconnectedPlaidItems || 0,
			expiredTokens: policyStats.tokens?.expired || 0,
			retentionLogs: policyStats.retentionLogs || 0,
			inactiveUsers: policyStats.inactiveUsers || 0,
			recentActions: policyStats.recentActions || {}
		};

		// Render data cards
		return (
			<>
				<Row className="mb-4">
					<Col lg={3} md={6} className="mb-3">
						<Card className="h-100 bg-dark text-white">
							<Card.Body className="text-center">
								<div className="display-4 text-success">{safeStats.markedForDeletion}</div>
								<p className="mb-0">Accounts Pending Deletion</p>
							</Card.Body>
						</Card>
					</Col>
					<Col lg={3} md={6} className="mb-3">
						<Card className="h-100 bg-dark text-white">
							<Card.Body className="text-center">
								<div className="display-4 text-success">{safeStats.disconnectedPlaidItems}</div>
								<p className="mb-0">Disconnected Bank Accounts</p>
							</Card.Body>
						</Card>
					</Col>
					<Col lg={3} md={6} className="mb-3">
						<Card className="h-100 bg-dark text-white">
							<Card.Body className="text-center">
								<div className="display-4 text-success">{safeStats.expiredTokens}</div>
								<p className="mb-0">Expired Tokens</p>
							</Card.Body>
						</Card>
					</Col>
					<Col lg={3} md={6} className="mb-3">
						<Card className="h-100 bg-dark text-white">
							<Card.Body className="text-center">
								<div className="display-4 text-success">{safeStats.retentionLogs}</div>
								<p className="mb-0">Retention Events</p>
							</Card.Body>
						</Card>
					</Col>
				</Row>

				<Card className="mb-4">
					<Card.Header className="bg-white d-flex justify-content-between align-items-center">
						<span>Retention Policy Compliance</span>
						<div>
							<Button
								variant="outline-primary"
								size="sm"
								className="me-2"
								onClick={handleRunManualAudit}
								disabled={loadingStats}
							>
								{loadingStats ? (
									<>
										<Spinner animation="border" size="sm" className="me-1" />
										Running Audit...
									</>
								) : (
									<>Run Audit</>
								)}
							</Button>
							<Button
								variant="outline-success"
								size="sm"
								onClick={handleRunManualCleanup}
								disabled={loadingStats}
							>
								{loadingStats ? (
									<>
										<Spinner animation="border" size="sm" className="me-1" />
										Processing...
									</>
								) : (
									<>Run Cleanup</>
								)}
							</Button>
						</div>
					</Card.Header>
					<Card.Body>
						<Row>
							<Col md={6} className="mb-3">
								<h5 className="mb-3 text-black">Data awaiting cleanup</h5>
								<Table striped bordered hover className="table-light">
									<thead>
										<tr>
											<th>Data Type</th>
											<th>Count</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td>Expired Tokens</td>
											<td>{safeStats.expiredTokens}</td>
										</tr>
										<tr>
											<td>Inactive Accounts</td>
											<td>{safeStats.inactiveUsers}</td>
										</tr>
										<tr>
											<td>Disconnected Plaid Items</td>
											<td>{safeStats.disconnectedPlaidItems}</td>
										</tr>
									</tbody>
								</Table>
							</Col>

							<Col md={6}>
								<h5 className="mb-3 text-black">Recent Retention Actions</h5>
								{Object.keys(safeStats.recentActions).length > 0 ? (
									<Table striped bordered hover className="table-light">
										<thead>
											<tr>
												<th>Action</th>
												<th>Count (last 30 days)</th>
											</tr>
										</thead>
										<tbody>
											{Object.entries(safeStats.recentActions).map(([action, count], index) => (
												<tr key={index}>
													<td>{action.replace(/_/g, ' ')}</td>
													<td>{count}</td>
												</tr>
											))}
										</tbody>
									</Table>
								) : (
									<Alert variant="info">No recent retention actions found</Alert>
								)}
							</Col>
						</Row>
					</Card.Body>
				</Card>
			</>
		);
	};

	// Render the account deletion tab
	const renderDeletionTab = () => {
		// If loading, show spinner
		if (loadingMarked) {
			return (
				<div className="text-center py-5">
					<Spinner animation="border" variant="success" />
					<p className="mt-3">Loading accounts marked for deletion...</p>
				</div>
			);
		}

		// Render account deletion card
		return (
			<Card>
				<Card.Header>Accounts Marked for Deletion</Card.Header>
				<Card.Body>
					{Array.isArray(markedAccounts) && markedAccounts.length > 0 ? (
						<Table striped bordered hover responsive className="table-light">
							<thead>
								<tr>
									<th>User</th>
									<th>Status</th>
									<th>Marked Date</th>
									<th>Scheduled Deletion</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{markedAccounts.map((account, index) => (
									<tr key={account.id || index}>
										<td>
											<div>
												<div className="fw-bold">{account.clientName || 'Unknown'}</div>
												<small>{account.email || 'No email'}</small>
											</div>
										</td>
										<td>
											<Badge bg={account.status === 'active' ? 'success' : 'warning'}>
												{account.status || 'Unknown'}
											</Badge>
										</td>
										<td>{formatDate(account.markedForDeletionAt)}</td>
										<td>{formatDate(account.scheduledDeletionDate)}</td>
										<td>
											<div className="d-flex gap-2">
												<Button
													variant="success"
													size="sm"
													onClick={() => {
														setSelectedUser(account);
														setShowReactivateModal(true);
													}}
												>
													Reactivate
												</Button>
												<Button
													variant="danger"
													size="sm"
													onClick={() => {
														setSelectedUser(account);
														setShowForceDeleteModal(true);
													}}
												>
													Force Delete
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					) : (
						<Alert variant="info">No accounts are currently marked for deletion</Alert>
					)}
				</Card.Body>
			</Card>
		);
	};

	// Render the logs tab
	const renderLogsTab = () => {
		// If loading, show spinner
		if (loadingLogs) {
			return (
				<div className="text-center py-5">
					<Spinner animation="border" variant="success" />
					<p className="mt-3">Loading retention logs...</p>
				</div>
			);
		}

		// Render logs
		return (
			<Card>
				<Card.Header>Data Retention Logs</Card.Header>
				<Card.Body>
					{Array.isArray(retentionLogs) && retentionLogs.length > 0 ? (
						<Table striped bordered hover responsive className="table-light">
							<thead>
								<tr>
									<th>Timestamp</th>
									<th>Action</th>
									<th>Details</th>
								</tr>
							</thead>
							<tbody>
								{retentionLogs.map((log, index) => (
									<tr key={log.id || index}>
										<td className="text-nowrap">{formatDate(log.timestamp)}</td>
										<td>{String(log.action || '').replace(/_/g, ' ')}</td>
										<td>
											<code className="d-block" style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
												{typeof log.details === 'object'
													? JSON.stringify(log.details || {}, null, 2)
													: String(log.details || 'No details')}
											</code>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					) : (
						<Alert variant="info">No retention logs found</Alert>
					)}
				</Card.Body>
			</Card>
		);
	};

	return (
		<>
			{error && (
				<Alert variant="danger" dismissible onClose={() => setError('')}>
					<i className="bi bi-exclamation-triangle-fill me-2"></i>
					{error}
				</Alert>
			)}

			{success && (
				<Alert variant="success" dismissible onClose={() => setSuccess('')}>
					<i className="bi bi-check-circle-fill me-2"></i>
					{success}
				</Alert>
			)}

			<Tabs
				activeKey={activeInnerTab}
				onSelect={setActiveInnerTab}
				className="mb-4"
			>
				<Tab eventKey="overview" title="Policy Overview">
					<ErrorBoundary section="Policy Overview">
						{renderOverview()}
					</ErrorBoundary>
				</Tab>
				<Tab eventKey="deletions" title="Account Deletions">
					<ErrorBoundary section="Account Deletions">
						{renderDeletionTab()}
					</ErrorBoundary>
				</Tab>
				<Tab eventKey="logs" title="Retention Logs">
					<ErrorBoundary section="Retention Logs">
						{renderLogsTab()}
					</ErrorBoundary>
				</Tab>
			</Tabs>

			{/* Reactivate Account Modal */}
			<Modal show={showReactivateModal} onHide={() => setShowReactivateModal(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Reactivate Account</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{selectedUser && (
						<>
							<p>
								Are you sure you want to reactivate the account for:
							</p>
							<p className="fw-bold">{selectedUser.email}</p>
							<p>
								This will cancel the scheduled deletion and restore full access to the account.
							</p>
						</>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowReactivateModal(false)} disabled={actionLoading}>
						Cancel
					</Button>
					<Button
						variant="success"
						onClick={handleReactivateAccount}
						disabled={actionLoading}
					>
						{actionLoading ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Reactivating...
							</>
						) : 'Reactivate Account'}
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Force Delete Modal */}
			<Modal show={showForceDeleteModal} onHide={() => setShowForceDeleteModal(false)}>
				<Modal.Header closeButton>
					<Modal.Title className="text-danger">Force Delete Account</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{selectedUser && (
						<>
							<Alert variant="danger">
								<i className="bi bi-exclamation-triangle-fill me-2"></i>
								<strong>Warning: This action is immediate and irreversible!</strong>
							</Alert>

							<p>
								You are about to permanently delete the account for:
							</p>
							<p className="fw-bold">{selectedUser.email}</p>

							<p>
								All associated data will be immediately deleted, including:
							</p>
							<ul>
								<li>User profile and authentication information</li>
								<li>API clients and tokens</li>
								<li>Plaid connections and financial data</li>
								<li>Generated insights and usage history</li>
							</ul>

							<Form.Group className="mb-3">
								<Form.Label><strong>Deletion reason (required):</strong></Form.Label>
								<Form.Control
									as="textarea"
									rows={3}
									value={deleteReason}
									onChange={(e) => setDeleteReason(e.target.value)}
									placeholder="Provide a detailed reason for this deletion..."
									required
								/>
								<Form.Text className={`${deleteReason.length < 10 ? "text-danger" : "text-muted"}`}>
									Deletion reason must be at least 10 characters long.
									Currently: {deleteReason.length}/10 characters
								</Form.Text>
								<Form.Text className="text-muted">
									This reason will be permanently recorded in the admin logs.
								</Form.Text>
							</Form.Group>

							<Form.Group className="mb-3">
								<Form.Label><strong>Type CONFIRM_PERMANENT_DELETION to confirm:</strong></Form.Label>
								<Form.Control
									type="text"
									value={deleteConfirmation}
									onChange={(e) => setDeleteConfirmation(e.target.value)}
									placeholder="CONFIRM_PERMANENT_DELETION"
									required
								/>
							</Form.Group>
						</>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowForceDeleteModal(false)} disabled={actionLoading}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleForceDelete}
						disabled={
							actionLoading ||
							!deleteReason ||
							deleteReason.length < 10 ||
							deleteConfirmation !== 'CONFIRM_PERMANENT_DELETION'
						}
					>
						{actionLoading ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Deleting...
							</>
						) : 'Force Delete Account'}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default DataRetentionTab;