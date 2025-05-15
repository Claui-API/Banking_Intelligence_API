// src/components/Account/DataRetention.js - Fixed API routes
import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger';

/**
 * Component for managing data retention settings in user account
 */
const DataRetention = () => {
	// Auth context
	const { user } = useAuth();

	// State for retention settings
	const [settings, setSettings] = useState({
		transactionRetentionDays: 730,
		insightRetentionDays: 365,
		emailNotifications: true,
		analyticalDataUse: true
	});

	// UI state
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);

	// Load current retention settings
	useEffect(() => {
		const fetchSettings = async () => {
			try {
				setLoading(true);

				// Call API to get current settings - Updated to use correct API path
				const response = await api.get('/v1/data/retention-settings');

				if (response.data && response.data.success) {
					setSettings(response.data.data.settings);
				} else {
					logger.warn('Failed to load retention settings, using defaults');
				}
			} catch (err) {
				logger.error('Error loading retention settings:', err);
				setError('Failed to load your data retention settings');
			} finally {
				setLoading(false);
			}
		};

		if (user) {
			fetchSettings();
		}
	}, [user]);

	// Handle settings change
	const handleSettingsChange = (field, value) => {
		setSettings(prev => ({
			...prev,
			[field]: value
		}));
	};

	// Save settings
	const handleSaveSettings = async () => {
		try {
			setSaving(true);
			setError('');
			setSuccess('');

			// Call API to save settings - Updated to use correct API path
			const response = await api.put('/v1/data/retention-settings', settings);

			if (response.data && response.data.success) {
				setSuccess('Data retention settings updated successfully');
			} else {
				throw new Error(response.data?.message || 'Failed to update settings');
			}
		} catch (err) {
			logger.error('Error saving retention settings:', err);
			setError(err.message || 'Failed to update data retention settings');
		} finally {
			setSaving(false);
		}
	};

	// Handle data export
	const handleExportData = async () => {
		try {
			setExportLoading(true);

			logger.info('Starting data export');

			// Create a download through an API call - Updated to use correct API path
			window.location.href = `${api.defaults.baseURL}/v1/data/export`;

			// Close modal after a short delay
			setTimeout(() => {
				setShowExportModal(false);
				setExportLoading(false);
			}, 1000);
		} catch (err) {
			logger.error('Error exporting data:', err);
			setError('Failed to export your data');
			setExportLoading(false);
		}
	};

	// Handle account deletion request
	const handleAccountDeletion = async () => {
		try {
			setLoading(true);

			// Call API to request account closure - Updated to use correct API path
			const response = await api.post('/v1/data/close-account');

			if (response.data && response.data.success) {
				setSuccess('Your account closure has been initiated. Your account will be fully deleted after 30 days.');
				setShowDeleteModal(false);
			} else {
				throw new Error(response.data?.message || 'Failed to initiate account closure');
			}
		} catch (err) {
			logger.error('Error initiating account closure:', err);
			setError(err.message || 'Failed to initiate account closure');
		} finally {
			setLoading(false);
			setShowDeleteModal(false);
		}
	};

	return (
		<Card>
			<Card.Header>Data Management & Retention</Card.Header>
			<Card.Body>
				{error && <Alert variant="danger">{error}</Alert>}
				{success && <Alert variant="success">{success}</Alert>}

				{loading ? (
					<div className="text-center py-4">
						<Spinner animation="border" variant="primary" />
						<p className="mt-3">Loading your data settings...</p>
					</div>
				) : (
					<>
						<h5 className="mb-4">Data Retention Preferences</h5>

						<Form>
							<Form.Group className="mb-4">
								<Form.Label>Transaction History</Form.Label>
								<Form.Select
									className="bg-white"
									value={settings.transactionRetentionDays}
									onChange={(e) => handleSettingsChange('transactionRetentionDays', parseInt(e.target.value))}
								>
									<option value="90">3 months</option>
									<option value="180">6 months</option>
									<option value="365">1 year</option>
									<option value="730">2 years (default)</option>
								</Form.Select>
								<Form.Text className="text-muted">
									How long we store your transaction history.
								</Form.Text>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Label>Financial Insights</Form.Label>
								<Form.Select
									className="bg-white"
									value={settings.insightRetentionDays}
									onChange={(e) => handleSettingsChange('insightRetentionDays', parseInt(e.target.value))}
								>
									<option value="90">3 months</option>
									<option value="180">6 months</option>
									<option value="365">1 year (default)</option>
									<option value="730">2 years</option>
								</Form.Select>
								<Form.Text className="text-muted">
									How long we store your AI-generated financial insights.
								</Form.Text>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Check
									type="switch"
									id="email-notifications"
									label="Email Notifications"
									checked={settings.emailNotifications}
									onChange={(e) => handleSettingsChange('emailNotifications', e.target.checked)}
								/>
								<Form.Text className="text-muted">
									Receive email notifications about data retention, including account inactivity warnings.
								</Form.Text>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Check
									type="switch"
									id="analytical-data"
									label="Allow Anonymized Data for Insights Improvement"
									checked={settings.analyticalDataUse}
									onChange={(e) => handleSettingsChange('analyticalDataUse', e.target.checked)}
								/>
								<Form.Text className="text-muted">
									Allow us to use anonymized data to improve our AI insights engine. No personally identifiable information is used.
								</Form.Text>
							</Form.Group>

							<Button
								variant="primary"
								onClick={handleSaveSettings}
								disabled={saving}
							>
								{saving ? (
									<>
										<Spinner animation="border" size="sm" className="me-2" />
										Saving...
									</>
								) : 'Save Preferences'}
							</Button>
						</Form>

						<hr className="my-4" />

						<h5 className="mb-4">Your Data Controls</h5>

						<div className="d-flex flex-column gap-3">
							<Button
								variant="outline-primary"
								onClick={() => setShowExportModal(true)}
							>
								<i className="bi bi-download me-2"></i>
								Export Your Data
							</Button>

							<Button
								variant="outline-danger"
								onClick={() => setShowDeleteModal(true)}
							>
								<i className="bi bi-trash me-2"></i>
								Close Account & Delete Data
							</Button>
						</div>

						<Alert variant="info" className="mt-4">
							<h6>How We Handle Your Data</h6>
							<p className="mb-0">
								We retain your data according to our <a href="/privacy-policy">data retention policy</a>.
								Inactive accounts receive a warning after 12 months and are automatically deleted after 15 months of inactivity.
							</p>
						</Alert>
					</>
				)}
			</Card.Body>

			{/* Data Export Modal */}
			<Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Export Your Data</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p>
						This will download a complete copy of your data, including:
					</p>
					<ul>
						<li>Account information</li>
						<li>Connected bank account details</li>
						<li>Transaction history</li>
						<li>Generated financial insights</li>
					</ul>
					<p className="mb-0">
						The data will be exported in JSON format.
					</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowExportModal(false)} disabled={exportLoading}>
						Cancel
					</Button>
					<Button variant="primary" onClick={handleExportData} disabled={exportLoading}>
						{exportLoading ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Exporting...
							</>
						) : 'Download Data'}
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Account Deletion Modal */}
			<Modal
				show={showDeleteModal}
				onHide={() => setShowDeleteModal(false)}
				backdrop="static"
				keyboard={false}
				centered
			>
				<Modal.Header closeButton>
					<Modal.Title className="text-danger">Close Account</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Alert variant="danger">
						<i className="bi bi-exclamation-triangle-fill me-2"></i>
						<strong>Warning:</strong> This action cannot be undone after the grace period.
					</Alert>

					<p>
						This will initiate the account closure process. Here's what happens:
					</p>

					<ol>
						<li>Your account will be immediately deactivated</li>
						<li>All API access will be revoked</li>
						<li>You'll have a 30-day grace period to reactivate your account</li>
						<li>After the grace period, all your data will be permanently deleted</li>
					</ol>

					<p className="mb-0 fw-bold">
						Are you sure you want to close your account?
					</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleAccountDeletion}
						disabled={loading}
					>
						{loading ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Processing...
							</>
						) : 'Close Account'}
					</Button>
				</Modal.Footer>
			</Modal>
		</Card>
	);
};

export default DataRetention;