// src/components/Dashboard/DataIntegrationModeSelector.js
import React from 'react';
import { Button, Card, Row, Col, Badge } from 'react-bootstrap';

/**
 * Component to toggle between different data integration modes
 */
const DataIntegrationModeSelector = ({
	currentMode,
	onSelectMode,
	plaidConnected,
	institution,
}) => {
	return (
		<Card className="bg-black text-white mb-3 data-integration-mode-selector">
			<Card.Header className="bg-black text-white">
				<i className="bi bi-toggles me-2"></i>
				Data Integration Mode
			</Card.Header>
			<Card.Body className="bg-black">
				<p className="small mb-3 text-white">
					Choose how you want to integrate financial data with the Banking Intelligence API. Switch between modes to refresh the data. Recommended when trying for the first time or testing new features.
				</p>
				<Row>
					<Col xs={12} md={6} className="mb-3 mb-md-0">
						<Card
							className={`mode-card h-100 bg-black ${currentMode === 'plaid' ? 'active' : ''}`}
							onClick={() => onSelectMode('plaid')}
						>
							<Card.Body className="bg-black text-white">
								<h5 className="d-flex align-items-center text-white">
									<i className="bi bi-bank me-2 text-success"></i>
									Plaid Integration
									{currentMode === 'plaid' && (
										<Badge bg="success" className="ms-2">Active</Badge>
									)}
								</h5>
								<p className="small text-white">
									Connect to real financial institutions through Plaid. This allows you to see how the
									Banking Intelligence API works with your actual banking data.
								</p>
								<div className="mt-2">
									<Badge bg={plaidConnected ? 'success' : 'warning'}>
										{plaidConnected ? `Connected to ${institution}` : 'Not Connected'}
									</Badge>
								</div>
							</Card.Body>
							<Card.Footer className="d-flex justify-content-center bg-black">
								<Button
									variant={currentMode === 'plaid' ? 'success' : 'outline-light'}
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										onSelectMode('plaid');
									}}
								>
									{currentMode === 'plaid' ? 'Currently Selected' : 'Use Plaid'}
								</Button>
							</Card.Footer>
						</Card>
					</Col>

					<Col xs={12} md={6}>
						<Card
							className={`mode-card h-100 bg-black ${currentMode === 'direct' ? 'active' : ''}`}
							onClick={() => onSelectMode('direct')}
						>
							<Card.Body className="bg-black text-white">
								<h5 className="d-flex align-items-center text-white">
									<i className="bi bi-database me-2 text-info"></i>
									Direct Data Integration
									{currentMode === 'direct' && (
										<Badge bg="success" className="ms-2">Active</Badge>
									)}
								</h5>
								<p className="small text-white">
									Use simulated financial data that you can edit yourself. Perfect for testing how the
									Banking Intelligence API works without connecting real accounts.
								</p>
								<div className="mt-2">
									<Badge bg="info">Fully Customizable</Badge>
								</div>
							</Card.Body>
							<Card.Footer className="d-flex justify-content-center bg-black">
								<Button
									variant={currentMode === 'direct' ? 'success' : 'outline-light'}
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										onSelectMode('direct');
									}}
								>
									{currentMode === 'direct' ? 'Currently Selected' : 'Use Custom Data'}
								</Button>
							</Card.Footer>
						</Card>
					</Col>
				</Row>
			</Card.Body>
		</Card>
	);
};

export default DataIntegrationModeSelector;