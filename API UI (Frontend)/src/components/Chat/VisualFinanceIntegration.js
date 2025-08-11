// src/components/Chat/VisualFinanceIntegration.js
import React, { useState, useEffect } from 'react';
import VisualFinanceMode from './VisualFinanceMode';
import './VisualFinanceMode.css';

/**
 * Component to handle improved integration of financial visualizations into the chat interface
 * This acts as an intermediary to improve detection and provides a better UI for triggering visualizations
 */
const VisualFinanceIntegration = ({
	chatMessages,
	financialData,
	activeMessage = null
}) => {
	// State to track which message is being visualized
	const [visualizedMessageId, setVisualizedMessageId] = useState(null);
	// State to track available visualizations for each message
	const [messageVisualizations, setMessageVisualizations] = useState({});

	// Clear visualizations when chatMessages change significantly (new conversation)
	useEffect(() => {
		if (chatMessages?.length <= 1) {
			setVisualizedMessageId(null);
			setMessageVisualizations({});
		}
	}, [chatMessages?.length]);

	// Effect to detect financial concepts in messages
	useEffect(() => {
		if (!chatMessages?.length) return;

		// Process each message to detect financial concepts
		const newVisualizations = {};

		chatMessages.forEach(message => {
			// Only analyze assistant messages that are complete (not streaming)
			if (message.role === 'assistant' && !message.isStreaming && message.id) {
				const detectedConcept = detectFinancialConcept(message.content);
				if (detectedConcept) {
					newVisualizations[message.id] = detectedConcept;
				}
			}
		});

		setMessageVisualizations(prevState => ({
			...prevState,
			...newVisualizations
		}));
	}, [chatMessages]);

	// Function to toggle visualization for a specific message
	const toggleVisualization = (messageId) => {
		setVisualizedMessageId(visualizedMessageId === messageId ? null : messageId);
	};

	// Improved financial concept detection
	const detectFinancialConcept = (content) => {
		if (!content) return null;

		const lowerContent = content.toLowerCase();

		// Map of concepts to search patterns (more comprehensive than before)
		const conceptPatterns = {
			'budgeting': [
				'budget', '50/30/20', 'spending plan', 'expense tracking', 'income allocation',
				'zero-based budget', 'envelope system', 'discretionary spending', 'fixed expenses'
			],
			'saving': [
				'saving', 'emergency fund', 'savings rate', 'save money', 'sinking funds',
				'savings account', 'save for', 'savings goal', 'money market'
			],
			'investing': [
				'invest', 'stock', 'bond', 'portfolio', 'asset allocation', 'diversification',
				'etf', 'mutual fund', 'index fund', 'roth ira', '401k', 'compound interest',
				'dividend', 'capital gain', 'risk tolerance', 'market', 'securities'
			],
			'debt': [
				'debt', 'loan', 'mortgage', 'credit card', 'interest rate', 'avalanche', 'snowball',
				'refinance', 'consolidation', 'principal', 'balance', 'payoff', 'liability'
			],
			'credit': [
				'credit score', 'credit report', 'fico', 'credit history', 'credit utilization',
				'credit limit', 'credit inquiry', 'credit bureau', 'credit mix', 'payment history'
			],
			'retirement': [
				'retirement', '401k', 'ira', 'social security', 'pension', 'withdrawal rate',
				'required minimum distribution', 'rmd', 'retire', 'retirement age', 'roth'
			],
			'insurance': [
				'insurance', 'coverage', 'premium', 'deductible', 'policy', 'risk management',
				'health insurance', 'life insurance', 'property insurance', 'liability insurance'
			],
			'taxes': [
				'tax', 'deduction', 'credit', 'irs', 'withholding', 'tax-advantaged',
				'tax bracket', 'income tax', 'capital gains tax', 'tax return', 'tax planning'
			],
		};

		// Context relevance scores to improve detection accuracy
		const contextScores = {
			'budgeting': 0,
			'saving': 0,
			'investing': 0,
			'debt': 0,
			'credit': 0,
			'retirement': 0,
			'insurance': 0,
			'taxes': 0
		};

		// Check each concept's patterns and calculate relevance score
		for (const [concept, patterns] of Object.entries(conceptPatterns)) {
			patterns.forEach(pattern => {
				// Using regex with word boundaries for more accurate matches
				const regex = new RegExp(`\\b${pattern}\\b`, 'i');
				const matches = (lowerContent.match(regex) || []).length;

				if (matches > 0) {
					// Increase score based on number of matches and pattern specificity
					contextScores[concept] += matches * (pattern.includes(' ') ? 2 : 1);
				}
			});
		}

		// Find concept with highest score
		let highestScore = 0;
		let primaryConcept = null;

		for (const [concept, score] of Object.entries(contextScores)) {
			if (score > highestScore) {
				highestScore = score;
				primaryConcept = concept;
			}
		}

		// Only return a concept if the score is significant
		if (highestScore >= 2) {
			// Generate appropriate title based on concept
			let title = 'Financial Visualization';

			switch (primaryConcept) {
				case 'budgeting':
					title = 'Budgeting Visualization';
					break;
				case 'saving':
					title = 'Savings Visualization';
					break;
				case 'investing':
					title = 'Investment Visualization';
					break;
				case 'debt':
					title = 'Debt Management Visualization';
					break;
				case 'credit':
					title = 'Credit Score Visualization';
					break;
				case 'retirement':
					title = 'Retirement Planning Visualization';
					break;
				case 'insurance':
					title = 'Insurance Visualization';
					break;
				case 'taxes':
					title = 'Tax Planning Visualization';
					break;
			}

			return {
				concept: primaryConcept,
				title,
				score: highestScore,
				keywords: conceptPatterns[primaryConcept].filter(k => lowerContent.includes(k))
			};
		}

		// If no specific concept is found, but the message is educational, use general financial visualization
		if (lowerContent.includes('financial') ||
			lowerContent.includes('money') ||
			lowerContent.includes('finance') ||
			lowerContent.includes('income') ||
			lowerContent.includes('expense')) {
			return {
				concept: 'general',
				title: 'Financial Overview',
				score: 1,
				keywords: ['financial']
			};
		}

		return null;
	};

	// Render visualization buttons and component
	const renderMessageVisualizations = () => {
		if (!chatMessages?.length) return null;

		return (
			<>
				{chatMessages.map(message => {
					if (!message.id) return null;

					const messageId = message.id;
					const hasVisualization = messageVisualizations[messageId];

					// Only show visualization button for assistant messages with detected concepts
					if (message.role !== 'assistant' || !hasVisualization) return null;

					return (
						<div key={`viz-${messageId}`} className="visualization-container">
							{/* Show visualization button at the end of the message */}
							{!visualizedMessageId || visualizedMessageId !== messageId ? (
								<button
									className="visualization-toggle-btn"
									onClick={() => toggleVisualization(messageId)}
									title={`Show ${hasVisualization.title.toLowerCase()}`}
								>
									<i className="bi bi-graph-up-arrow me-2"></i>
									View {hasVisualization.title}
								</button>
							) : null}

							{/* Show visualization if this message is active */}
							{visualizedMessageId === messageId && (
								<div className="visualization-panel">
									<VisualFinanceMode
										enabled={true}
										onToggle={() => toggleVisualization(messageId)}
										financialData={financialData}
										conceptData={hasVisualization}
										loading={false}
									/>
								</div>
							)}
						</div>
					);
				})}
			</>
		);
	};

	return renderMessageVisualizations();
};

export default VisualFinanceIntegration;