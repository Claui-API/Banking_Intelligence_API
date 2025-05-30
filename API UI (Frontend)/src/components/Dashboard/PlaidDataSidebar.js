// src/components/Dashboard/PlaidDataSidebar.js (Fixed with user validation)
import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Accordion, Spinner, Button, Alert } from 'react-bootstrap';
import PlaidLinkButton from '../Plaid/PlaidLinkButton';
import api from '../../services/api';
import logger from '../../utils/logger';

/**
 * Component for displaying Plaid account and transaction data in a sidebar
 * with proper user validation
 */
const PlaidDataSidebar = ({
	userData,
	isVisible,
	isLoading = false,
	onRefresh,
	onPlaidSuccess,
	userId // Add userId prop for validation
}) => {
	const [activeKey, setActiveKey] = useState(['0', '1']); // Open both accordions by default
	const [dataIssueDetected, setDataIssueDetected] = useState(false);
	const [isDuplicateData, setIsDuplicateData] = useState(false);
	const [isReconnecting, setIsReconnecting] = useState(false);

	// Check for data issues and validate user data
	useEffect(() => {
		if (userData && userData.accounts) {
			// Validate the data belongs to the current user
			if (userData.userId && userId && userData.userId !== userId) {
				logger.error('User data mismatch detected', {
					expected: userId,
					found: userData.userId
				});

				setDataIssueDetected(true);
				return;
			}

			detectDataIssues(userData);
		}
	}, [userData, userId]);

	// Function to detect common data issues
	const detectDataIssues = (data) => {
		if (!data || !data.accounts || !Array.isArray(data.accounts)) {
			return;
		}

		// Check for duplicate accounts (same name and balance)
		const accountMap = new Map();
		let hasDuplicates = false;

		data.accounts.forEach(account => {
			const key = `${account.name}-${account.balance}-${account.type}`;
			if (accountMap.has(key)) {
				hasDuplicates = true;
			} else {
				accountMap.set(key, account);
			}
		});

		setIsDuplicateData(hasDuplicates);

		// Set overall data issue flag
		setDataIssueDetected(hasDuplicates);
	};

	// Handle reconnection through Plaid Link
	const handleReconnect = async () => {
		try {
			setIsReconnecting(true);

			// First, disconnect existing connections
			logger.info(`Initiating bank reconnection process for user ${userId}`);

			// Call the backend to prepare for reconnection
			await api.post('/plaid/reconnect');

			logger.info(`Reconnection preparation successful for user ${userId}, ready for Plaid Link`);

			// Now PlaidLinkButton will handle the actual reconnection
			// The state remains true until PlaidLinkButton is clicked
		} catch (error) {
			logger.error(`Error preparing for reconnection for user ${userId}:`, error);
			setIsReconnecting(false);
		}
	};

	// Handle successful reconnection
	const handleReconnectSuccess = (linkData) => {
		setIsReconnecting(false);

		// Call the parent's success handler
		if (onPlaidSuccess) {
			onPlaidSuccess(linkData);
		}
	};

	// Handle exit from reconnection flow
	const handleReconnectExit = (err) => {
		setIsReconnecting(false);
		if (err) {
			logger.error(`Error during reconnection for user ${userId}:`, err);
		}
	};

	if (!isVisible) return null;

	// Handle accordion toggle
	const handleAccordionToggle = (key) => {
		if (activeKey.includes(key)) {
			setActiveKey(activeKey.filter(k => k !== key));
		} else {
			setActiveKey([...activeKey, key]);
		}
	};

	// Format currency values
	const formatCurrency = (amount) => {
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD'
			}).format(amount);
		} catch (error) {
			console.error('Error formatting currency:', error);
			return `$${amount}`;
		}
	};

	// Format date values
	const formatDate = (dateString) => {
		try {
			return new Date(dateString).toLocaleDateString();
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	};

	// Calculate account totals
	const calculateTotals = () => {
		if (!userData || !userData.accounts || !Array.isArray(userData.accounts)) {
			return { total: 0, assets: 0, liabilities: 0 };
		}

		return userData.accounts.reduce((totals, account) => {
			// Determine if account is an asset or liability
			const isCreditCard = account.type === 'Credit Card';

			// Add to appropriate total
			if (isCreditCard) {
				// For credit cards, the balance is typically shown as negative in our system
				// so we use the absolute value for liabilities
				totals.liabilities += Math.abs(account.balance);
				// The total is already correctly adjusted because credit card balances are negative
				totals.total += account.balance; // This will subtract the liability
			} else {
				// Regular accounts are assets
				totals.assets += account.balance;
				// Add to total
				totals.total += account.balance;
			}

			return totals;
		}, { total: 0, assets: 0, liabilities: 0 });
	};

	const totals = calculateTotals();

	// If loading, show spinner
	if (isLoading) {
		return (
			<div className="text-center p-5">
				<Spinner animation="border" variant="success" />
				<p className="text-white mt-3">Loading your financial data...</p>
			</div>
		);
	}

	// If no data, show message
	if (!userData || !userData.accounts || userData.accounts.length === 0) {
		return (
			<div className="text-center p-4">
				<div className="mb-4">
					<i className="bi bi-bank text-secondary" style={{ fontSize: '3rem' }}></i>
				</div>
				<h5 className="text-white mb-3">No Financial Data Available</h5>
				<p className="text-white">
					Connect your bank account to view your financial data here.
				</p>
			</div>
		);
	}

	return (
		<div className="plaid-data-sidebar">
			<div className="d-flex justify-content-between align-items-center mb-3">
				<h5 className="text-white mb-0">Your Financial Data</h5>
				<Badge bg="success" className="p-2">
					<i className="bi bi-bank me-2"></i>
					{userData.institution || 'Connected'}
				</Badge>
			</div>

			{/* User validation warning */}
			{userData.userId && userId && userData.userId !== userId && (
				<Alert variant="danger" className="mb-3">
					<div className="d-flex justify-content-between align-items-center">
						<div>
							<i className="bi bi-exclamation-triangle-fill me-2"></i>
							<strong>Security alert:</strong> Data ownership mismatch detected
						</div>
						<Button
							variant="danger"
							size="sm"
							onClick={handleReconnect}
						>
							Reset Connection
						</Button>
					</div>
				</Alert>
			)}

			{/* Data Issue Alert */}
			{dataIssueDetected && (
				<Alert variant="warning" className="mb-3">
					<div className="d-flex justify-content-between align-items-center">
						<div>
							<i className="bi bi-exclamation-triangle-fill me-2"></i>
							{isDuplicateData ? 'Duplicate account data detected.' : 'Issues detected with your financial data.'}
						</div>

						{isReconnecting ? (
							<PlaidLinkButton
								onSuccess={handleReconnectSuccess}
								onExit={handleReconnectExit}
								buttonText="Reconnect Bank"
								className="btn-sm btn-warning"
							/>
						) : (
							<Button
								variant="warning"
								size="sm"
								onClick={handleReconnect}
							>
								Reconnect Bank
							</Button>
						)}
					</div>
				</Alert>
			)}

			{/* Financial Summary Card */}
			<Card className="mb-4 bg-dark text-white border border-secondary">
				<Card.Body>
					<h6 className="text-black mb-3">Financial Summary</h6>

					<div className="d-flex justify-content-between mb-2">
						<span className="text-black">Total Assets:</span>
						<span className="text-success">{formatCurrency(totals.assets)}</span>
					</div>

					<div className="d-flex justify-content-between mb-2">
						<span className="text-black">Total Liabilities:</span>
						<span className="text-danger">{formatCurrency(totals.liabilities)}</span>
					</div>

					<hr className="border-secondary" />

					<div className="d-flex justify-content-between">
						<span className="text-black fw-bold">Net Worth:</span>
						<span className={`fw-bold ${totals.total >= 0 ? 'text-success' : 'text-danger'}`}>
							{formatCurrency(totals.total)}
						</span>
					</div>

					<div className="text-muted small mt-3 mb-0">
						Last updated: {formatDate(userData.lastUpdated || new Date())}
					</div>
				</Card.Body>
			</Card>

			{/* Accounts Accordion */}
			<Accordion
				defaultActiveKey="0"
				className="mb-4"
				activeKey={activeKey}
			>
				<Accordion.Item eventKey="0">
					<Accordion.Header
						onClick={() => handleAccordionToggle('0')}
					>
						Accounts ({userData.accounts?.length || 0})
					</Accordion.Header>
					<Accordion.Body>
						<Table responsive striped variant="dark" size="sm" className="mb-0">
							<thead>
								<tr>
									<th>Account</th>
									<th>Type</th>
									<th>Balance</th>
								</tr>
							</thead>
							<tbody>
								{userData.accounts?.map(account => (
									<tr key={account.accountId}>
										<td>{account.name}</td>
										<td>{account.type}</td>
										<td className={account.balance < 0 ? 'text-danger' : 'text-success'}>
											{formatCurrency(Math.abs(account.balance))}
											{account.balance < 0 && <span className="ms-1 text-muted small">(owed)</span>}
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					</Accordion.Body>
				</Accordion.Item>
			</Accordion>

			{/* Transactions Accordion */}
			<Accordion
				defaultActiveKey="1"
				className="mb-3"
				activeKey={activeKey}
			>
				<Accordion.Item eventKey="1">
					<Accordion.Header
						onClick={() => handleAccordionToggle('1')}
					>
						Recent Transactions ({userData.transactions?.length || 0})
					</Accordion.Header>
					<Accordion.Body>
						<Table responsive striped variant="dark" size="sm" className="mb-0">
							<thead>
								<tr>
									<th>Date</th>
									<th>Description</th>
									<th>Amount</th>
								</tr>
							</thead>
							<tbody>
								{userData.transactions?.slice(0, 15).map(transaction => (
									<tr key={transaction.transactionId}>
										<td>{formatDate(transaction.date)}</td>
										<td>
											<div className="text-truncate" style={{ maxWidth: '150px' }}>
												{transaction.description}
											</div>
											{transaction.category && (
												<span className="badge bg-secondary text-white mt-1">
													{transaction.category}
												</span>
											)}
										</td>
										<td className={transaction.amount < 0 ? 'text-danger' : 'text-success'}>
											{formatCurrency(Math.abs(transaction.amount))}
											{transaction.amount < 0 ? ' (debit)' : ' (credit)'}
										</td>
									</tr>
								))}
							</tbody>
						</Table>
						{userData.transactions?.length > 15 && (
							<div className="text-center text-muted p-2 small">
								Showing 15 of {userData.transactions.length} transactions
							</div>
						)}
					</Accordion.Body>
				</Accordion.Item>
			</Accordion>

			{/* Data Management Buttons */}
			<div className="d-grid gap-2 mb-2">
				{/* Refresh Button */}
				<Button
					variant="outline-primary"
					size="sm"
					onClick={onRefresh}
					disabled={isLoading}
				>
					<i className="bi bi-arrow-clockwise me-1"></i>
					Refresh Financial Data
				</Button>

				{/* Reconnect Button - Always visible as an option */}
				{!isReconnecting ? (
					<Button
						variant="outline-warning"
						size="sm"
						onClick={handleReconnect}
					>
						<i className="bi bi-bank me-1"></i>
						Reconnect Bank
					</Button>
				) : (
					<PlaidLinkButton
						onSuccess={handleReconnectSuccess}
						onExit={handleReconnectExit}
						buttonText="Complete Reconnection"
						className="btn-sm btn-warning w-100"
					/>
				)}
			</div>

			{/* Debug/security info - remove in production */}
			<div className="text-muted small mt-3">
				<i className="bi bi-shield-check me-1"></i>
				Data owner: {userData.userId === userId ? 'Verified' : 'ALERT: MISMATCH'}
			</div>
		</div >
	);
};

export default PlaidDataSidebar;