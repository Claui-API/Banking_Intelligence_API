// src/components/Dashboard/DirectDataIntegration.js
import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Table, Tabs, Tab, Alert, Spinner, Modal, InputGroup } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';

/**
 * DirectDataIntegration - Component to allow users to directly edit financial data
 * without requiring Plaid integration
 */
const DirectDataIntegration = ({
	isVisible,
	onDataChange,
	initialData = null,
	userId,
	currentIntegrationMode = 'direct' // Default to direct mode if not provided
}) => {
	// Ref to track initialization
	const isInitialized = useRef(false);

	// Default sample data structure
	const defaultData = {
		accounts: [
			{
				id: 'acc_' + uuidv4().substring(0, 8),
				name: 'Checking Account',
				type: 'depository',
				subtype: 'checking',
				balances: {
					available: 2500.75,
					current: 2500.75,
					limit: null,
					isoCurrencyCode: 'USD',
				},
				mask: '1234'
			},
			{
				id: 'acc_' + uuidv4().substring(0, 8),
				name: 'Savings Account',
				type: 'depository',
				subtype: 'savings',
				balances: {
					available: 12750.32,
					current: 12750.32,
					limit: null,
					isoCurrencyCode: 'USD',
				},
				mask: '5678'
			},
			{
				id: 'acc_' + uuidv4().substring(0, 8),
				name: 'Credit Card',
				type: 'credit',
				subtype: 'credit card',
				balances: {
					available: 3200.00,
					current: 1800.00,
					limit: 5000.00,
					isoCurrencyCode: 'USD',
				},
				mask: '9012'
			}
		],
		transactions: [
			{
				id: 'txn_' + uuidv4().substring(0, 8),
				account_id: '', // Will be set to match first account
				amount: 32.45,
				category: ['Food and Drink', 'Restaurants'],
				date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				name: 'Restaurant ABC',
				payment_channel: 'in store',
				pending: false
			},
			{
				id: 'txn_' + uuidv4().substring(0, 8),
				account_id: '', // Will be set to match first account
				amount: 1500.00,
				category: ['Transfer', 'Deposit'],
				date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				name: 'PAYROLL DEPOSIT',
				payment_channel: 'other',
				pending: false
			},
			{
				id: 'txn_' + uuidv4().substring(0, 8),
				account_id: '', // Will be set to match first account
				amount: 82.12,
				category: ['Shops', 'Grocery'],
				date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				name: 'Grocery Store XYZ',
				payment_channel: 'in store',
				pending: false
			},
			{
				id: 'txn_' + uuidv4().substring(0, 8),
				account_id: '', // Will be set to match second account
				amount: 500.00,
				category: ['Transfer', 'Deposit'],
				date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				name: 'Transfer to Savings',
				payment_channel: 'other',
				pending: false
			},
			{
				id: 'txn_' + uuidv4().substring(0, 8),
				account_id: '', // Will be set to match third account
				amount: 125.30,
				category: ['Shops', 'Online Shopping'],
				date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				name: 'AMAZON.COM',
				payment_channel: 'online',
				pending: false
			}
		],
		institution: 'Demo Bank',
		lastUpdated: new Date().toISOString(),
		userId: userId // Store user ID with the data for validation
	};

	// State for the financial data
	const [financialData, setFinancialData] = useState(null);

	// State for the active tab
	const [activeTab, setActiveTab] = useState('accounts');

	// State for edit modals
	const [showAccountModal, setShowAccountModal] = useState(false);
	const [showTransactionModal, setShowTransactionModal] = useState(false);
	const [currentAccount, setCurrentAccount] = useState(null);
	const [currentTransaction, setCurrentTransaction] = useState(null);

	// Loading state
	const [loading, setLoading] = useState(false);

	// Initialize with default data or provided initial data - ONCE ONLY
	useEffect(() => {
		// Only run this effect if data isn't initialized and component is visible
		if (!isInitialized.current && isVisible) {
			setLoading(true);
			console.log(`Initializing direct data for user ${userId}`);
			isInitialized.current = true;

			// If initial data is provided, use it, otherwise use default
			let dataToUse;

			if (initialData) {
				dataToUse = JSON.parse(JSON.stringify(initialData)); // Deep clone
			} else {
				dataToUse = JSON.parse(JSON.stringify(defaultData)); // Deep clone default

				// Set account_id for transactions to match the accounts
				if (dataToUse.accounts.length >= 3 && dataToUse.transactions.length >= 5) {
					dataToUse.transactions[0].account_id = dataToUse.accounts[0].id;
					dataToUse.transactions[1].account_id = dataToUse.accounts[0].id;
					dataToUse.transactions[2].account_id = dataToUse.accounts[0].id;
					dataToUse.transactions[3].account_id = dataToUse.accounts[1].id;
					dataToUse.transactions[4].account_id = dataToUse.accounts[2].id;
				}
			}

			setFinancialData(dataToUse);

			// Notify parent of data change
			if (onDataChange) {
				onDataChange(dataToUse);
			}

			setLoading(false);
		}
	}, [isVisible]); // Only run when visibility changes, not on every render

	// Reset when user changes
	useEffect(() => {
		if (userId && isInitialized.current) {
			// Only reset if user ID changes AND we're already initialized
			console.log(`User changed to ${userId}, resetting direct data`);

			// Reset initialization flag
			isInitialized.current = false;
		}
	}, [userId]);

	// Enhanced handler to update financial data and notify parent
	const updateFinancialData = (newData) => {
		// Ensure we're in direct mode before updating
		if (currentIntegrationMode !== 'direct') {
			console.warn("Attempted to update direct data while in Plaid mode");
			return;
		}

		// Update lastUpdated timestamp
		newData.lastUpdated = new Date().toISOString();

		// Always ensure userId is set correctly
		newData.userId = userId;

		// Update the state
		setFinancialData(newData);

		// Notify parent of data change using a deep copy to prevent reference issues
		if (onDataChange) {
			onDataChange(JSON.parse(JSON.stringify(newData)));
		}
	};

	// Add a useEffect to log mode changes and ensure data isolation
	useEffect(() => {
		if (currentIntegrationMode === 'direct') {
			console.log("DirectDataIntegration: Active in Direct mode");
		} else {
			console.log("DirectDataIntegration: Inactive in Plaid mode");
		}
	}, [currentIntegrationMode]);

	// Handler for opening the account edit modal
	const handleEditAccount = (account) => {
		setCurrentAccount({ ...account });
		setShowAccountModal(true);
	};

	// Handler for opening the transaction edit modal
	const handleEditTransaction = (transaction) => {
		setCurrentTransaction({ ...transaction });
		setShowTransactionModal(true);
	};

	// Handler for saving account changes
	const handleSaveAccount = () => {
		if (!currentAccount) return;

		// Create a deep copy of the financial data
		const newData = JSON.parse(JSON.stringify(financialData));

		// If this is a new account, add it to the array
		if (!currentAccount.id) {
			currentAccount.id = 'acc_' + uuidv4().substring(0, 8);
			newData.accounts.push(currentAccount);
		} else {
			// Otherwise update the existing account
			const index = newData.accounts.findIndex(acc => acc.id === currentAccount.id);
			if (index !== -1) {
				newData.accounts[index] = currentAccount;
			}
		}

		// Update the data
		updateFinancialData(newData);

		// Close the modal
		setShowAccountModal(false);
		setCurrentAccount(null);
	};

	// Handler for saving transaction changes
	const handleSaveTransaction = () => {
		if (!currentTransaction) return;

		// Create a deep copy of the financial data
		const newData = JSON.parse(JSON.stringify(financialData));

		// If this is a new transaction, add it to the array
		if (!currentTransaction.id) {
			currentTransaction.id = 'txn_' + uuidv4().substring(0, 8);
			newData.transactions.push(currentTransaction);
		} else {
			// Otherwise update the existing transaction
			const index = newData.transactions.findIndex(txn => txn.id === currentTransaction.id);
			if (index !== -1) {
				newData.transactions[index] = currentTransaction;
			}
		}

		// Update the data
		updateFinancialData(newData);

		// Close the modal
		setShowTransactionModal(false);
		setCurrentTransaction(null);
	};

	// Handler for deleting an account
	const handleDeleteAccount = (accountId) => {
		if (window.confirm('Are you sure you want to delete this account? This will also delete all associated transactions.')) {
			// Create a deep copy of the financial data
			const newData = JSON.parse(JSON.stringify(financialData));

			// Remove the account
			newData.accounts = newData.accounts.filter(acc => acc.id !== accountId);

			// Remove associated transactions
			newData.transactions = newData.transactions.filter(txn => txn.account_id !== accountId);

			// Update the data
			updateFinancialData(newData);
		}
	};

	// Handler for deleting a transaction
	const handleDeleteTransaction = (transactionId) => {
		if (window.confirm('Are you sure you want to delete this transaction?')) {
			// Create a deep copy of the financial data
			const newData = JSON.parse(JSON.stringify(financialData));

			// Remove the transaction
			newData.transactions = newData.transactions.filter(txn => txn.id !== transactionId);

			// Update the data
			updateFinancialData(newData);
		}
	};

	// Handler for adding a new account
	const handleAddAccount = () => {
		setCurrentAccount({
			id: '',
			name: 'New Account',
			type: 'depository',
			subtype: 'checking',
			balances: {
				available: 0,
				current: 0,
				limit: null,
				isoCurrencyCode: 'USD',
			},
			mask: '0000'
		});
		setShowAccountModal(true);
	};

	// Handler for adding a new transaction
	const handleAddTransaction = () => {
		// Check if there are any accounts first
		if (!financialData?.accounts?.length) {
			alert('Please add an account first before adding transactions.');
			return;
		}

		setCurrentTransaction({
			id: '',
			account_id: financialData.accounts[0].id, // Default to first account
			amount: 0,
			category: ['Uncategorized'],
			date: new Date().toISOString().split('T')[0],
			name: 'New Transaction',
			payment_channel: 'other',
			pending: false
		});
		setShowTransactionModal(true);
	};

	// Handler for resetting to default data
	const handleResetData = () => {
		if (window.confirm('Are you sure you want to reset all data to default values? This cannot be undone.')) {
			// Reset to default data
			const resetData = JSON.parse(JSON.stringify(defaultData));

			// Set account_id for transactions to match the accounts
			if (resetData.accounts.length >= 3 && resetData.transactions.length >= 5) {
				resetData.transactions[0].account_id = resetData.accounts[0].id;
				resetData.transactions[1].account_id = resetData.accounts[0].id;
				resetData.transactions[2].account_id = resetData.accounts[0].id;
				resetData.transactions[3].account_id = resetData.accounts[1].id;
				resetData.transactions[4].account_id = resetData.accounts[2].id;
			}

			// Update data
			updateFinancialData(resetData);
		}
	};

	// Render account edit modal
	const renderAccountModal = () => (
		<Modal show={showAccountModal} onHide={() => setShowAccountModal(false)}>
			<Modal.Header closeButton>
				<Modal.Title>{currentAccount?.id ? 'Edit Account' : 'Add Account'}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Form>
					<Form.Group className="mb-3">
						<Form.Label>Account Name</Form.Label>
						<Form.Control
							type="text"
							value={currentAccount?.name || ''}
							onChange={(e) => setCurrentAccount({ ...currentAccount, name: e.target.value })}
						/>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Account Type</Form.Label>
						<Form.Select
							value={currentAccount?.type || 'depository'}
							onChange={(e) => setCurrentAccount({ ...currentAccount, type: e.target.value })}
						>
							<option value="depository">Depository</option>
							<option value="credit">Credit</option>
							<option value="loan">Loan</option>
							<option value="investment">Investment</option>
							<option value="other">Other</option>
						</Form.Select>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Account Subtype</Form.Label>
						<Form.Control
							type="text"
							value={currentAccount?.subtype || ''}
							onChange={(e) => setCurrentAccount({ ...currentAccount, subtype: e.target.value })}
							placeholder="checking, savings, credit card, etc."
						/>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Current Balance</Form.Label>
						<InputGroup>
							<InputGroup.Text>$</InputGroup.Text>
							<Form.Control
								type="number"
								step="0.01"
								value={currentAccount?.balances?.current || 0}
								onChange={(e) => setCurrentAccount({
									...currentAccount,
									balances: {
										...currentAccount.balances,
										current: parseFloat(e.target.value) || 0,
										available: currentAccount.type === 'credit' ?
											(currentAccount.balances.limit || 0) - parseFloat(e.target.value) || 0 :
											parseFloat(e.target.value) || 0
									}
								})}
							/>
						</InputGroup>
					</Form.Group>

					{currentAccount?.type === 'credit' && (
						<Form.Group className="mb-3">
							<Form.Label>Credit Limit</Form.Label>
							<InputGroup>
								<InputGroup.Text>$</InputGroup.Text>
								<Form.Control
									type="number"
									step="0.01"
									value={currentAccount?.balances?.limit || 0}
									onChange={(e) => setCurrentAccount({
										...currentAccount,
										balances: {
											...currentAccount.balances,
											limit: parseFloat(e.target.value) || 0,
											available: parseFloat(e.target.value) - (currentAccount.balances.current || 0) || 0
										}
									})}
								/>
							</InputGroup>
						</Form.Group>
					)}

					<Form.Group className="mb-3">
						<Form.Label>Last 4 Digits</Form.Label>
						<Form.Control
							type="text"
							maxLength="4"
							value={currentAccount?.mask || ''}
							onChange={(e) => {
								const mask = e.target.value.replace(/[^0-9]/g, '').substring(0, 4);
								setCurrentAccount({ ...currentAccount, mask });
							}}
							placeholder="1234"
						/>
					</Form.Group>
				</Form>
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => setShowAccountModal(false)}>
					Cancel
				</Button>
				<Button variant="success" onClick={handleSaveAccount}>
					Save
				</Button>
			</Modal.Footer>
		</Modal>
	);

	// Render transaction edit modal
	const renderTransactionModal = () => (
		<Modal show={showTransactionModal} onHide={() => setShowTransactionModal(false)}>
			<Modal.Header closeButton>
				<Modal.Title>{currentTransaction?.id ? 'Edit Transaction' : 'Add Transaction'}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Form>
					<Form.Group className="mb-3">
						<Form.Label>Account</Form.Label>
						<Form.Select
							value={currentTransaction?.account_id || ''}
							onChange={(e) => setCurrentTransaction({ ...currentTransaction, account_id: e.target.value })}
						>
							{financialData?.accounts.map(account => (
								<option key={account.id} value={account.id}>
									{account.name} (****{account.mask})
								</option>
							))}
						</Form.Select>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Transaction Name/Description</Form.Label>
						<Form.Control
							type="text"
							value={currentTransaction?.name || ''}
							onChange={(e) => setCurrentTransaction({ ...currentTransaction, name: e.target.value })}
						/>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Amount (negative for expenses, positive for income)</Form.Label>
						<InputGroup>
							<InputGroup.Text>$</InputGroup.Text>
							<Form.Control
								type="number"
								step="0.01"
								value={currentTransaction?.amount || 0}
								onChange={(e) => setCurrentTransaction({ ...currentTransaction, amount: parseFloat(e.target.value) || 0 })}
							/>
						</InputGroup>
						<Form.Text className="text-muted">
							Use negative values for expenses (e.g., -50.25) and positive values for income/deposits (e.g., 1000.00)
						</Form.Text>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Date</Form.Label>
						<Form.Control
							type="date"
							value={currentTransaction?.date || new Date().toISOString().split('T')[0]}
							onChange={(e) => setCurrentTransaction({ ...currentTransaction, date: e.target.value })}
						/>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Category</Form.Label>
						<Form.Control
							type="text"
							value={currentTransaction?.category?.join(', ') || ''}
							onChange={(e) => setCurrentTransaction({
								...currentTransaction,
								category: e.target.value.split(',').map(cat => cat.trim()).filter(cat => cat)
							})}
							placeholder="e.g. Food and Drink, Restaurants"
						/>
						<Form.Text className="text-muted">
							Separate multiple categories with commas
						</Form.Text>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Label>Payment Channel</Form.Label>
						<Form.Select
							value={currentTransaction?.payment_channel || 'other'}
							onChange={(e) => setCurrentTransaction({ ...currentTransaction, payment_channel: e.target.value })}
						>
							<option value="online">Online</option>
							<option value="in store">In Store</option>
							<option value="other">Other</option>
						</Form.Select>
					</Form.Group>

					<Form.Group className="mb-3">
						<Form.Check
							type="checkbox"
							label="Pending"
							checked={currentTransaction?.pending || false}
							onChange={(e) => setCurrentTransaction({ ...currentTransaction, pending: e.target.checked })}
						/>
					</Form.Group>
				</Form>
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => setShowTransactionModal(false)}>
					Cancel
				</Button>
				<Button variant="success" onClick={handleSaveTransaction}>
					Save
				</Button>
			</Modal.Footer>
		</Modal>
	);

	// If the component isn't visible or data is loading, don't render
	if (!isVisible || loading || !financialData) {
		return isVisible ? (
			<div className="d-flex justify-content-center align-items-center p-4">
				<Spinner animation="border" variant="success" />
			</div>
		) : null;
	}

	return (
		<div className="direct-data-sidebar">
			<Card style={{ backgroundColor: '#000', borderColor: '#333' }}>
				<Card.Header className="d-flex justify-content-between align-items-center"
					style={{ backgroundColor: '#000', borderBottom: '1px solid #333' }}>
					<span className="text-white">
						<i className="bi bi-database me-2"></i>
						Simulated Financial Data
					</span>
					<Button
						variant="outline-danger"
						size="sm"
						onClick={handleResetData}
						title="Reset to default data"
					>
						<i className="bi bi-arrow-clockwise me-1"></i>
						Reset
					</Button>
				</Card.Header>
				<Card.Body style={{ backgroundColor: '#000', color: 'white' }}>
					<p className="small mb-3 text-white">
						This is simulated financial data that you can edit and use to test the Banking Intelligence API.
						Your changes will persist during your session but will not affect real financial accounts.
					</p>

					<Tabs
						activeKey={activeTab}
						onSelect={(key) => setActiveTab(key)}
						className="mb-3 financial-data-tabs"
					>
						<Tab eventKey="accounts" title="Accounts">
							<div className="d-flex justify-content-end mb-2">
								<Button
									variant="success"
									size="sm"
									onClick={handleAddAccount}
								>
									<i className="bi bi-plus-circle me-1"></i>
									Add Account
								</Button>
							</div>

							{financialData.accounts.length === 0 ? (
								<Alert variant="info">
									No accounts available. Click "Add Account" to create one.
								</Alert>
							) : (
								<div className="table-responsive">
									<Table variant="dark" size="sm" className="accounts-table">
										<thead>
											<tr>
												<th>Name</th>
												<th>Type</th>
												<th>Balance</th>
												<th>Actions</th>
											</tr>
										</thead>
										<tbody>
											{financialData.accounts.map(account => (
												<tr key={account.id}>
													<td className="text-white">{account.name}</td>
													<td className="text-white">
														{account.type}{account.subtype ? ` (${account.subtype})` : ''}
													</td>
													<td className="text-white">
														${account.balances.current.toFixed(2)}
														{account.type === 'credit' && account.balances.limit && (
															<span className="text-muted small ms-1">
																/ ${account.balances.limit.toFixed(2)}
															</span>
														)}
													</td>
													<td>
														<Button
															variant="outline-light"
															size="sm"
															className="me-1 btn-xs"
															onClick={() => handleEditAccount(account)}
														>
															<i className="bi bi-pencil"></i>
														</Button>
														<Button
															variant="outline-danger"
															size="sm"
															className="btn-xs"
															onClick={() => handleDeleteAccount(account.id)}
														>
															<i className="bi bi-trash"></i>
														</Button>
													</td>
												</tr>
											))}
										</tbody>
									</Table>
								</div>
							)}
						</Tab>

						<Tab eventKey="transactions" title="Transactions">
							<div className="d-flex justify-content-end mb-2">
								<Button
									variant="success"
									size="sm"
									onClick={handleAddTransaction}
									disabled={financialData.accounts.length === 0}
								>
									<i className="bi bi-plus-circle me-1"></i>
									Add Transaction
								</Button>
							</div>

							{financialData.accounts.length === 0 ? (
								<Alert variant="warning">
									Please add at least one account before adding transactions.
								</Alert>
							) : financialData.transactions.length === 0 ? (
								<Alert variant="info">
									No transactions available. Click "Add Transaction" to create one.
								</Alert>
							) : (
								<div className="table-responsive">
									<Table variant="dark" size="sm" className="transactions-table">
										<thead>
											<tr>
												<th>Date</th>
												<th>Description</th>
												<th>Account</th>
												<th>Amount</th>
												<th>Actions</th>
											</tr>
										</thead>
										<tbody>
											{financialData.transactions
												.sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
												.map(transaction => {
													const account = financialData.accounts.find(acc => acc.id === transaction.account_id);
													return (
														<tr key={transaction.id}>
															<td className="text-white">{transaction.date}</td>
															<td className="text-white">
																{transaction.name}
																{transaction.pending && (
																	<span className="badge bg-warning text-dark ms-1">Pending</span>
																)}
															</td>
															<td className="text-white">{account ? account.name : 'Unknown Account'}</td>
															<td className={transaction.amount < 0 ? 'text-danger' : 'text-success'}>
																${Math.abs(transaction.amount).toFixed(2)}
															</td>
															<td>
																<Button
																	variant="outline-light"
																	size="sm"
																	className="me-1 btn-xs"
																	onClick={() => handleEditTransaction(transaction)}
																>
																	<i className="bi bi-pencil"></i>
																</Button>
																<Button
																	variant="outline-danger"
																	size="sm"
																	className="btn-xs"
																	onClick={() => handleDeleteTransaction(transaction.id)}
																>
																	<i className="bi bi-trash"></i>
																</Button>
															</td>
														</tr>
													);
												})}
										</tbody>
									</Table>
								</div>
							)}
						</Tab>
					</Tabs>
				</Card.Body>
				<Card.Footer className="text-white small" style={{ backgroundColor: '#000', borderTop: '1px solid #333' }}>
					<div className="d-flex justify-content-between align-items-center">
						<span>Institution: {financialData.institution}</span>
						<span>Last Updated: {new Date(financialData.lastUpdated).toLocaleString()}</span>
					</div>
				</Card.Footer>
			</Card>

			{/* Render modals */}
			{renderAccountModal()}
			{renderTransactionModal()}
		</div>
	);
};

export default DirectDataIntegration;