// src/components/Bank/BankUserDetails.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Badge, Button, Spinner, Alert, Tabs, Tab, Form } from 'react-bootstrap';
import { apiClient } from '../../services/api-client';
import logger from '../../utils/logger';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#9CCC65', '#FF8A65'];

const BankUserDetails = () => {
	const { bankUserId } = useParams();
	const navigate = useNavigate();

	// State
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [bankUser, setBankUser] = useState(null);
	const [accounts, setAccounts] = useState([]);
	const [transactions, setTransactions] = useState([]);
	const [transactionSummary, setTransactionSummary] = useState(null);
	const [categories, setCategories] = useState([]);
	const [activeTab, setActiveTab] = useState('overview');
	const [transactionFilters, setTransactionFilters] = useState({
		startDate: '',
		endDate: '',
		accountId: '',
		type: '',
		search: ''
	});
	const [transactionPagination, setTransactionPagination] = useState({
		page: 1,
		limit: 50,
		total: 0,
		pages: 1
	});

	// Fetch user details
	useEffect(() => {
		const fetchUserDetails = async () => {
			try {
				setLoading(true);
				setError(null);

				// Get user details
				const response = await apiClient.get(`/bank-client/users/${bankUserId}/details`);
				const { data } = response.data;

				setBankUser(data.bankUser);
				setAccounts(data.accounts);
				setTransactionSummary(data.transactionSummary);
				setCategories(data.categories);

				// Initial transactions
				setTransactions(data.recentTransactions);

			} catch (err) {
				logger.error(`Error fetching bank user details: ${err.message}`);
				setError(`Failed to load bank user details. ${err.response?.data?.message || err.message}`);
			} finally {
				setLoading(false);
			}
		};

		if (bankUserId) {
			fetchUserDetails();
		}
	}, [bankUserId]);

	// Fetch transactions when filters change
	const fetchTransactions = async (page = 1) => {
		try {
			setLoading(true);

			let url = `/bank-client/users/${bankUserId}/transactions?page=${page}&limit=${transactionPagination.limit}`;

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
			if (transactionFilters.search) {
				url += `&search=${encodeURIComponent(transactionFilters.search)}`;
			}

			const response = await apiClient.get(url);
			const { data, pagination } = response.data;

			setTransactions(data);
			setTransactionPagination(pagination);
		} catch (err) {
			logger.error(`Error fetching transactions: ${err.message}`);
			setError(`Failed to load transactions. ${err.response?.data?.message || err.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Apply transaction filters
	const handleApplyFilters = (e) => {
		e.preventDefault();
		fetchTransactions(1); // Reset to first page when applying filters
	};

	// Reset transaction filters
	const handleResetFilters = () => {
		setTransactionFilters({
			startDate: '',
			endDate: '',
			accountId: '',
			type: '',
			search: ''
		});

		// Wait for state update to complete
		setTimeout(() => {
			fetchTransactions(1);
		}, 0);
	};

	// Handle page change
	const handlePageChange = (newPage) => {
		if (newPage < 1 || newPage > transactionPagination.pages) return;
		fetchTransactions(newPage);
	};

	// Prepare category data for pie chart
	const prepareCategoryData = () => {
		if (!categories || categories.length === 0) return [];

		// Get top categories by count
		const topCategories = [...categories]
			.filter(cat => cat.category) // Filter out null categories
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) // Sort by absolute amount
			.slice(0, 7); // Get top 7

		// Calculate total for "Others" category if needed
		if (categories.length > 7) {
			const othersSum = categories
				.filter(cat => cat.category && !topCategories.find(tc => tc.category === cat.category))
				.reduce((sum, cat) => sum + parseFloat(cat.amount), 0);

			if (othersSum !== 0) {
				topCategories.push({
					category: 'Others',
					count: categories.length - topCategories.length,
					amount: othersSum
				});
			}
		}

		// Format data for chart
		return topCategories.map(cat => ({
			name: cat.category,
			value: Math.abs(parseFloat(cat.amount))
		}));
	};

	// Render overview tab
	const renderOverview = () => {
		if (!bankUser || !transactionSummary) {
			return <Alert variant="info">Loading user information...</Alert>;
		}

		const categoryData = prepareCategoryData();

		return (
			<>
				<Row>
					<Col md={6}>
						<Card className="mb-4">
							<Card.Header className="bg-white">Account Summary</Card.Header>
							<Card.Body>
								<div className="d-flex justify-content-between mb-3">
									<div>
										<h6 className="text-muted">Total Accounts</h6>
										<h3>{accounts.length}</h3>
									</div>
									<div>
										<h6 className="text-muted">Total Balance</h6>
										<h3>{formatCurrency(accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0), 'USD')}</h3>
									</div>
								</div>

								{accounts.length > 0 ? (
									<Table responsive borderless size="sm">
										<thead>
											<tr className="text-muted">
												<th>Account</th>
												<th>Type</th>
												<th className="text-end">Balance</th>
											</tr>
										</thead>
										<tbody>
											{accounts.map(account => (
												<tr key={account.id}>
													<td>{account.name}</td>
													<td><AccountTypeBadge type={account.type} /></td>
													<td className="text-end">{formatCurrency(account.balance, account.currency)}</td>
												</tr>
											))}
										</tbody>
									</Table>
								) : (
									<Alert variant="info">No accounts found for this user.</Alert>
								)}
							</Card.Body>
						</Card>
					</Col>

					<Col md={6}>
						<Card className="mb-4">
							<Card.Header className="bg-white">Transaction Summary</Card.Header>
							<Card.Body>
								<Row>
									<Col xs={6}>
										<div className="text-center mb-3">
											<h6 className="text-muted">Total Transactions</h6>
											<h3>{transactionSummary.total}</h3>
											{transactionSummary.pending > 0 && (
												<small className="text-warning">
													{transactionSummary.pending} pending
												</small>
											)}
										</div>
									</Col>
									<Col xs={6}>
										<div className="text-center mb-3">
											<h6 className="text-muted">Net Balance</h6>
											<h3 className={parseFloat(transactionSummary.totalIncome) + parseFloat(transactionSummary.totalExpense) >= 0 ? 'text-success' : 'text-danger'}>
												{formatCurrency(parseFloat(transactionSummary.totalIncome) + parseFloat(transactionSummary.totalExpense), 'USD')}
											</h3>
										</div>
									</Col>
								</Row>

								<Row>
									<Col xs={6}>
										<div className="text-center">
											<div className="text-success">
												<h6 className="text-muted">Income</h6>
												<h4>{formatCurrency(parseFloat(transactionSummary.totalIncome), 'USD')}</h4>
											</div>
										</div>
									</Col>
									<Col xs={6}>
										<div className="text-center">
											<div className="text-danger">
												<h6 className="text-muted">Expenses</h6>
												<h4>{formatCurrency(parseFloat(transactionSummary.totalExpense), 'USD')}</h4>
											</div>
										</div>
									</Col>
								</Row>
							</Card.Body>
						</Card>
					</Col>
				</Row>

				<Row>
					<Col md={6}>
						<Card className="mb-4">
							<Card.Header className="bg-white">Spending by Category</Card.Header>
							<Card.Body>
								{categoryData.length > 0 ? (
									<ResponsiveContainer width="100%" height={300}>
										<PieChart>
											<Pie
												data={categoryData}
												dataKey="value"
												nameKey="name"
												cx="50%"
												cy="50%"
												outerRadius={100}
												fill="#8884d8"
												label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
											>
												{categoryData.map((entry, index) => (
													<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
												))}
											</Pie>
											<Tooltip formatter={(value) => formatCurrency(value, 'USD')} />
											<Legend />
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="text-center p-4">
										<p className="text-muted">No category data available</p>
									</div>
								)}
							</Card.Body>
						</Card>
					</Col>

					<Col md={6}>
						<Card className="mb-4">
							<Card.Header className="bg-white">Recent Transactions</Card.Header>
							<Card.Body>
								{transactions.length > 0 ? (
									<div style={{ maxHeight: '300px', overflow: 'auto' }}>
										<Table responsive borderless size="sm">
											<thead>
												<tr className="text-muted">
													<th>Date</th>
													<th>Description</th>
													<th className="text-end">Amount</th>
												</tr>
											</thead>
											<tbody>
												{transactions.slice(0, 10).map(transaction => (
													<tr key={transaction.id}>
														<td>{formatDate(transaction.date)}</td>
														<td className="text-truncate" style={{ maxWidth: '200px' }}>
															{transaction.description}
														</td>
														<td className={`text-end ${parseFloat(transaction.amount) >= 0 ? 'text-success' : 'text-danger'}`}>
															{formatCurrency(transaction.amount, 'USD')}
														</td>
													</tr>
												))}
											</tbody>
										</Table>
									</div>
								) : (
									<Alert variant="info">No recent transactions found.</Alert>
								)}

								<div className="text-center mt-3">
									<Button
										variant="outline-primary"
										size="sm"
										onClick={() => setActiveTab('transactions')}
									>
										View All Transactions
									</Button>
								</div>
							</Card.Body>
						</Card>
					</Col>
				</Row>
			</>
		);
	};

	// Render accounts tab
	const renderAccounts = () => {
		return (
			<Card className="mb-4">
				<Card.Header className="bg-white">User Accounts</Card.Header>
				<Card.Body>
					{accounts.length > 0 ? (
						<Table responsive striped hover className="table-light">
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
								{accounts.map(account => (
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
		);
	};

	// Render transactions tab
	const renderTransactions = () => {
		return (
			<>
				<Card className="mb-4">
					<Card.Header className="bg-white">
						<div className="d-flex justify-content-between align-items-center">
							<h5 className="mb-0">Transaction Filters</h5>
						</div>
					</Card.Header>
					<Card.Body className="bg-light">
						<Form onSubmit={handleApplyFilters}>
							<Row>
								<Col md={2}>
									<Form.Group className="mb-3">
										<Form.Label>Start Date</Form.Label>
										<Form.Control
											type="date"
											value={transactionFilters.startDate}
											onChange={(e) => setTransactionFilters({ ...transactionFilters, startDate: e.target.value })}
										/>
									</Form.Group>
								</Col>
								<Col md={2}>
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
											{accounts.map(account => (
												<option key={account.accountId} value={account.accountId}>
													{account.name}
												</option>
											))}
										</Form.Select>
									</Form.Group>
								</Col>
								<Col md={2}>
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
								<Col md={3}>
									<Form.Group className="mb-3">
										<Form.Label>Search</Form.Label>
										<Form.Control
											type="text"
											placeholder="Search description or merchant"
											value={transactionFilters.search}
											onChange={(e) => setTransactionFilters({ ...transactionFilters, search: e.target.value })}
										/>
									</Form.Group>
								</Col>
							</Row>
							<div className="d-flex gap-2">
								<Button type="submit" variant="primary" size="sm">Apply Filters</Button>
								<Button type="button" variant="outline-secondary" size="sm" onClick={handleResetFilters}>Reset</Button>
							</div>
						</Form>
					</Card.Body>
				</Card>

				<Card className="mb-4">
					<Card.Header className="bg-white">Transaction List</Card.Header>
					<Card.Body>
						{loading ? (
							<div className="text-center p-4">
								<Spinner animation="border" variant="primary" />
								<p className="mt-2">Loading transactions...</p>
							</div>
						) : transactions.length > 0 ? (
							<>
								<Table responsive striped hover className="table-light">
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
										{transactions.map(transaction => {
											const account = accounts.find(a => a.accountId === transaction.accountId);
											return (
												<tr key={transaction.id}>
													<td>{formatDate(transaction.date)}</td>
													<td className="text-truncate" style={{ maxWidth: '200px' }}>
														{transaction.description}
													</td>
													<td className={parseFloat(transaction.amount) >= 0 ? 'text-success' : 'text-danger'}>
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

								{/* Pagination */}
								{transactionPagination.pages > 1 && (
									<div className="d-flex justify-content-center mt-4">
										<Button
											variant="outline-primary"
											size="sm"
											onClick={() => handlePageChange(transactionPagination.page - 1)}
											disabled={transactionPagination.page === 1}
											className="mx-1"
										>
											Previous
										</Button>

										<span className="mx-3 d-flex align-items-center">
											Page {transactionPagination.page} of {transactionPagination.pages}
										</span>

										<Button
											variant="outline-primary"
											size="sm"
											onClick={() => handlePageChange(transactionPagination.page + 1)}
											disabled={transactionPagination.page === transactionPagination.pages}
											className="mx-1"
										>
											Next
										</Button>
									</div>
								)}
							</>
						) : (
							<Alert variant="info">No transactions found matching the current filters.</Alert>
						)}
					</Card.Body>
				</Card>
			</>
		);
	};

	return (
		<Container fluid className="py-4">
			{loading && !bankUser ? (
				<div className="text-center p-5">
					<Spinner animation="border" variant="primary" />
					<p className="mt-3">Loading user details...</p>
				</div>
			) : error ? (
				<Alert variant="danger">{error}</Alert>
			) : bankUser ? (
				<>
					<div className="d-flex justify-content-between align-items-center mb-4">
						<div>
							<h1>{bankUser.name || 'Bank User'}</h1>
							<p className="text-muted">ID: {bankUser.bankUserId}</p>
						</div>
						<Button
							variant="outline-secondary"
							onClick={() => navigate('/bank-dashboard')}
						>
							Back to Dashboard
						</Button>
					</div>

					<Tabs
						activeKey={activeTab}
						onSelect={(k) => setActiveTab(k)}
						className="mb-4"
					>
						<Tab eventKey="overview" title="Overview">
							{renderOverview()}
						</Tab>
						<Tab eventKey="accounts" title="Accounts">
							{renderAccounts()}
						</Tab>
						<Tab eventKey="transactions" title="Transactions">
							{renderTransactions()}
						</Tab>
					</Tabs>
				</>
			) : (
				<Alert variant="warning">User not found</Alert>
			)}
		</Container>
	);
};

export default BankUserDetails;