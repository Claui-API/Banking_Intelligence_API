// src/components/Admin/EmailMonitoringTab.js - Enhanced version
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Alert, Button, Modal, Form, Spinner, Toast, ToastContainer, Nav } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { adminService } from '../../services/admin';
import logger from '../../utils/logger';
import "./EmailMonitoringTab.css";

const EmailMonitoringTab = () => {
	const [emailStats, setEmailStats] = useState(null);
	const [suppressedEmails, setSuppressedEmails] = useState([]);
	const [contactFormStats, setContactFormStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [showReactivateModal, setShowReactivateModal] = useState(false);
	const [selectedEmail, setSelectedEmail] = useState('');
	const [reactivating, setReactivating] = useState(false);
	const [toastMessage, setToastMessage] = useState({ show: false, type: '', message: '' });
	const [showTestModal, setShowTestModal] = useState(false);
	const [testEmail, setTestEmail] = useState('');
	const [sendingTest, setSendingTest] = useState(false);

	// New state for modals and details
	const [showDetailsModal, setShowDetailsModal] = useState(false);
	const [detailsModalData, setDetailsModalData] = useState(null);
	const [detailsModalType, setDetailsModalType] = useState('');
	const [activeTab, setActiveTab] = useState('overview');
	const [timeRange, setTimeRange] = useState(7); // days

	useEffect(() => {
		fetchEmailData();
		// Refresh every 5 minutes
		const interval = setInterval(fetchEmailData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [timeRange]);

	const fetchEmailData = async () => {
		try {
			setLoading(true);

			// Fetch email statistics
			const statsResponse = await adminService.getEmailStats();
			setEmailStats(statsResponse);

			// Fetch suppressed emails
			const suppressedResponse = await adminService.getSuppressedEmails();
			setSuppressedEmails(suppressedResponse.emails || []);

			// Fetch contact form statistics with time range
			const contactResponse = await adminService.getContactFormStats(timeRange);
			setContactFormStats(contactResponse);

		} catch (error) {
			logger.error('Error fetching email data:', error);
			showToast('error', 'Failed to load email monitoring data');
		} finally {
			setLoading(false);
		}
	};

	const showToast = (type, message) => {
		setToastMessage({ show: true, type, message });
		setTimeout(() => {
			setToastMessage({ show: false, type: '', message: '' });
		}, 5000);
	};

	const handleReactivateEmail = async () => {
		if (!selectedEmail) return;

		try {
			setReactivating(true);
			await adminService.reactivateEmail(selectedEmail);
			await fetchEmailData();
			setShowReactivateModal(false);
			showToast('success', `Successfully reactivated ${selectedEmail}`);
		} catch (error) {
			logger.error('Error reactivating email:', error);
			showToast('error', 'Failed to reactivate email address');
		} finally {
			setReactivating(false);
		}
	};

	const handleSendTestEmail = async () => {
		if (!testEmail) return;

		try {
			setSendingTest(true);
			await adminService.sendTestEmail(testEmail);
			setShowTestModal(false);
			setTestEmail('');
			showToast('success', `Test email sent to ${testEmail}`);
		} catch (error) {
			logger.error('Error sending test email:', error);
			showToast('error', 'Failed to send test email');
		} finally {
			setSendingTest(false);
		}
	};

	const handleShowDetails = (type, data) => {
		setDetailsModalType(type);
		setDetailsModalData(data);
		setShowDetailsModal(true);
	};

	const getReasonBadgeColor = (reason) => {
		switch (reason) {
			case 'bounce': return 'danger';
			case 'complaint': return 'warning';
			case 'unsubscribe': return 'secondary';
			case 'manual': return 'info';
			default: return 'light';
		}
	};

	const getStatusBadgeColor = (status) => {
		switch (status) {
			case 'success': return 'success';
			case 'partial_success': return 'warning';
			case 'failed': return 'danger';
			case 'spam_blocked': return 'danger';
			case 'rate_limited': return 'warning';
			case 'validation_failed': return 'secondary';
			default: return 'light';
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	};

	const formatDateTime = (dateString) => {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	};

	const calculateHealthScore = () => {
		if (!emailStats) return 0;

		const bounceRate = emailStats.bounce_rate || 0;
		const complaintRate = emailStats.complaint_rate || 0;

		let score = 100;

		// Penalize high bounce rate (AWS SES threshold is 5%)
		if (bounceRate > 5) score -= 30;
		else if (bounceRate > 2) score -= 15;

		// Penalize high complaint rate (AWS SES threshold is 0.1%)
		if (complaintRate > 0.1) score -= 40;
		else if (complaintRate > 0.05) score -= 20;

		return Math.max(0, score);
	};

	// Prepare chart data
	const prepareHourlyChartData = () => {
		if (!contactFormStats?.hourly_distribution) return [];

		return contactFormStats.hourly_distribution.map(item => ({
			hour: new Date(item.hour).getHours() + ':00',
			submissions: item.submissions,
			time: new Date(item.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
		}));
	};

	const prepareStatusTrendsData = () => {
		if (!contactFormStats?.status_trends) return [];

		// Group by date and sum all statuses
		const groupedByDate = contactFormStats.status_trends.reduce((acc, item) => {
			const date = new Date(item.date).toLocaleDateString();
			if (!acc[date]) {
				acc[date] = { date, success: 0, failed: 0, spam: 0, total: 0 };
			}

			const count = parseInt(item.count);
			acc[date].total += count;

			if (item.status === 'success' || item.status === 'partial_success') {
				acc[date].success += count;
			} else if (item.status === 'failed') {
				acc[date].failed += count;
			} else if (item.status === 'spam_blocked') {
				acc[date].spam += count;
			}

			return acc;
		}, {});

		return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
	};

	const preparePieChartData = () => {
		if (!contactFormStats?.period_stats) return [];

		const stats = contactFormStats.period_stats;
		return [
			{ name: 'Successful', value: stats.successful_sends, color: '#28a745' },
			{ name: 'Partial Success', value: stats.partial_success, color: '#ffc107' },
			{ name: 'Failed', value: stats.failed_sends, color: '#dc3545' },
			{ name: 'Spam Blocked', value: stats.spam_blocked, color: '#6c757d' },
			{ name: 'Rate Limited', value: stats.rate_limited, color: '#fd7e14' },
			{ name: 'Validation Failed', value: stats.validation_failed, color: '#17a2b8' }
		].filter(item => item.value > 0);
	};

	if (loading) {
		return (
			<div className="text-center p-5">
				<Spinner animation="border" variant="success" />
				<p className="mt-3 text-white">Loading email monitoring data...</p>
			</div>
		);
	}

	const healthScore = calculateHealthScore();
	const hourlyChartData = prepareHourlyChartData();
	const statusTrendsData = prepareStatusTrendsData();
	const pieChartData = preparePieChartData();

	return (
		<>
			{/* Navigation Tabs */}
			<Row>
				<Col>
					<Nav variant="pills" className="mb-4">
						<Nav.Item>
							<Nav.Link
								active={activeTab === 'overview'}
								onClick={() => setActiveTab('overview')}
								className="text-white"
							>
								Overview
							</Nav.Link>
						</Nav.Item>
						<Nav.Item>
							<Nav.Link
								active={activeTab === 'analytics'}
								onClick={() => setActiveTab('analytics')}
								className="text-white"
							>
								Analytics
							</Nav.Link>
						</Nav.Item>
						<Nav.Item>
							<Nav.Link
								active={activeTab === 'suppressed'}
								onClick={() => setActiveTab('suppressed')}
								className="text-white"
							>
								Suppressed Emails
							</Nav.Link>
						</Nav.Item>
					</Nav>
				</Col>
			</Row>

			{/* Header Controls */}
			<Row>
				<Col>
					<div className="d-flex justify-content-between align-items-center mb-4">
						<h3 className="text-success mb-0">Email System Monitoring</h3>
						<div className="d-flex gap-2 align-items-center">
							<Form.Select
								size="sm"
								value={timeRange}
								onChange={(e) => setTimeRange(parseInt(e.target.value))}
								className="bg-dark text-white border-secondary"
								style={{ width: 'auto' }}
							>
								<option value={1}>Last 24 hours</option>
								<option value={7}>Last 7 days</option>
								<option value={30}>Last 30 days</option>
								<option value={90}>Last 90 days</option>
							</Form.Select>
							<Button
								variant="outline-success"
								size="sm"
								onClick={() => setShowTestModal(true)}
							>
								<i className="bi bi-envelope-fill me-1"></i>
								Send Test Email
							</Button>
							<Button
								variant="outline-info"
								size="sm"
								onClick={fetchEmailData}
							>
								<i className="bi bi-arrow-clockwise me-1"></i>
								Refresh
							</Button>
						</div>
					</div>
				</Col>
			</Row>

			{/* Overview Tab */}
			{activeTab === 'overview' && (
				<>
					{/* Email Health Score */}
					<Row className="mb-4">
						<Col>
							<Card className="bg-dark text-white border-success">
								<Card.Body>
									<Row className="align-items-center">
										<Col md={6}>
											<h5 className="text-success">Email System Health</h5>
											<div className="d-flex align-items-center">
												<div className="me-3">
													<span style={{ fontSize: '2rem' }}>
														{healthScore >= 90 ? '🟢' : healthScore >= 70 ? '🟡' : '🔴'}
													</span>
												</div>
												<div>
													<h2 className="text-black mb-0">{healthScore}%</h2>
													<p className="text-muted mb-0">
														{healthScore >= 90 ? 'Excellent' :
															healthScore >= 70 ? 'Good' :
																healthScore >= 50 ? 'Warning' : 'Critical'}
													</p>
												</div>
											</div>
										</Col>
										<Col md={6}>
											<Row>
												<Col xs={6}>
													<div className="text-center">
														<h4 className="text-danger mb-1">
															{emailStats?.bounce_rate?.toFixed(2) || '0.00'}%
														</h4>
														<small className="text-muted">Bounce Rate</small>
													</div>
												</Col>
												<Col xs={6}>
													<div className="text-center">
														<h4 className="text-warning mb-1">
															{emailStats?.complaint_rate?.toFixed(3) || '0.000'}%
														</h4>
														<small className="text-muted">Complaint Rate</small>
													</div>
												</Col>
											</Row>
										</Col>
									</Row>
								</Card.Body>
							</Card>
						</Col>
					</Row>

					{/* Statistics Cards */}
					<Row className="mb-4">
						<Col md={3}>
							<Card className="bg-dark text-white border-success">
								<Card.Body className="text-center">
									<h3 className="text-success">{emailStats?.total_sent || 0}</h3>
									<p className="mb-0 text-black">All System Emails (Including SES) (30d)</p>
								</Card.Body>
							</Card>
						</Col>
						<Col md={3}>
							<Card className="bg-dark text-white border-danger">
								<Card.Body className="text-center">
									<h3 className="text-danger">{emailStats?.total_bounces || 0}</h3>
									<p className="mb-0 text-black">Total Bounces</p>
								</Card.Body>
							</Card>
						</Col>
						<Col md={3}>
							<Card className="bg-dark text-white border-warning">
								<Card.Body className="text-center">
									<h3 className="text-warning">{emailStats?.total_complaints || 0}</h3>
									<p className="mb-0 text-black">Total Complaints</p>
								</Card.Body>
							</Card>
						</Col>
						<Col md={3}>
							<Card className="bg-dark text-white border-secondary">
								<Card.Body className="text-center">
									<h3 className="text-secondary">{emailStats?.total_suppressed || 0}</h3>
									<p className="mb-0 text-black">Suppressed Addresses</p>
								</Card.Body>
							</Card>
						</Col>
					</Row>

					{/* Health Alerts */}
					{emailStats && (
						<Row className="mb-4">
							<Col>
								{emailStats.bounce_rate > 5 && (
									<Alert variant="danger">
										<Alert.Heading>
											<i className="bi bi-exclamation-triangle-fill me-2"></i>
											Critical: High Bounce Rate
										</Alert.Heading>
										Your bounce rate is {emailStats.bounce_rate?.toFixed(2)}%. AWS SES may suspend
										your account if this exceeds 5%. Review your email lists and remove invalid addresses.
									</Alert>
								)}
								{emailStats.complaint_rate > 0.1 && (
									<Alert variant="warning">
										<Alert.Heading>
											<i className="bi bi-exclamation-triangle-fill me-2"></i>
											Warning: High Complaint Rate
										</Alert.Heading>
										Your complaint rate is {emailStats.complaint_rate?.toFixed(3)}%. Keep this below
										0.1% to maintain good sender reputation.
									</Alert>
								)}
								{emailStats.bounce_rate <= 2 && emailStats.complaint_rate <= 0.05 && (
									<Alert variant="success">
										<i className="bi bi-check-circle-fill me-2"></i>
										Your email system is operating within healthy parameters.
									</Alert>
								)}
							</Col>
						</Row>
					)}

					{/* Contact Form Statistics */}
					{contactFormStats && (
						<Row className="mb-4">
							<Col>
								<Card className="bg-dark text-white border-info">
									<Card.Header className="d-flex justify-content-between align-items-center">
										<span>Contact Form Statistics (Last {timeRange} Days)</span>
										<Button
											variant="outline-info"
											size="sm"
											onClick={() => handleShowDetails('contact_overview', contactFormStats)}
										>
											<i className="bi bi-eye me-1"></i>
											View Details
										</Button>
									</Card.Header>
									<Card.Body>
										<Row>
											<Col md={3}>
												<div className="text-center">
													<h4 className="text-info">{contactFormStats.period_stats?.total_submissions || 0}</h4>
													<p className="mb-0 text-black">Total Submissions</p>
												</div>
											</Col>
											<Col md={3}>
												<div className="text-center">
													<h4 className="text-success">{contactFormStats.period_stats?.successful_sends || 0}</h4>
													<p className="mb-0 text-black">Successful Sends</p>
												</div>
											</Col>
											<Col md={3}>
												<div className="text-center">
													<h4 className="text-warning">{contactFormStats.period_stats?.spam_blocked || 0}</h4>
													<p className="mb-0 text-black">Spam Blocked</p>
												</div>
											</Col>
											<Col md={3}>
												<div className="text-center">
													<h4 className="text-danger">{contactFormStats.period_stats?.failed_sends || 0}</h4>
													<p className="mb-0 text-black">Failed Sends</p>
												</div>
											</Col>
										</Row>
									</Card.Body>
								</Card>
							</Col>
						</Row>
					)}
				</>
			)}

			{/* Analytics Tab */}
			{activeTab === 'analytics' && contactFormStats && (
				<>
					{/* Charts Row 1 */}
					<Row className="mb-4">
						<Col md={8}>
							<Card className="bg-white text-black border-info">
								<Card.Header>Contact Form Submissions Over Time</Card.Header>
								<Card.Body>
									<ResponsiveContainer width="100%" height={300}>
										<LineChart data={statusTrendsData}>
											<CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
											<XAxis dataKey="date" stroke="#000000" />
											<YAxis stroke="#000000" />
											<Tooltip
												contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', color: '#000' }}
												labelStyle={{ color: '#000000' }}
											/>
											<Legend wrapperStyle={{ color: '#000000' }} />
											<Line type="monotone" dataKey="total" stroke="#17a2b8" name="Total" />
											<Line type="monotone" dataKey="success" stroke="#28a745" name="Successful" />
											<Line type="monotone" dataKey="failed" stroke="#dc3545" name="Failed" />
											<Line type="monotone" dataKey="spam" stroke="#6c757d" name="Spam Blocked" />
										</LineChart>
									</ResponsiveContainer>
								</Card.Body>
							</Card>
						</Col>
						<Col md={4}>
							<Card className="bg-white text-black border-info">
								<Card.Header>Submission Status Distribution</Card.Header>
								<Card.Body>
									<ResponsiveContainer width="100%" height={300}>
										<PieChart>
											<Pie
												data={pieChartData}
												cx="50%"
												cy="50%"
												outerRadius={80}
												dataKey="value"
												label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
											>
												{pieChartData.map((entry, index) => (
													<Cell key={`cell-${index}`} fill={entry.color} />
												))}
											</Pie>
											<Tooltip
												contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', color: '#000' }}
											/>
										</PieChart>
									</ResponsiveContainer>
								</Card.Body>
							</Card>
						</Col>
					</Row>

					{/* Charts Row 2 */}
					<Row className="mb-4">
						<Col md={12}>
							<Card className="bg-white text-black border-info">
								<Card.Header>Hourly Distribution (Last 24 Hours)</Card.Header>
								<Card.Body>
									<ResponsiveContainer width="100%" height={300}>
										<BarChart data={hourlyChartData}>
											<CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
											<XAxis dataKey="hour" stroke="#000000" />
											<YAxis stroke="#000000" />
											<Tooltip
												contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', color: '#000' }}
												labelStyle={{ color: '#000000' }}
											/>
											<Bar dataKey="submissions" fill="#17a2b8" />
										</BarChart>
									</ResponsiveContainer>
								</Card.Body>
							</Card>
						</Col>
					</Row>

					{/* Recent Submissions */}
					{contactFormStats.recent_submissions && (
						<Row className="mb-4">
							<Col>
								<Card className="bg-white text-black border-secondary">
									<Card.Header className="d-flex justify-content-between align-items-center">
										<h5 className="mb-0">Recent Contact Form Submissions</h5>
										<Badge bg="secondary" pill>{contactFormStats.recent_submissions.length}</Badge>
									</Card.Header>
									<Card.Body className="p-0">
										<Table striped bordered hover variant="light" responsive className="mb-0">
											<thead>
												<tr>
													<th>Date</th>
													<th>Name</th>
													<th>Email</th>
													<th>Company</th>
													<th>Status</th>
													<th>Suspicion Score</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{contactFormStats.recent_submissions.map((submission, index) => (
													<tr key={index}>
														<td>{formatDateTime(submission.createdAt)}</td>
														<td className="text-break">{submission.name}</td>
														<td className="text-break">{submission.email}</td>
														<td>{submission.company || 'N/A'}</td>
														<td>
															<Badge bg={getStatusBadgeColor(submission.status)}>
																{submission.status.replace('_', ' ').toUpperCase()}
															</Badge>
														</td>
														<td>
															<Badge bg={submission.suspicionScore > 2 ? 'danger' : submission.suspicionScore > 0 ? 'warning' : 'success'}>
																{submission.suspicionScore}
															</Badge>
														</td>
														<td>
															<Button
																size="sm"
																variant="outline-info"
																onClick={() => handleShowDetails('submission', submission)}
															>
																<i className="bi bi-eye me-1"></i>
																View
															</Button>
														</td>
													</tr>
												))}
											</tbody>
										</Table>
									</Card.Body>
								</Card>
							</Col>
						</Row>
					)}

					{/* Suspicious IPs */}
					{contactFormStats.suspicious_ips && contactFormStats.suspicious_ips.length > 0 && (
						<Row className="mb-4">
							<Col>
								<Card className="bg-dark text-white border-warning">
									<Card.Header>
										<h5 className="mb-0 text-warning">Suspicious IP Addresses</h5>
									</Card.Header>
									<Card.Body className="p-0">
										<Table striped bordered hover variant="dark" responsive className="mb-0">
											<thead>
												<tr>
													<th>IP Address</th>
													<th>Total Submissions</th>
													<th>Avg Suspicion Score</th>
													<th>Spam Count</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{contactFormStats.suspicious_ips.map((ip, index) => (
													<tr key={index}>
														<td className="font-monospace">{ip.ipAddress}</td>
														<td>{ip.submissionCount}</td>
														<td>
															<Badge bg={parseFloat(ip.avgSuspicion) > 3 ? 'danger' : 'warning'}>
																{ip.avgSuspicion}
															</Badge>
														</td>
														<td>{ip.spamCount}</td>
														<td>
															<Button
																size="sm"
																variant="outline-warning"
																onClick={() => handleShowDetails('suspicious_ip', ip)}
															>
																<i className="bi bi-shield-exclamation me-1"></i>
																Details
															</Button>
														</td>
													</tr>
												))}
											</tbody>
										</Table>
									</Card.Body>
								</Card>
							</Col>
						</Row>
					)}
				</>
			)
			}

			{/* Suppressed Emails Tab */}
			{
				activeTab === 'suppressed' && (
					<Row>
						<Col>
							<Card className="bg-dark text-white border-secondary">
								<Card.Header className="d-flex justify-content-between align-items-center">
									<h5 className="mb-0">Suppressed Email Addresses</h5>
									<Badge bg="secondary" pill>{suppressedEmails.length}</Badge>
								</Card.Header>
								<Card.Body className="p-0">
									{suppressedEmails.length === 0 ? (
										<div className="text-center p-4 text-muted">
											<i className="bi bi-check-circle-fill mb-2" style={{ fontSize: '2rem' }}></i>
											<p>No suppressed email addresses found.</p>
										</div>
									) : (
										<Table striped bordered hover variant="dark" responsive className="mb-0">
											<thead>
												<tr>
													<th>Email Address</th>
													<th>Reason</th>
													<th>Source</th>
													<th>Date Added</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{suppressedEmails.map((email, index) => (
													<tr key={index}>
														<td className="text-break">{email.email}</td>
														<td>
															<Badge bg={getReasonBadgeColor(email.reason)}>
																{email.reason.charAt(0).toUpperCase() + email.reason.slice(1)}
															</Badge>
														</td>
														<td>
															<Badge bg="info" className="text-uppercase">
																{email.source}
															</Badge>
														</td>
														<td>{formatDate(email.created_at)}</td>
														<td>
															<div className="d-flex gap-1">
																<Button
																	size="sm"
																	variant="outline-info"
																	onClick={() => handleShowDetails('suppressed_email', email)}
																>
																	<i className="bi bi-eye me-1"></i>
																	View
																</Button>
																<Button
																	size="sm"
																	variant="outline-warning"
																	onClick={() => {
																		setSelectedEmail(email.email);
																		setShowReactivateModal(true);
																	}}
																>
																	<i className="bi bi-arrow-clockwise me-1"></i>
																	Reactivate
																</Button>
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</Table>
									)}
								</Card.Body>
							</Card>
						</Col>
					</Row>
				)
			}

			{/* Details Modal */}
			<Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg" centered>
				<Modal.Header closeButton className="bg-dark text-white border-secondary">
					<Modal.Title>
						{detailsModalType === 'contact_overview' && 'Contact Form Overview'}
						{detailsModalType === 'submission' && 'Submission Details'}
						{detailsModalType === 'suppressed_email' && 'Suppressed Email Details'}
						{detailsModalType === 'suspicious_ip' && 'Suspicious IP Details'}
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="bg-dark text-white">
					{detailsModalData && (
						<>
							{detailsModalType === 'contact_overview' && (
								<div>
									<h6 className="text-info mb-3">Period Statistics ({timeRange} days)</h6>
									<Table variant="dark" striped>
										<tbody>
											<tr>
												<td>Total Submissions</td>
												<td><Badge bg="info">{detailsModalData.period_stats?.total_submissions || 0}</Badge></td>
											</tr>
											<tr>
												<td>Successful Sends</td>
												<td><Badge bg="success">{detailsModalData.period_stats?.successful_sends || 0}</Badge></td>
											</tr>
											<tr>
												<td>Partial Success</td>
												<td><Badge bg="warning">{detailsModalData.period_stats?.partial_success || 0}</Badge></td>
											</tr>
											<tr>
												<td>Failed Sends</td>
												<td><Badge bg="danger">{detailsModalData.period_stats?.failed_sends || 0}</Badge></td>
											</tr>
											<tr>
												<td>Spam Blocked</td>
												<td><Badge bg="secondary">{detailsModalData.period_stats?.spam_blocked || 0}</Badge></td>
											</tr>
											<tr>
												<td>Success Rate</td>
												<td><Badge bg="info">{detailsModalData.period_stats?.success_rate || 0}%</Badge></td>
											</tr>
											<tr>
												<td>Average Processing Time</td>
												<td><Badge bg="info">{detailsModalData.period_stats?.avg_processing_time || 'N/A'}ms</Badge></td>
											</tr>
											<tr>
												<td>Average Suspicion Score</td>
												<td><Badge bg="warning">{detailsModalData.period_stats?.avg_suspicion_score || 'N/A'}</Badge></td>
											</tr>
										</tbody>
									</Table>

									<h6 className="text-info mb-3 mt-4">Today's Statistics</h6>
									<Table variant="dark" striped>
										<tbody>
											<tr>
												<td>Total Submissions Today</td>
												<td><Badge bg="info">{detailsModalData.today_stats?.total_submissions || 0}</Badge></td>
											</tr>
											<tr>
												<td>Successful Sends Today</td>
												<td><Badge bg="success">{detailsModalData.today_stats?.successful_sends || 0}</Badge></td>
											</tr>
											<tr>
												<td>Success Rate Today</td>
												<td><Badge bg="info">{detailsModalData.today_stats?.success_rate || 0}%</Badge></td>
											</tr>
										</tbody>
									</Table>
								</div>
							)}

							{detailsModalType === 'submission' && (
								<div>
									<Table variant="dark" striped>
										<tbody>
											<tr>
												<td><strong>Request ID</strong></td>
												<td><code>{detailsModalData.requestId}</code></td>
											</tr>
											<tr>
												<td><strong>Name</strong></td>
												<td>{detailsModalData.name}</td>
											</tr>
											<tr>
												<td><strong>Email</strong></td>
												<td>{detailsModalData.email}</td>
											</tr>
											<tr>
												<td><strong>Company</strong></td>
												<td>{detailsModalData.company || 'Not provided'}</td>
											</tr>
											<tr>
												<td><strong>Status</strong></td>
												<td>
													<Badge bg={getStatusBadgeColor(detailsModalData.status)}>
														{detailsModalData.status.replace('_', ' ').toUpperCase()}
													</Badge>
												</td>
											</tr>
											<tr>
												<td><strong>Suspicion Score</strong></td>
												<td>
													<Badge bg={detailsModalData.suspicionScore > 2 ? 'danger' : detailsModalData.suspicionScore > 0 ? 'warning' : 'success'}>
														{detailsModalData.suspicionScore}
													</Badge>
												</td>
											</tr>
											<tr>
												<td><strong>Submitted At</strong></td>
												<td>{formatDateTime(detailsModalData.createdAt)}</td>
											</tr>
										</tbody>
									</Table>
								</div>
							)}

							{detailsModalType === 'suppressed_email' && (
								<div>
									<Table variant="dark" striped>
										<tbody>
											<tr>
												<td><strong>Email Address</strong></td>
												<td><code>{detailsModalData.email}</code></td>
											</tr>
											<tr>
												<td><strong>Suppression Reason</strong></td>
												<td>
													<Badge bg={getReasonBadgeColor(detailsModalData.reason)}>
														{detailsModalData.reason.charAt(0).toUpperCase() + detailsModalData.reason.slice(1)}
													</Badge>
												</td>
											</tr>
											<tr>
												<td><strong>Source</strong></td>
												<td>
													<Badge bg="info">{detailsModalData.source.toUpperCase()}</Badge>
												</td>
											</tr>
											<tr>
												<td><strong>Date Added</strong></td>
												<td>{formatDateTime(detailsModalData.created_at)}</td>
											</tr>
											{detailsModalData.metadata && (
												<tr>
													<td><strong>Additional Info</strong></td>
													<td><pre className="text-muted small">{JSON.stringify(detailsModalData.metadata, null, 2)}</pre></td>
												</tr>
											)}
										</tbody>
									</Table>
								</div>
							)}

							{detailsModalType === 'suspicious_ip' && (
								<div>
									<Table variant="dark" striped>
										<tbody>
											<tr>
												<td><strong>IP Address</strong></td>
												<td><code className="text-warning">{detailsModalData.ipAddress}</code></td>
											</tr>
											<tr>
												<td><strong>Total Submissions</strong></td>
												<td><Badge bg="info">{detailsModalData.submissionCount}</Badge></td>
											</tr>
											<tr>
												<td><strong>Average Suspicion Score</strong></td>
												<td>
													<Badge bg={parseFloat(detailsModalData.avgSuspicion) > 3 ? 'danger' : 'warning'}>
														{detailsModalData.avgSuspicion}
													</Badge>
												</td>
											</tr>
											<tr>
												<td><strong>Spam Count</strong></td>
												<td><Badge bg="danger">{detailsModalData.spamCount}</Badge></td>
											</tr>
											<tr>
												<td><strong>Spam Rate</strong></td>
												<td>
													<Badge bg="danger">
														{((detailsModalData.spamCount / detailsModalData.submissionCount) * 100).toFixed(1)}%
													</Badge>
												</td>
											</tr>
										</tbody>
									</Table>

									<Alert variant="warning" className="mt-3">
										<i className="bi bi-shield-exclamation me-2"></i>
										This IP address has been flagged due to suspicious activity. Consider implementing additional rate limiting or blocking for this IP.
									</Alert>
								</div>
							)}
						</>
					)}
				</Modal.Body>
				<Modal.Footer className="bg-dark border-secondary">
					<Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
						Close
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Reactivate Email Modal */}
			<Modal show={showReactivateModal} onHide={() => setShowReactivateModal(false)} centered>
				<Modal.Header closeButton className="bg-dark text-white border-secondary">
					<Modal.Title>Reactivate Email Address</Modal.Title>
				</Modal.Header>
				<Modal.Body className="bg-dark text-white">
					<p>Are you sure you want to reactivate email sending to:</p>
					<p className="text-success"><strong>{selectedEmail}</strong></p>
					<Alert variant="warning" className="mt-3">
						<i className="bi bi-exclamation-triangle-fill me-2"></i>
						Only reactivate if you're confident this is a legitimate email address and
						the suppression was added in error. Reactivating emails that were legitimately
						suppressed can harm your sender reputation.
					</Alert>
				</Modal.Body>
				<Modal.Footer className="bg-dark border-secondary">
					<Button
						variant="secondary"
						onClick={() => setShowReactivateModal(false)}
						disabled={reactivating}
					>
						Cancel
					</Button>
					<Button
						variant="warning"
						onClick={handleReactivateEmail}
						disabled={reactivating}
					>
						{reactivating ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Reactivating...
							</>
						) : (
							<>
								<i className="bi bi-arrow-clockwise me-1"></i>
								Reactivate Email
							</>
						)}
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Test Email Modal */}
			<Modal show={showTestModal} onHide={() => setShowTestModal(false)} centered>
				<Modal.Header closeButton className="bg-dark text-white border-secondary">
					<Modal.Title>Send Test Email</Modal.Title>
				</Modal.Header>
				<Modal.Body className="bg-dark text-white">
					<p>Send a test email to verify your email system is working correctly.</p>
					<Form>
						<Form.Group>
							<Form.Label>Test Email Address</Form.Label>
							<Form.Control
								type="email"
								value={testEmail}
								onChange={(e) => setTestEmail(e.target.value)}
								placeholder="Enter email address to test"
								className="bg-black text-white border-secondary"
								required
							/>
							<Form.Text className="text-muted">
								Make sure this is a valid email address you have access to.
							</Form.Text>
						</Form.Group>
					</Form>
				</Modal.Body>
				<Modal.Footer className="bg-dark border-secondary">
					<Button
						variant="secondary"
						onClick={() => {
							setShowTestModal(false);
							setTestEmail('');
						}}
						disabled={sendingTest}
					>
						Cancel
					</Button>
					<Button
						variant="success"
						onClick={handleSendTestEmail}
						disabled={sendingTest || !testEmail}
					>
						{sendingTest ? (
							<>
								<Spinner animation="border" size="sm" className="me-2" />
								Sending...
							</>
						) : (
							<>
								<i className="bi bi-envelope-fill me-1"></i>
								Send Test Email
							</>
						)}
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Toast Notifications */}
			<ToastContainer position="top-end" className="p-3">
				<Toast
					show={toastMessage.show}
					onClose={() => setToastMessage({ show: false, type: '', message: '' })}
					bg={toastMessage.type === 'success' ? 'success' : 'danger'}
				>
					<Toast.Header>
						<strong className="me-auto">
							{toastMessage.type === 'success' ? 'Success' : 'Error'}
						</strong>
					</Toast.Header>
					<Toast.Body className="text-white">
						{toastMessage.message}
					</Toast.Body>
				</Toast>
			</ToastContainer>
		</>
	);
};

export default EmailMonitoringTab;