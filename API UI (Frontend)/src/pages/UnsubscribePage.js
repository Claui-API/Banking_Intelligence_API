// src/pages/UnsubscribePage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';

const UnsubscribePage = () => {
	const [searchParams] = useSearchParams();
	const [status, setStatus] = useState('loading'); // loading, success, error, form
	const [message, setMessage] = useState('');
	const [email, setEmail] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const token = searchParams.get('token');

		if (token) {
			// Process automatic unsubscribe
			handleTokenUnsubscribe(token);
		} else {
			// Show manual form
			setStatus('form');
		}
	}, [searchParams]);

	const handleTokenUnsubscribe = async (token) => {
		try {
			const response = await fetch(`/api/unsubscribe/confirm?token=${token}`, {
				method: 'GET'
			});

			if (response.ok) {
				setStatus('success');
				setMessage('You have been successfully unsubscribed from all future communications.');
			} else {
				const errorData = await response.json();
				setStatus('error');
				setMessage(errorData.error || 'Failed to process unsubscribe request.');
			}
		} catch (error) {
			console.error('Unsubscribe error:', error);
			setStatus('error');
			setMessage('An error occurred while processing your request. Please try again or contact support.');
		}
	};

	const handleManualUnsubscribe = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const response = await fetch('/api/unsubscribe/submit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			});

			const data = await response.json();

			if (response.ok) {
				setStatus('success');
				setMessage(data.message || 'You have been successfully unsubscribed.');
				setEmail('');
			} else {
				setMessage(data.error || 'Failed to process unsubscribe request.');
			}
		} catch (error) {
			console.error('Manual unsubscribe error:', error);
			setMessage('An error occurred. Please try again or contact support directly.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="unsubscribe-page" style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
			<Container className="py-5">
				<Row className="justify-content-center">
					<Col md={6}>
						<Card style={{ backgroundColor: '#1a1a1a', border: '1px solid #28a745' }}>
							<Card.Body className="p-5">
								<div className="text-center mb-4">
									<h1 style={{ color: '#28a745', fontSize: '1.8rem' }}>Banking Intelligence API</h1>
									<p className="text-muted">Email Communication Preferences</p>
								</div>

								{status === 'loading' && (
									<div className="text-center">
										<Spinner animation="border" variant="success" className="mb-3" />
										<p>Processing your unsubscribe request...</p>
									</div>
								)}

								{status === 'success' && (
									<>
										<Alert variant="success">
											<Alert.Heading>Successfully Unsubscribed</Alert.Heading>
											<p>{message}</p>
											<hr />
											<p className="mb-0">
												If you have any questions or concerns, please contact us at{' '}
												<a href="mailto:business@vivytech.com" style={{ color: '#28a745' }}>
													business@vivytech.com
												</a>
											</p>
										</Alert>

										<div className="text-center mt-4">
											<Button
												variant="outline-success"
												href="https://bankingintelligenceapi.com"
											>
												Return to Homepage
											</Button>
										</div>
									</>
								)}

								{status === 'error' && (
									<>
										<Alert variant="danger">
											<Alert.Heading>Unsubscribe Error</Alert.Heading>
											<p>{message}</p>
											<hr />
											<p className="mb-0">
												Please contact us directly at{' '}
												<a href="mailto:business@vivytech.com">business@vivytech.com</a>
												{' '}if you need assistance.
											</p>
										</Alert>

										<div className="text-center mt-4">
											<Button
												variant="outline-light"
												onClick={() => setStatus('form')}
											>
												Try Manual Unsubscribe
											</Button>
										</div>
									</>
								)}

								{status === 'form' && (
									<>
										<h2 className="text-center mb-4" style={{ color: '#28a745' }}>
											Unsubscribe from Communications
										</h2>

										<p className="text-light mb-4">
											Enter your email address below to unsubscribe from all future
											Banking Intelligence API communications.
										</p>

										{message && (
											<Alert variant={message.includes('success') ? 'success' : 'danger'}>
												{message}
											</Alert>
										)}

										<Form onSubmit={handleManualUnsubscribe}>
											<Form.Group className="mb-3">
												<Form.Label className="text-white">Email Address</Form.Label>
												<Form.Control
													type="email"
													value={email}
													onChange={(e) => setEmail(e.target.value)}
													placeholder="Enter your email address"
													required
													className="bg-black text-white border-secondary"
													style={{ borderColor: '#6c757d' }}
												/>
											</Form.Group>

											<div className="d-grid">
												<Button
													type="submit"
													variant="danger"
													disabled={isSubmitting}
													size="lg"
												>
													{isSubmitting ? (
														<>
															<Spinner animation="border" size="sm" className="me-2" />
															Processing...
														</>
													) : (
														'Unsubscribe'
													)}
												</Button>
											</div>
										</Form>

										<div className="text-center mt-4">
											<p className="text-muted small">
												You will receive a confirmation once the unsubscribe is processed.
											</p>
										</div>
									</>
								)}

								<div className="text-center mt-4 pt-4 border-top" style={{ borderColor: '#28a745' }}>
									<p className="text-muted small mb-0">
										<strong>Banking Intelligence API</strong><br />
										Vivy Tech USA, Inc.<br />
										100 Arlington St, Boston Office 11C
									</p>
								</div>
							</Card.Body>
						</Card>
					</Col>
				</Row>
			</Container>
		</div>
	);
};

export default UnsubscribePage;