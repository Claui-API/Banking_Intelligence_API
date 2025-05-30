// src/components/Profile/AccountSettings.js - Include SecuritySettings component

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import SecuritySettings from '../Account/SecuritySettings';
import logger from '../../utils/logger';

const AccountSettings = () => {
	const { user, logout } = useAuth();

	// Profile state
	const [profileData, setProfileData] = useState({
		name: '',
		email: '',
		company: ''
	});

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	// Load user data
	useEffect(() => {
		if (user) {
			setProfileData({
				name: user.name || '',
				email: user.email || '',
				company: user.company || ''
			});
		}
	}, [user]);

	// Handle profile update
	const handleProfileUpdate = async (e) => {
		e.preventDefault();

		setLoading(true);
		setError('');
		setSuccess('');

		try {
			// In a real implementation, you would make an API call here
			// to update the user's profile

			// For now, just simulate a successful update
			await new Promise(resolve => setTimeout(resolve, 1000));

			logger.info('Profile updated successfully');
			setSuccess('Profile updated successfully');
		} catch (err) {
			logger.error('Profile update error:', err);
			setError('Failed to update profile');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container>
			<h2 className="text-white mb-4">Account Settings</h2>

			<Row>
				<Col lg={6}>
					<Card className="mb-4">
						<Card.Header>Profile Information</Card.Header>
						<Card.Body>
							{error && <Alert variant="danger">{error}</Alert>}
							{success && <Alert variant="success">{success}</Alert>}

							<Form onSubmit={handleProfileUpdate}>
								<Form.Group className="mb-3">
									<Form.Label>Name</Form.Label>
									<Form.Control
										type="text"
										value={profileData.name}
										onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
										placeholder="Your name"
									/>
								</Form.Group>

								<Form.Group className="mb-3">
									<Form.Label>Email Address</Form.Label>
									<Form.Control
										type="email"
										value={profileData.email}
										onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
										placeholder="Your email"
										readOnly
									/>
									<Form.Text className="text-muted">
										Email address cannot be changed. Contact support for assistance.
									</Form.Text>
								</Form.Group>

								<Form.Group className="mb-3">
									<Form.Label>Company</Form.Label>
									<Form.Control
										type="text"
										value={profileData.company}
										onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
										placeholder="Your company name"
									/>
								</Form.Group>

								<Button
									variant="primary"
									type="submit"
									disabled={loading}
								>
									{loading ? (
										<>
											<Spinner animation="border" size="sm" className="me-2" />
											Saving...
										</>
									) : 'Update Profile'}
								</Button>
							</Form>
						</Card.Body>
					</Card>

					<Card>
						<Card.Header>Account Actions</Card.Header>
						<Card.Body>
							<div className="d-grid gap-2">
								<Button
									variant="outline-primary"
									onClick={() => window.location.href = '/api-tokens'}
								>
									<i className="bi bi-key me-2"></i>
									Manage API Keys
								</Button>

								<Button
									variant="outline-danger"
									onClick={logout}
								>
									<i className="bi bi-box-arrow-right me-2"></i>
									Sign Out
								</Button>
							</div>
						</Card.Body>
					</Card>
				</Col>

				<Col lg={6}>
					{/* Security Settings Component */}
					<SecuritySettings />

					<Card>
						<Card.Header>Connected Services</Card.Header>
						<Card.Body>
							<p>Manage your connected accounts and services.</p>

							<div className="d-flex justify-content-between align-items-center mb-3 p-3 border rounded">
								<div>
									<h5 className="mb-0">Bank Accounts</h5>
									<p className="text-muted mb-0 small">Connect your bank accounts for financial insights</p>
								</div>
								<Button variant="outline-primary" size="sm">
									Configure
								</Button>
							</div>

							<div className="d-flex justify-content-between align-items-center p-3 border rounded">
								<div>
									<h5 className="mb-0">Email Notifications</h5>
									<p className="text-muted mb-0 small">Manage email preferences</p>
								</div>
								<Button variant="outline-primary" size="sm">
									Configure
								</Button>
							</div>
						</Card.Body>
					</Card>
				</Col>
			</Row>
		</Container>
	);
};

export default AccountSettings;