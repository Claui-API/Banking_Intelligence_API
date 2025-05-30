// src/components/Account/SecuritySettings.js
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Tab, Tabs, Spinner, Modal, Badge, Form } from 'react-bootstrap';
import { authService } from '../../services/auth';
import TwoFactorSetup from '../Auth/TwoFactorSetup';
import logger from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';

const SecuritySettings = () => {
	const { user, updateUser2FAStatus } = useAuth();
	const [activeTab, setActiveTab] = useState('password');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
	const [showSetupModal, setShowSetupModal] = useState(false);
	const [showDisableModal, setShowDisableModal] = useState(false);
	const [verificationCode, setVerificationCode] = useState('');
	const [disableLoading, setDisableLoading] = useState(false);

	// Password change fields
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [passwordLoading, setPasswordLoading] = useState(false);

	// Fetch user 2FA status
	useEffect(() => {
		const fetch2FAStatus = async () => {
			try {
				setLoading(true);

				// Use the user object from context
				setTwoFactorEnabled(user?.twoFactorEnabled || false);
				logger.info(`User 2FA status loaded: ${user?.twoFactorEnabled ? 'enabled' : 'disabled'}`);

			} catch (error) {
				logger.error('Error fetching 2FA status:', error);
				setError('Could not fetch security settings');
			} finally {
				setLoading(false);
			}
		};

		if (user) {
			fetch2FAStatus();
		}
	}, [user]);

	// Handle password change
	const handlePasswordChange = async (e) => {
		e.preventDefault();

		// Reset messages
		setError('');
		setSuccess('');

		// Validate passwords
		if (!currentPassword) {
			setError('Current password is required');
			return;
		}

		if (!newPassword) {
			setError('New password is required');
			return;
		}

		if (newPassword.length < 8) {
			setError('New password must be at least 8 characters long');
			return;
		}

		if (newPassword !== confirmPassword) {
			setError('New password and confirmation do not match');
			return;
		}

		try {
			setPasswordLoading(true);

			await authService.changePassword(currentPassword, newPassword);

			// Clear form fields
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');

			setSuccess('Password changed successfully');
		} catch (error) {
			logger.error('Password change error:', error);
			setError(error.message || 'Failed to change password');
		} finally {
			setPasswordLoading(false);
		}
	};

	// Handle enabling 2FA
	const handleEnable2FA = () => {
		// Reset messages
		setError('');
		setSuccess('');
		setShowSetupModal(true);
	};

	// Handle 2FA setup completion
	const handleSetupComplete = () => {
		setTwoFactorEnabled(true);
		setShowSetupModal(false);
		setSuccess('Two-factor authentication enabled successfully');

		// Update the user context with the new 2FA status
		if (updateUser2FAStatus) {
			updateUser2FAStatus(true);
		}
	};

	// Handle 2FA setup cancellation
	const handleSetupCancel = () => {
		setShowSetupModal(false);
	};

	// Handle disabling 2FA
	const handleDisable2FA = async () => {
		try {
			setDisableLoading(true);

			await authService.disable2FA(verificationCode);

			setTwoFactorEnabled(false);
			setShowDisableModal(false);
			setVerificationCode('');
			setSuccess('Two-factor authentication disabled successfully');

			// Update the user context with the new 2FA status
			if (updateUser2FAStatus) {
				updateUser2FAStatus(false);
			}
		} catch (error) {
			logger.error('Error disabling 2FA:', error);
			setError(error.message || 'Failed to disable 2FA');
		} finally {
			setDisableLoading(false);
		}
	};

	return (
		<Card className="mb-4">
			<Card.Header>Security Settings</Card.Header>
			<Card.Body>
				{error && <Alert variant="danger">{error}</Alert>}
				{success && <Alert variant="success">{success}</Alert>}

				<Tabs
					id="security-settings-tabs"
					activeKey={activeTab}
					onSelect={setActiveTab}
					className="mb-4"
				>
					<Tab eventKey="password" title="Password">
						<form onSubmit={handlePasswordChange}>
							<div className="mb-3">
								<label htmlFor="current-password" className="form-label">Current Password</label>
								<input
									type="password"
									className="form-control"
									id="current-password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									required
								/>
							</div>

							<div className="mb-3">
								<label htmlFor="new-password" className="form-label">New Password</label>
								<input
									type="password"
									className="form-control"
									id="new-password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									required
									minLength={8}
								/>
								<div className="form-text">
									Password must be at least 8 characters long
								</div>
							</div>

							<div className="mb-3">
								<label htmlFor="confirm-password" className="form-label">Confirm New Password</label>
								<input
									type="password"
									className="form-control"
									id="confirm-password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									required
								/>
							</div>

							<Button
								type="submit"
								variant="primary"
								disabled={passwordLoading}
							>
								{passwordLoading ? (
									<>
										<Spinner animation="border" size="sm" className="me-2" />
										Changing Password...
									</>
								) : 'Change Password'}
							</Button>
						</form>
					</Tab>

					<Tab eventKey="2fa" title="Two-Factor Authentication">
						<div className="mb-4">
							<h5>Two-Factor Authentication (2FA)</h5>
							{loading ? (
								<div className="text-center">
									<Spinner animation="border" size="sm" />
									<p className="mt-2">Loading 2FA status...</p>
								</div>
							) : (
								<>
									<p>
										Two-factor authentication adds an extra layer of security to your account.
										When enabled, you'll need to provide a verification code from your authenticator app
										in addition to your password when signing in.
									</p>

									<div className="d-flex align-items-center mb-3">
										<div className="me-3">
											<span className="fw-bold">Status: </span>
											{twoFactorEnabled ? (
												<Badge bg="success">Enabled</Badge>
											) : (
												<Badge bg="secondary">Disabled</Badge>
											)}
										</div>

										{twoFactorEnabled ? (
											<Button
												variant="danger"
												onClick={() => setShowDisableModal(true)}
											>
												Disable 2FA
											</Button>
										) : (
											<Button
												variant="primary"
												onClick={handleEnable2FA}
											>
												Enable 2FA
											</Button>
										)}
									</div>

									{twoFactorEnabled && (
										<Alert variant="info">
											<i className="bi bi-info-circle me-2"></i>
											If you lose access to your authenticator app, you can use one of your backup codes
											to sign in. Make sure to keep them in a safe place!
										</Alert>
									)}
								</>
							)}
						</div>
					</Tab>
				</Tabs>
			</Card.Body>

			{/* 2FA Setup Modal */}
			<Modal
				show={showSetupModal}
				onHide={() => setShowSetupModal(false)}
				backdrop="static"
				keyboard={false}
				size="lg"
				centered
			>
				<Modal.Header closeButton>
					<Modal.Title>Set Up Two-Factor Authentication</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<TwoFactorSetup
						onComplete={handleSetupComplete}
						onCancel={handleSetupCancel}
					/>
				</Modal.Body>
			</Modal>

			{/* 2FA Disable Modal */}
			<Modal
				show={showDisableModal}
				onHide={() => setShowDisableModal(false)}
				backdrop="static"
				keyboard={false}
				centered
			>
				<Modal.Header closeButton>
					<Modal.Title>Disable Two-Factor Authentication</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{error && <Alert variant="danger">{error}</Alert>}

					<p>
						For security reasons, please enter a verification code from your authenticator app
						to disable two-factor authentication.
					</p>

					<div className="mb-3">
						<label htmlFor="verification-code" className="form-label">Verification Code</label>
						<input
							type="text"
							className="form-control"
							id="verification-code"
							value={verificationCode}
							onChange={(e) => setVerificationCode(e.target.value)}
							placeholder="Enter 6-digit code"
							maxLength={6}
							inputMode="numeric"
							pattern="[0-9]*"
						/>
					</div>

					<Alert variant="warning">
						<i className="bi bi-exclamation-triangle me-2"></i>
						<strong>Warning:</strong> Disabling two-factor authentication will make your account less secure.
					</Alert>
				</Modal.Body>
				<Modal.Footer>
					<Button
						variant="secondary"
						onClick={() => {
							setShowDisableModal(false);
							setError('');
						}}
						disabled={disableLoading}
					>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleDisable2FA}
						disabled={disableLoading || !verificationCode}
					>
						{disableLoading ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Disabling...
							</>
						) : 'Disable 2FA'}
					</Button>
				</Modal.Footer>
			</Modal>
		</Card>
	);
};

export default SecuritySettings;