// src/services/session.service.js
const logger = require('../utils/logger');

/**
 * Service for managing user sessions and conversation history
 */
class SessionManager {
	constructor() {
		this.sessions = new Map();

		// Run cleanup every 5 minutes
		setInterval(() => {
			this.cleanupStaleSessions();
		}, 5 * 60 * 1000);
	}

	/**
	 * Create a new session for a user
	 * @param {string} userId - User ID
	 * @returns {string} - Session ID
	 */
	createSession(userId) {
		const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		this.sessions.set(sessionId, {
			userId,
			conversationHistory: {
				recentQueries: [],
				recentTopics: [],
				lastInteraction: Date.now()
			},
			responseHistory: [],
			createdAt: Date.now(),
			lastAccessed: Date.now()
		});

		logger.info('Created new session', { sessionId, userId });
		return sessionId;
	}

	/**
	 * Get a session by ID
	 * @param {string} sessionId - Session ID
	 * @returns {Object|null} - Session object or null
	 */
	getSession(sessionId) {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.lastAccessed = Date.now();
			session.conversationHistory.lastInteraction = Date.now();
		}
		return session;
	}

	/**
	 * Update a session with new data
	 * @param {string} sessionId - Session ID
	 * @param {Object} updates - Updates to apply
	 * @returns {boolean} - Success status
	 */
	updateSession(sessionId, updates) {
		const session = this.getSession(sessionId);
		if (session) {
			Object.assign(session, updates);
			return true;
		}
		return false;
	}

	/**
	 * Delete a specific session
	 * @param {string} sessionId - Session ID
	 * @returns {boolean} - Success status
	 */
	deleteSession(sessionId) {
		const deleted = this.sessions.delete(sessionId);
		if (deleted) {
			logger.info('Deleted session', { sessionId });
		}
		return deleted;
	}

	/**
	 * Delete all sessions for a specific user
	 * @param {string} userId - User ID
	 * @returns {number} - Number of sessions deleted
	 */
	deleteUserSessions(userId) {
		let count = 0;
		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === userId) {
				this.sessions.delete(sessionId);
				count++;
			}
		}
		logger.info('Deleted user sessions', { userId, count });
		return count;
	}

	/**
	* Clean up expired sub-user sessions (modified cleanup method)
	*/
	cleanupStaleSessions() {
		const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000; // Shorter TTL for sub-users
		let cleaned = 0;

		for (const [sessionId, session] of this.sessions.entries()) {
			// Different TTL for different session types
			const expiryTime = session.type === 'sub_user' ? fiveMinutesAgo : thirtyMinutesAgo;

			if (session.lastAccessed < expiryTime) {
				this.sessions.delete(sessionId);
				cleaned++;
				logger.debug('Cleaned up stale session', {
					sessionId,
					type: session.type,
					subUserId: session.subUserId
				});
			}
		}

		if (cleaned > 0) {
			logger.info('Cleaned up stale sessions', { count: cleaned });
		}
	}

	/**
	 * Get session statistics (for monitoring)
	 * @returns {Object} - Session statistics
	 */
	getStats() {
		const sessions = Array.from(this.sessions.values());
		const now = Date.now();

		return {
			totalSessions: sessions.length,
			activeSessions: sessions.filter(s => now - s.lastAccessed < 5 * 60 * 1000).length,
			uniqueUsers: new Set(sessions.map(s => s.userId)).size
		};
	}

	/**
	 * Create a session for a sub-user (e.g., bank user)
	 * @param {string} primaryUserId - Main user/client ID
	 * @param {string} subUserId - Sub-user identifier
	 * @returns {string} - Session ID
	 */
	createSubUserSession(primaryUserId, subUserId) {
		const sessionId = `${primaryUserId}_sub_${subUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		this.sessions.set(sessionId, {
			userId: primaryUserId,
			subUserId: subUserId,
			conversationHistory: {
				recentQueries: [],
				recentTopics: [],
				lastInteraction: Date.now()
			},
			responseHistory: [],
			createdAt: Date.now(),
			lastAccessed: Date.now(),
			type: 'sub_user'
		});

		logger.info('Created sub-user session', {
			sessionId,
			primaryUserId,
			subUserId
		});

		return sessionId;
	}

	/**
	 * Get or create a session for a sub-user
	 * @param {string} primaryUserId - Main user/client ID
	 * @param {string} subUserId - Sub-user identifier
	 * @returns {string} - Session ID
	 */
	getOrCreateSubUserSession(primaryUserId, subUserId) {
		// Check if sub-user already has an active session
		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === primaryUserId &&
				session.subUserId === subUserId &&
				session.type === 'sub_user') {

				// Check if session is still valid (not expired)
				const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
				if (session.lastAccessed > thirtyMinutesAgo) {
					// Update last accessed
					session.lastAccessed = Date.now();
					logger.info('Found existing sub-user session', {
						sessionId,
						subUserId
					});
					return sessionId;
				} else {
					// Session expired, delete it
					this.sessions.delete(sessionId);
					logger.info('Deleted expired sub-user session', {
						sessionId,
						subUserId
					});
				}
			}
		}

		// Create new session for sub-user
		return this.createSubUserSession(primaryUserId, subUserId);
	}

	/**
	 * Delete all sessions for a specific sub-user
	 * @param {string} primaryUserId - Main user/client ID
	 * @param {string} subUserId - Sub-user identifier
	 * @returns {number} - Number of sessions deleted
	 */
	deleteSubUserSessions(primaryUserId, subUserId) {
		let count = 0;

		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === primaryUserId &&
				session.subUserId === subUserId) {
				this.sessions.delete(sessionId);
				count++;
				logger.info('Deleted sub-user session', {
					sessionId,
					subUserId
				});
			}
		}

		return count;
	}

	/**
	 * Get all active sub-user sessions for a primary user
	 * @param {string} primaryUserId - Main user/client ID
	 * @returns {Array} - Array of sub-user sessions
	 */
	getSubUserSessions(primaryUserId) {
		const subUserSessions = [];

		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === primaryUserId && session.type === 'sub_user') {
				subUserSessions.push({
					sessionId,
					subUserId: session.subUserId,
					createdAt: session.createdAt,
					lastAccessed: session.lastAccessed,
					queryCount: session.conversationHistory?.recentQueries?.length || 0
				});
			}
		}

		return subUserSessions;
	}
}

module.exports = new SessionManager();