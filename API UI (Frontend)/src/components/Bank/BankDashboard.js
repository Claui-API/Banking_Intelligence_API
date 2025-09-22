import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Spinner, Badge, Nav, Form, Alert, Modal, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { apiClient, bankClientApi, bankingCommandApi } from '../../services/api-client';
import logger from '../../utils/logger';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Status badge component
const BankUserStatusBadge = ({ status }) => {
	const getVariant = () => {
		switch (status) {
			case 'active': return 'success';
			case 'inactive': return 'secondary';
			case 'suspended': return 'warning';
			default: return 'light';
		}
	};

	return (
		<Badge bg={getVariant()}>{status}</Badge>
	);
};

// Account type badge component
const AccountTypeBadge = ({ type }) => {
	const getVariant = () => {
		switch (type?.toLowerCase()) {
			case 'checking': return 'primary';
			case 'savings': return 'success';
			case 'credit': return 'danger';
			case 'investment': return 'info';
			case 'loan': return 'warning';
			default: return 'secondary';
		}
	};

	return (
		<Badge bg={getVariant()}>{type || 'Other'}</Badge>
	);
};

// Report Section Component
const ReportSection = ({ section }) => {
	if (!section) return null;

	return (
		<Card className="mb-3">
			<Card.Header>{section.title}</Card.Header>
			<Card.Body>
				<pre className="report-content mb-0">{section.content}</pre>

				{section.id === 'accountSummary' && section.metrics && (
					<div className="mt-3 p-2 bg-light rounded">
						<h6>Key Metrics:</h6>
						<Row>
							<Col xs={6} md={4}>
								<small className="text-muted">Total Balance</small>
								<p className="mb-1">{formatCurrency(section.metrics.totalBalance)}</p>
							</Col>
							<Col xs={6} md={4}>
								<small className="text-muted">Income</small>
								<p className="mb-1">{formatCurrency(section.metrics.income)}</p>
							</Col>
							<Col xs={6} md={4}>
								<small className="text-muted">Expenses</small>
								<p className="mb-1">{formatCurrency(section.metrics.expenses)}</p>
							</Col>
							<Col xs={6} md={4}>
								<small className="text-muted">Net Change</small>
								<p className="mb-1">{formatCurrency(section.metrics.netChange)}</p>
							</Col>
							<Col xs={6} md={4}>
								<small className="text-muted">Daily Average</small>
								<p className="mb-1">{formatCurrency(section.metrics.averageDailySpend)}/day</p>
							</Col>
						</Row>
					</div>
				)}

				{section.id === 'behaviorPreferences' && section.categories && (
					<div className="mt-3">
						<h6>Top Categories:</h6>
						<Table striped bordered hover variant="light" size="sm">
							<thead>
								<tr>
									<th>Category</th>
									<th>Count</th>
									<th>Total</th>
									<th>Percent</th>
								</tr>
							</thead>
							<tbody>
								{section.categories.map((cat, index) => (
									<tr key={index}>
										<td>{cat.name}</td>
										<td>{cat.count}</td>
										<td>{formatCurrency(cat.total)}</td>
										<td>{cat.percent.toFixed(1)}%</td>
									</tr>
								))}
							</tbody>
						</Table>
					</div>
				)}
			</Card.Body>
		</Card>
	);
};

const BankDashboard = () => {
	const navigate = useNavigate();

	// State management
	const [activeTab, setActiveTab] = useState('overview');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [stats, setStats] = useState(null);
	const [bankUsers, setBankUsers] = useState([]);
	const [selectedUser, setSelectedUser] = useState(null);
	const [userAccounts, setUserAccounts] = useState([]);
	const [userTransactions, setUserTransactions] = useState([]);
	const [transactionFilters, setTransactionFilters] = useState({
		startDate: '',
		endDate: '',
		accountId: '',
		type: ''
	});
	const [dateRange, setDateRange] = useState('7'); // Default to 7 days
	const [activityData, setActivityData] = useState([]);

	// Report state
	const [showReportModal, setShowReportModal] = useState(false);
	const [reportLoading, setReportLoading] = useState(false);
	const [reportData, setReportData] = useState(null);
	const [reportError, setReportError] = useState(null);
	const [reportOptions, setReportOptions] = useState({
		timeframe: '30d',
		includeDetailed: true,
		format: 'json'
	});

	// Bulk report state
	const [showBulkReportModal, setShowBulkReportModal] = useState(false);
	const [bulkReportLoading, setBulkReportLoading] = useState(false);
	const [bulkReportResults, setBulkReportResults] = useState(null);
	const [bulkReportError, setBulkReportError] = useState(null);
	const [selectedUsers, setSelectedUsers] = useState([]);
	const [bulkReportOptions, setBulkReportOptions] = useState({
		timeframe: '30d',
		includeDetailed: true
	});

	// Fetch client stats
	const fetchStats = async () => {
		try {
			console.log('Fetching stats...');
			const response = await apiClient.get('/bank-client/stats');
			console.log('Stats response:', response.data);

			if (response.data && response.data.success) {
				setStats(response.data.data);
			} else {
				console.error('Invalid stats response format:', response.data);
				setError('Failed to load dashboard statistics. Invalid response format.');
			}
		} catch (err) {
			console.error('Failed to fetch bank stats:', err);
			setError('Failed to load dashboard statistics. Please try again later.');
		}
	};

	// Fetch bank users
	const fetchBankUsers = async () => {
		try {
			const response = await apiClient.get('/bank-client/users');
			setBankUsers(response.data.data || []);
		} catch (err) {
			logger.error('Failed to fetch bank users:', err);
			setError('Failed to load bank users. Please try again later.');
		}
	};

	// Fetch user accounts
	const fetchUserAccounts = async (bankUserId) => {
		if (!bankUserId) return;
		try {
			const response = await apiClient.get(`/bank-client/users/${bankUserId}/accounts`);
			setUserAccounts(response.data.data || []);
		} catch (err) {
			logger.error(`Failed to fetch accounts for user ${bankUserId}:`, err);
			setError('Failed to load user accounts. Please try again later.');
		}
	};

	// Fetch user transactions with filters
	const fetchUserTransactions = async (bankUserId) => {
		if (!bankUserId) return;
		try {
			let url = `/bank-client/users/${bankUserId}/transactions?`;

			// Add filters to URL
			if (transactionFilters.startDate) {
				url += `&startDate=${transactionFilters.startDate}`;
			}
			if (transactionFilters.endDate) {
				url += `&endDate=${transactionFilters.endDate}`;
			}
			if (transactionFilters.accountId) {
				url += `&accountId=${transactionFilters.accountId}`;
			}
			if (transactionFilters.type) {
				url += `&type=${transactionFilters.type}`;
			}

			const response = await apiClient.get(url);
			setUserTransactions(response.data.data || []);
		} catch (err) {
			logger.error(`Failed to fetch transactions for user ${bankUserId}:`, err);
			setError('Failed to load user transactions. Please try again later.');
		}
	};

	// Fetch activity data
	const fetchActivityData = async () => {
		try {
			// Calculate date range
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(endDate.getDate() - parseInt(dateRange));

			const response = await apiClient.get(`/bank-client/activity?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
			setActivityData(response.data.data || []);
		} catch (err) {
			logger.error('Failed to fetch activity data:', err);
			setError('Failed to load activity data. Please try again later.');
		}
	};

	// Generate a banking report for the selected user
	const generateReport = async () => {
		if (!selectedUser) return;

		setReportLoading(true);
		setReportError(null);
		setReportData(null);

		try {
			const response = await bankingCommandApi.generateReport(
				selectedUser.bankUserId,
				reportOptions
			);

			if (response.success && response.data) {
				setReportData(response.data);
				setShowReportModal(true);
			} else {
				setReportError('Failed to generate report. Invalid response format.');
			}
		} catch (err) {
			logger.error(`Failed to generate report for user ${selectedUser.bankUserId}:`, err);
			setReportError(`Failed to generate report: ${err.message}`);
		} finally {
			setReportLoading(false);
		}
	};

	// Generate PDF report
	const generatePdfReport = async () => {
		if (!selectedUser) return;

		setReportLoading(true);
		setReportError(null);

		try {
			const response = await bankingCommandApi.generatePdfReport(
				selectedUser.bankUserId,
				{
					timeframe: reportOptions.timeframe,
					includeDetailed: reportOptions.includeDetailed
				}
			);

			if (response.success && response.data) {
				// For a real application, this would typically download the PDF or open it in a new tab
				// Since we're mocking this, we'll just show an alert
				alert('PDF report generated successfully. In a production environment, this would download or open the PDF.');
			} else {
				setReportError('Failed to generate PDF report. Invalid response format.');
			}
		} catch (err) {
			logger.error(`Failed to generate PDF report for user ${selectedUser.bankUserId}:`, err);
			setReportError(`Failed to generate PDF report: ${err.message}`);
		} finally {
			setReportLoading(false);
		}
	};

	// Generate bulk reports for selected users
	const generateBulkReports = async () => {
		if (selectedUsers.length === 0) {
			setBulkReportError('Please select at least one user');
			return;
		}

		setBulkReportLoading(true);
		setBulkReportError(null);
		setBulkReportResults(null);

		try {
			const response = await bankingCommandApi.generateBulkReports(
				selectedUsers,
				bulkReportOptions
			);

			if (response.success && response.data) {
				setBulkReportResults(response.data);
			} else {
				setBulkReportError('Failed to generate bulk reports. Invalid response format.');
			}
		} catch (err) {
			logger.error('Failed to generate bulk reports:', err);
			setBulkReportError(`Failed to generate bulk reports: ${err.message}`);
		} finally {
			setBulkReportLoading(false);
		}
	};

	// Toggle user selection for bulk reports
	const toggleUserSelection = (userId) => {
		if (selectedUsers.includes(userId)) {
			setSelectedUsers(selectedUsers.filter(id => id !== userId));
		} else {
			setSelectedUsers([...selectedUsers, userId]);
		}
	};

	// Select all users for bulk reports
	const selectAllUsers = () => {
		if (selectedUsers.length === bankUsers.length) {
			setSelectedUsers([]);
		} else {
			setSelectedUsers(bankUsers.map(user => user.bankUserId));
		}
	};

	// Initial data load
	useEffect(() => {
		const loadDashboardData = async () => {
			setLoading(true);
			setError(null);

			try {
				console.log('Loading dashboard data...');

				// Load each piece of data individually
				await fetchStats();
				await fetchBankUsers();
				await fetchActivityData();

				console.log('Dashboard data loaded successfully');
			} catch (err) {
				console.error('Error loading dashboard data:', err);
				setError('Failed to load dashboard data. Please try again later.');
			} finally {
				setLoading(false);
			}
		};

		loadDashboardData();
	}, []);

	// Load user details when selected
	useEffect(() => {
		if (selectedUser) {
			fetchUserAccounts(selectedUser.bankUserId);
			fetchUserTransactions(selectedUser.bankUserId);
		}
	}, [selectedUser]);

	// Reload activity data when date range changes
	useEffect(() => {
		fetchActivityData();
	}, [dateRange]);

	// Handle user selection
	const handleUserSelect = (user) => {
		setSelectedUser(user);
		setActiveTab('userDetails');
	};

	// Apply transaction filters
	const handleApplyFilters = (e) => {
		e.preventDefault();
		if (selectedUser) {
			fetchUserTransactions(selectedUser.bankUserId);
		}
	};

	// Reset transaction filters
	const handleResetFilters = () => {
		setTransactionFilters({
			startDate: '',
			endDate: '',
			accountId: '',
			type: ''
		});

		if (selectedUser) {
			fetchUserTransactions(selectedUser.bankUserId);
		}
	};

	// Report Modal
	const renderReportModal = () => (
		<Modal show={showReportModal} onHide={() => setShowReportModal(false)} size="lg" backdrop="static">
			<Modal.Header closeButton>
				<Modal.Title>Banking Intelligence Report</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				{reportError && (
					<Alert variant="danger">{reportError}</Alert>
				)}

				{reportLoading ? (
					<div className="text-center p-4">
						<Spinner animation="border" variant="primary" />
						<p className="mt-2">Generating report...</p>
					</div>
				) : reportData ? (
					<div className="report-container">
						<h3 className="mb-3">{reportData.title}</h3>
						<p><strong>Period:</strong> {reportData.period}</p>
						<p><strong>Generated:</strong> {formatDate(reportData.generated)}</p>

						<Tabs defaultActiveKey="sections" id="report-tabs" className="mb-3">
							<Tab eventKey="sections" title="Report Sections">
								{reportData.sections.map((section) => (
									<ReportSection key={section.id} section={section} />
								))}
							</Tab>
							<Tab eventKey="summary" title="Summary">
								<Card>
									<Card.Body>
										<h5>Account Summary</h5>
										{reportData.summary.accountSummary && (
											<Row>
												<Col md={6}>
													<p><strong>Total Balance:</strong> {formatCurrency(reportData.summary.totalBalance)}</p>
													<p><strong>Income:</strong> {formatCurrency(reportData.summary.accountSummary.income)}</p>
													<p><strong>Expenses:</strong> {formatCurrency(reportData.summary.accountSummary.expenses)}</p>
												</Col>
												<Col md={6}>
													<p><strong>Net Change:</strong> {formatCurrency(reportData.summary.accountSummary.netChange)}</p>
													<p><strong>Avg. Daily Spend:</strong> {formatCurrency(reportData.summary.accountSummary.averageDailySpend)}</p>
													<p><strong>Days in Period:</strong> {reportData.summary.accountSummary.daysInPeriod}</p>
												</Col>
											</Row>
										)}

										<h5 className="mt-4">Top Categories</h5>
										{reportData.summary.topCategories && reportData.summary.topCategories.length > 0 ? (
											<Table striped bordered hover variant="light" size="sm">
												<thead>
													<tr>
														<th>Category</th>
														<th>Count</th>
														<th>Total</th>
														<th>Percent</th>
													</tr>
												</thead>
												<tbody>
													{reportData.summary.topCategories.map((cat, index) => (
														<tr key={index}>
															<td>{cat.name}</td>
															<td>{cat.count}</td>
															<td>{formatCurrency(cat.total)}</td>
															<td>{cat.percent.toFixed(1)}%</td>
														</tr>
													))}
												</tbody>
											</Table>
										) : (
											<p>No category data available</p>
										)}

										<h5 className="mt-4">Top Merchants</h5>
										{reportData.summary.topMerchants && reportData.summary.topMerchants.length > 0 ? (
											<Table striped bordered hover variant="light" size="sm">
												<thead>
													<tr>
														<th>Merchant</th>
														<th>Count</th>
														<th>Total</th>
													</tr>
												</thead>
												<tbody>
													{reportData.summary.topMerchants.map((merchant, index) => (
														<tr key={index}>
															<td>{merchant.name}</td>
															<td>{merchant.count}</td>
															<td>{formatCurrency(merchant.total)}</td>
														</tr>
													))}
												</tbody>
											</Table>
										) : (
											<p>No merchant data available</p>
										)}

										<h5 className="mt-4">Risk Assessment</h5>
										<p>
											<strong>Risk Count:</strong> {reportData.summary.riskCount}<br />
											<strong>Critical Risks:</strong> {reportData.summary.hasCriticalRisks ? 'Yes' : 'No'}
										</p>
									</Card.Body>
								</Card>
							</Tab>
							<Tab eventKey="raw" title="Raw JSON">
								<pre className="bg-light p-3 rounded" style={{ maxHeight: '500px', overflow: 'auto' }}>
									{JSON.stringify(reportData, null, 2)}
								</pre>
							</Tab>
						</Tabs>
					</div>
				) : (
					<Alert variant="info">
						Click "Generate Report" to create a Banking Intelligence Command report.
					</Alert>
				)}
			</Modal.Body>
			<Modal.Footer>
				{!reportLoading && (
					<>
						<Button
							variant="primary"
							onClick={generateReport}
							disabled={reportLoading || !selectedUser}
						>
							{reportLoading ? 'Generating...' : 'Generate Report'}
						</Button>
						<Button
							variant="success"
							onClick={generatePdfReport}
							disabled={reportLoading || !selectedUser}
						>
							Generate PDF
						</Button>
						<Button variant="secondary" onClick={() => setShowReportModal(false)}>
							Close
						</Button>
					</>
				)}
			</Modal.Footer>
		</Modal>
	);

	// Bulk Report Modal
	const renderBulkReportModal = () => (
		<Modal show={showBulkReportModal} onHide={() => setShowBulkReportModal(false)} size="lg" backdrop="static">
			<Modal.Header closeButton>
				<Modal.Title>Bulk Banking Intelligence Reports</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				{bulkReportError && (
					<Alert variant="danger">{bulkReportError}</Alert>
				)}

				{bulkReportLoading ? (
					<div className="text-center p-4">
						<Spinner animation="border" variant="primary" />
						<p className="mt-2">Generating reports for {selectedUsers.length} users...</p>
					</div>
				) : bulkReportResults ? (
					<div>
						<Alert variant={bulkReportResults.successful === bulkReportResults.total ? 'success' : 'warning'}>
							Generated {bulkReportResults.successful} of {bulkReportResults.total} reports successfully.
							{bulkReportResults.failed > 0 && ` ${bulkReportResults.failed} reports failed to generate.`}
						</Alert>

						<h5>Results</h5>
						<Table striped bordered hover>
							<thead>
								<tr>
									<th>Bank User ID</th>
									<th>Status</th>
									<th>Details</th>
								</tr>
							</thead>
							<tbody>
								{bulkReportResults.results.map((result, index) => {
									const user = bankUsers.find(u => u.bankUserId === result.userId);
									return (
										<tr key={index}>
											<td>{result.userId}</td>
											<td>
												{result.status === 'success' ? (
													<Badge bg="success">Success</Badge>
												) : (
													<Badge bg="danger">Error</Badge>
												)}
											</td>
											<td>
												{result.status === 'success' ? (
													<Button size="sm" variant="outline-primary" onClick={() => {
														setSelectedUser(user);
														setReportData(result.data);
														setShowBulkReportModal(false);
														setShowReportModal(true);
													}}>
														View Report
													</Button>
												) : (
													<span className="text-danger">{result.error}</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</Table>
					</div>
				) : (
					<>
						<h5>Report Options</h5>
						<Form>
							<Form.Group className="mb-3">
								<Form.Label>Time Period</Form.Label>
								<Form.Select
									value={bulkReportOptions.timeframe}
									onChange={(e) => setBulkReportOptions({ ...bulkReportOptions, timeframe: e.target.value })}
								>
									<option value="30d">Last 30 Days</option>
									<option value="90d">Last 90 Days</option>
									<option value="180d">Last 180 Days</option>
									<option value="1y">Last Year</option>
								</Form.Select>
							</Form.Group>
							<Form.Group className="mb-3">
								<Form.Check
									type="checkbox"
									label="Include Detailed Sections"
									checked={bulkReportOptions.includeDetailed}
									onChange={(e) => setBulkReportOptions({ ...bulkReportOptions, includeDetailed: e.target.checked })}
								/>
							</Form.Group>
						</Form>

						<h5 className="mt-4">Select Users</h5>
						<div className="d-flex justify-content-between mb-3">
							<Button
								variant="outline-primary"
								size="sm"
								onClick={selectAllUsers}
							>
								{selectedUsers.length === bankUsers.length ? 'Deselect All' : 'Select All'}
							</Button>
							<span>{selectedUsers.length} of {bankUsers.length} users selected</span>
						</div>

						<div style={{ maxHeight: '300px', overflow: 'auto' }}>
							<Table striped bordered hover>
								<thead>
									<tr>
										<th>Select</th>
										<th>Bank User ID</th>
										<th>Name</th>
										<th>Status</th>
										<th>Accounts</th>
									</tr>
								</thead>
								<tbody>
									{bankUsers.map((user, index) => (
										<tr key={index}>
											<td>
												<Form.Check
													type="checkbox"
													checked={selectedUsers.includes(user.bankUserId)}
													onChange={() => toggleUserSelection(user.bankUserId)}
													id={`user-check-${index}`}
												/>
											</td>
											<td className="text-truncate" style={{ maxWidth: '150px' }}>
												{user.bankUserId}
											</td>
											<td>{user.name || 'N/A'}</td>
											<td>
												<BankUserStatusBadge status={user.status} />
											</td>
											<td>{user.accountCount || 0}</td>
										</tr>
									))}
								</tbody>
							</Table>
						</div>
					</>
				)}
			</Modal.Body>
			<Modal.Footer>
				{!bulkReportLoading && (
					bulkReportResults ? (
						<>
							<Button variant="primary" onClick={() => {
								setBulkReportResults(null);
								setSelectedUsers([]);
							}}>
								Generate More Reports
							</Button>
							<Button variant="secondary" onClick={() => setShowBulkReportModal(false)}>
								Close
							</Button>
						</>
					) : (
						<>
							<Button
								variant="primary"
								onClick={generateBulkReports}
								disabled={bulkReportLoading || selectedUsers.length === 0}
							>
								Generate Bulk Reports
							</Button>
							<Button variant="secondary" onClick={() => setShowBulkReportModal(false)}>
								Cancel
							</Button>
						</>
					)
				)}
			</Modal.Footer>
		</Modal>
	);

	// Render dashboard overview
	const renderOverview = () => (
		<>
			<Row className="mt-4">
				<Col md={12} lg={8}>
					<Card className="mb-4">
						<Card.Header className="bg-white">Client Overview</Card.Header>
						<Card.Body>
							{loading ? (
								<div className="text-center p-4">
									<Spinner animation="border" variant="primary" />
									<p className="mt-2">Loading statistics...</p>
								</div>
							) : stats ? (
								<Row>
									<Col sm={4} className="mb-3">
										<div className="stats-card">
											<h2 className="text-primary">{stats?.users?.total || 0}</h2>
											<p className="text-muted">Total Bank Users</p>
										</div>
									</Col>
									<Col sm={4} className="mb-3">
										<div className="stats-card">
											<h2 className="text-primary">{stats?.accounts?.total || 0}</h2>
											<p className="text-muted">Active Accounts</p>
										</div>
									</Col>
									<Col sm={4} className="mb-3">
										<div className="stats-card">
											<h2 className="text-primary">{stats?.transactions?.total || 0}</h2>
											<p className="text-muted">Total Transactions</p>
										</div>
									</Col>
								</Row>
							) : (
								<Alert variant="warning">No statistics available</Alert>
							)}
						</Card.Body>
					</Card>
				</Col>

				<Col md={12} lg={4}>
					<Card className="mb-4">
						<Card.Header className="bg-white">Recent Activity</Card.Header>
						<Card.Body>
							<Form.Group className="mb-3">
								<Form.Label>Time Period</Form.Label>
								<Form.Select
									className='text-dark bg-white'
									value={dateRange}
									onChange={(e) => setDateRange(e.target.value)}
								>
									<option value="7">Last 7 Days</option>
									<option value="30">Last 30 Days</option>
									<option value="90">Last 90 Days</option>
								</Form.Select>
							</Form.Group>

							{loading ? (
								<div className="text-center">
									<Spinner animation="border" variant="primary" size="sm" />
								</div>
							) : (
								<ResponsiveContainer width="100%" height={200}>
									<BarChart data={activityData}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="date" />
										<YAxis />
										<Tooltip />
										<Legend />
										<Bar dataKey="transactions" fill="#0d6efd" name="Transactions" />
										<Bar dataKey="users" fill="#198754" name="Active Users" />
									</BarChart>
								</ResponsiveContainer>
							)}
						</Card.Body>
					</Card>
				</Col>
			</Row>

			<Card className="mb-4">
				<Card.Header className="bg-white d-flex justify-content-between align-items-center">
					<span>Bank Users</span>
					<Button
						variant="primary"
						size="sm"
						onClick={() => setShowBulkReportModal(true)}
					>
						Generate Bulk Reports
					</Button>
				</Card.Header>
				<Card.Body>
					{loading ? (
						<div className="text-center p-4">
							<Spinner animation="border" variant="primary" />
							<p className="mt-2">Loading bank users...</p>
						</div>
					) : bankUsers.length > 0 ? (
						<Table responsive striped hover className="mb-0 table-light">
							<thead>
								<tr>
									<th>User ID</th>
									<th>Name</th>
									<th>Email</th>
									<th>Status</th>
									<th>Created</th>
									<th>Accounts</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{bankUsers.map(user => (
									<tr key={user.id}>
										<td className="text-truncate" style={{ maxWidth: '150px' }}>
											{user.bankUserId}
										</td>
										<td>{user.name || 'N/A'}</td>
										<td>{user.email || 'N/A'}</td>
										<td>
											<BankUserStatusBadge status={user.status} />
										</td>
										<td>{formatDate(user.createdAt)}</td>
										<td>{user.accountCount || 0}</td>
										<td>
											<Button
												size="sm"
												variant="primary"
												onClick={() => handleUserSelect(user)}
												className="me-2"
											>
												View Details
											</Button>
											<Button
												size="sm"
												variant="outline-primary"
												onClick={() => {
													setSelectedUser(user);
													setShowReportModal(true);
												}}
											>
												Generate Report
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					) : (
						<div className="text-center p-4">
							<Alert variant="info">
								No bank users found. Add bank users to get started.
							</Alert>
						</div>
					)}
				</Card.Body>
			</Card>
		</>
	);

	// Render user details
	const renderUserDetails = () => {
		if (!selectedUser) {
			return (
				<Alert variant="warning">
					No user selected. Please select a user from the overview page.
				</Alert>
			);
		}

		return (
			<>
				<Card className="mb-4">
					<Card.Header className="bg-white d-flex justify-content-between align-items-center">
						<div>
							<h5 className="mb-0">User Profile: {selectedUser.name || selectedUser.bankUserId}</h5>
							<small className="text-muted">{selectedUser.email || 'No email'}</small>
						</div>
						<div>
							<Button
								variant="primary"
								size="sm"
								onClick={() => setShowReportModal(true)}
								className="me-2"
							>
								Generate Banking Report
							</Button>
							<Button
								variant="outline-secondary"
								size="sm"
								onClick={() => setActiveTab('overview')}
							>
								Back to Overview
							</Button>
						</div>
					</Card.Header>
					<Card.Body>
						<Row>
							<Col md={6}>
								<p><strong>Bank User ID:</strong> {selectedUser.bankUserId}</p>
								<p><strong>Status:</strong> <BankUserStatusBadge status={selectedUser.status} /></p>
								<p><strong>Created:</strong> {formatDate(selectedUser.createdAt)}</p>
							</Col>
							<Col md={6}>
								{selectedUser.metadata && (
									<>
										<p><strong>Metadata:</strong></p>
										<pre className="bg-light p-2 rounded" style={{ maxHeight: '150px', overflow: 'auto' }}>
											{JSON.stringify(selectedUser.metadata, null, 2)}
										</pre>
									</>
								)}
							</Col>
						</Row>
					</Card.Body>
				</Card>

				<Card className="mb-4">
					<Card.Header className="bg-white">Accounts</Card.Header>
					<Card.Body>
						{loading ? (
							<div className="text-center p-4">
								<Spinner animation="border" variant="primary" />
								<p className="mt-2">Loading accounts...</p>
							</div>
						) : userAccounts.length > 0 ? (
							<Table responsive striped hover className="mb-0 table-light">
								<thead>
									<tr>
										<th>Account ID</th>
										<th>Name</th>
										<th>Type</th>
										<th>Balance</th>
										<th>Available</th>
										<th>Currency</th>
										<th>Last Updated</th>
									</tr>
								</thead>
								<tbody>
									{userAccounts.map(account => (
										<tr key={account.id}>
											<td className="text-truncate" style={{ maxWidth: '150px' }}>
												{account.accountId}
											</td>
											<td>{account.name}</td>
											<td>
												<AccountTypeBadge type={account.type} />
												{account.subtype && <small className="ms-2 text-muted">({account.subtype})</small>}
											</td>
											<td>{formatCurrency(account.balance, account.currency)}</td>
											<td>{formatCurrency(account.availableBalance, account.currency)}</td>
											<td>{account.currency}</td>
											<td>{formatDate(account.lastUpdated)}</td>
										</tr>
									))}
								</tbody>
							</Table>
						) : (
							<Alert variant="info">No accounts found for this user.</Alert>
						)}
					</Card.Body>
				</Card>

				<Card className="mb-4">
					<Card.Header className="bg-white">
						<div className="d-flex justify-content-between align-items-center">
							<h5 className="mb-0">Transactions</h5>
							<Button
								size="sm"
								variant="outline-primary"
								onClick={() => document.getElementById('filterCollapse').classList.toggle('show')}
							>
								Filters
							</Button>
						</div>
					</Card.Header>

					<div className="collapse" id="filterCollapse">
						<Card.Body className="border-bottom bg-light">
							<Form onSubmit={handleApplyFilters}>
								<Row>
									<Col md={3}>
										<Form.Group className="mb-3">
											<Form.Label>Start Date</Form.Label>
											<Form.Control
												type="date"
												value={transactionFilters.startDate}
												onChange={(e) => setTransactionFilters({ ...transactionFilters, startDate: e.target.value })}
											/>
										</Form.Group>
									</Col>
									<Col md={3}>
										<Form.Group className="mb-3">
											<Form.Label>End Date</Form.Label>
											<Form.Control
												type="date"
												value={transactionFilters.endDate}
												onChange={(e) => setTransactionFilters({ ...transactionFilters, endDate: e.target.value })}
											/>
										</Form.Group>
									</Col>
									<Col md={3}>
										<Form.Group className="mb-3">
											<Form.Label>Account</Form.Label>
											<Form.Select
												value={transactionFilters.accountId}
												onChange={(e) => setTransactionFilters({ ...transactionFilters, accountId: e.target.value })}
											>
												<option value="">All Accounts</option>
												{userAccounts.map(account => (
													<option key={account.accountId} value={account.accountId}>
														{account.name}
													</option>
												))}
											</Form.Select>
										</Form.Group>
									</Col>
									<Col md={3}>
										<Form.Group className="mb-3">
											<Form.Label>Type</Form.Label>
											<Form.Select
												value={transactionFilters.type}
												onChange={(e) => setTransactionFilters({ ...transactionFilters, type: e.target.value })}
											>
												<option value="">All Types</option>
												<option value="income">Income</option>
												<option value="expense">Expense</option>
												<option value="transfer">Transfer</option>
											</Form.Select>
										</Form.Group>
									</Col>
								</Row>
								<div className="d-flex gap-2">
									<Button type="submit" variant="primary" size="sm">Apply Filters</Button>
									<Button type="button" variant="outline-secondary" size="sm" onClick={handleResetFilters}>Reset</Button>
								</div>
							</Form>
						</Card.Body>
					</div>

					<Card.Body>
						{loading ? (
							<div className="text-center p-4">
								<Spinner animation="border" variant="primary" />
								<p className="mt-2">Loading transactions...</p>
							</div>
						) : userTransactions.length > 0 ? (
							<Table responsive striped hover className="mb-0 table-light">
								<thead>
									<tr>
										<th>Date</th>
										<th>Description</th>
										<th>Amount</th>
										<th>Account</th>
										<th>Category</th>
										<th>Merchant</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{userTransactions.map(transaction => {
										const account = userAccounts.find(a => a.accountId === transaction.accountId);
										return (
											<tr key={transaction.id}>
												<td>{formatDate(transaction.date)}</td>
												<td className="text-truncate" style={{ maxWidth: '200px' }}>
													{transaction.description}
												</td>
												<td className={transaction.amount >= 0 ? 'text-success' : 'text-danger'}>
													{formatCurrency(transaction.amount, account?.currency || 'USD')}
												</td>
												<td>{account?.name || transaction.accountId}</td>
												<td>{transaction.category || 'Uncategorized'}</td>
												<td>{transaction.merchantName || 'N/A'}</td>
												<td>
													{transaction.pending ? (
														<Badge bg="warning">Pending</Badge>
													) : (
														<Badge bg="success">Cleared</Badge>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</Table>
						) : (
							<Alert variant="info">No transactions found for this user.</Alert>
						)}
					</Card.Body>
				</Card>
			</>
		);
	};

	return (
		<Container fluid className="py-4">
			<h1 className="mb-4 text-white">Bank Dashboard</h1>

			{error && (
				<Alert variant="danger" dismissible onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Nav variant="tabs" className="mb-4">
				<Nav.Item>
					<Nav.Link
						active={activeTab === 'overview'}
						onClick={() => setActiveTab('overview')}
					>
						Overview
					</Nav.Link>
				</Nav.Item>
				<Nav.Item>
					<Nav.Link
						active={activeTab === 'userDetails'}
						onClick={() => activeTab !== 'userDetails' && selectedUser && setActiveTab('userDetails')}
						disabled={!selectedUser}
					>
						User Details
					</Nav.Link>
				</Nav.Item>
			</Nav>

			{activeTab === 'overview' && renderOverview()}
			{activeTab === 'userDetails' && renderUserDetails()}

			{/* Report Modals */}
			{renderReportModal()}
			{renderBulkReportModal()}
		</Container>
	);
};

export default BankDashboard;