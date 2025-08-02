// src/services/conversation.service.js
const logger = require('../utils/logger');

class ConversationService {
	constructor() {
		// In-memory store for conversations
		// In production, use Redis or a database
		this.conversations = new Map();
		this.maxHistoryLength = 10; // Keep last 10 messages
		this.expiration = 30 * 60 * 1000; // 30 minutes in milliseconds
	}

	/**
	 * Get conversation history for a user
	 * @param {string} userId - User ID
	 * @returns {Array} - Conversation history
	 */
	getConversation(userId) {
		const conversation = this.conversations.get(userId);

		if (!conversation) {
			return [];
		}

		// Check if conversation has expired
		if (Date.now() - conversation.lastUpdated > this.expiration) {
			logger.info(`Conversation for user ${userId} has expired`);
			this.conversations.delete(userId);
			return [];
		}

		return conversation.messages;
	}

	/**
	 * Add a message to the conversation history
	 * @param {string} userId - User ID
	 * @param {string} role - Message role (user/assistant)
	 * @param {string} content - Message content
	 */
	addMessage(userId, role, content) {
		let conversation = this.conversations.get(userId);

		if (!conversation) {
			conversation = {
				messages: [],
				lastUpdated: Date.now()
			};
			this.conversations.set(userId, conversation);
		}

		// Add new message
		conversation.messages.push({
			role,
			content,
			timestamp: new Date().toISOString()
		});

		// Limit conversation history length
		if (conversation.messages.length > this.maxHistoryLength) {
			conversation.messages = conversation.messages.slice(-this.maxHistoryLength);
		}

		// Update timestamp
		conversation.lastUpdated = Date.now();
	}

	/**
	 * Clear conversation history for a user
	 * @param {string} userId - User ID
	 */
	clearConversation(userId) {
		this.conversations.delete(userId);
		logger.info(`Cleared conversation history for user ${userId}`);
	}

	/**
	 * Perform regular cleanup of expired conversations
	 * Called by a scheduled job
	 */
	cleanup() {
		const now = Date.now();
		let expiredCount = 0;

		for (const [userId, conversation] of this.conversations.entries()) {
			if (now - conversation.lastUpdated > this.expiration) {
				this.conversations.delete(userId);
				expiredCount++;
			}
		}

		if (expiredCount > 0) {
			logger.info(`Cleaned up ${expiredCount} expired conversations`);
		}
	}
}

// Create singleton instance
const conversationService = new ConversationService();

// Set up cleanup interval (every 15 minutes)
setInterval(() => {
	conversationService.cleanup();
}, 15 * 60 * 1000);

module.exports = conversationService;