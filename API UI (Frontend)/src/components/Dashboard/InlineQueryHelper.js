// src/components/Dashboard/InlineQueryHelper.js
import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';

const InlineQueryHelper = ({ query, setQuery, handleSendMessage }) => {
	const [showHelper, setShowHelper] = useState(false);
	const [suggestedQuery, setSuggestedQuery] = useState('');

	// Trigger phrases that might cause educational responses
	const triggerPhrases = [
		'what is', 'explain', 'how does', 'tell me about',
		'what are', 'what does', 'definition of', 'meaning of'
	];

	// Mapping of problematic queries to better alternatives
	const queryMap = {
		'what is my balance': 'show my balance',
		'what is my current balance': 'show my current balance',
		'what is my current account balance': 'show my current account balance',
		'what are my transactions': 'show my transactions',
		'what is my spending': 'show my spending',
		'what are my accounts': 'list my accounts'
	};

	// Check if current query contains trigger phrases
	useEffect(() => {
		if (!query) {
			setShowHelper(false);
			return;
		}

		const lowerQuery = query.toLowerCase();

		// Check if query contains any trigger phrases AND relates to financial data
		const containsTrigger = triggerPhrases.some(phrase => lowerQuery.startsWith(phrase));
		const isFinancialQuery = ['balance', 'account', 'transaction', 'spending'].some(
			term => lowerQuery.includes(term)
		);

		if (containsTrigger && isFinancialQuery) {
			// Find a better phrasing if available
			let better = '';

			// Try exact matches first
			if (queryMap[lowerQuery]) {
				better = queryMap[lowerQuery];
			} else {
				// Try partial matches
				for (const [problematic, improved] of Object.entries(queryMap)) {
					if (lowerQuery.includes(problematic)) {
						better = improved;
						break;
					}
				}
			}

			if (better) {
				setSuggestedQuery(better);
				setShowHelper(true);
				console.log('Should show suggestion:', better);
			} else {
				setShowHelper(false);
			}
		} else {
			setShowHelper(false);
		}
	}, [query]);

	// Apply the suggested query
	const applyQuerySuggestion = () => {
		setQuery(suggestedQuery);
		setShowHelper(false);
		document.getElementById('chat-input')?.focus();
	};

	// Apply and send the suggested query - with error handling
	const applySendQuerySuggestion = () => {
		try {
			// First update the query
			setQuery(suggestedQuery);
			setShowHelper(false);

			// Then use a minimal timeout to ensure the query is updated before sending
			setTimeout(() => {
				// Check if handleSendMessage exists before calling it
				if (typeof handleSendMessage === 'function') {
					handleSendMessage();
				} else {
					console.error('handleSendMessage is not a function', handleSendMessage);
				}
			}, 50);
		} catch (error) {
			console.error('Error in applySendQuerySuggestion:', error);
		}
	};

	// Safe handler for Enter key
	const handleKeyPress = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			try {
				// Check if handleSendMessage exists before calling it
				if (typeof handleSendMessage === 'function') {
					handleSendMessage();
				} else {
					console.error('handleSendMessage is not a function', handleSendMessage);
				}
			} catch (error) {
				console.error('Error handling Enter key press:', error);
			}
		}
	};

	return (
		<div className="query-input-container">
			{/* Simple Alert-based suggestion box */}
			{showHelper && (
				<Alert
					variant="warning"
					className="mb-2 py-2"
					style={{ fontSize: '0.9rem' }}
				>
					<div className="d-flex justify-content-between align-items-center">
						<div>
							<i className="bi bi-lightbulb-fill me-2"></i>
							<strong>Try instead:</strong> "{suggestedQuery}"
						</div>
						<div>
							<Button
								variant="outline-success"
								size="sm"
								className="me-1"
								onClick={applyQuerySuggestion}
							>
								Use
							</Button>
							<Button
								variant="success"
								size="sm"
								className="me-1"
								onClick={applySendQuerySuggestion}
							>
								Use & Send
							</Button>
							<Button
								variant="outline-secondary"
								size="sm"
								onClick={() => setShowHelper(false)}
							>
								✕
							</Button>
						</div>
					</div>
				</Alert>
			)}
			<div className="query-tip mb-2" style={{ color: '#aaa', fontSize: '0.8rem' }}>
				<i className="bi bi-lightbulb me-1"></i>
				Tip: For direct answers about your finances, try phrases like "show my balance" instead of "what is my balance"
				Phrases that begin with or contain the following: 'what is', 'explain', 'how does', 'tell me about',
				'what are', 'what does', 'definition of', 'meaning of' provide educational responses which are longer.
			</div>
			<Form.Control
				id="chat-input"
				as="textarea"
				rows={1}
				placeholder="Ask about your financial data..."
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyPress={handleKeyPress}
				className="chat-input text-black"
			/>
		</div>
	);
};

export default InlineQueryHelper;