// src/middleware/session.middleware.js
const sessionManager = require('../services/session.service');
const logger = require('../utils/logger');

/**
 * Middleware to handle session management
 */
function sessionMiddleware(req, res, next) {
	try {
		// Extract session ID from various sources
		const sessionId = req.headers['x-session-id'] ||
			req.body?.sessionId ||
			req.query?.sessionId ||
			req.cookies?.sessionId; // if using cookies

		if (sessionId) {
			const session = sessionManager.getSession(sessionId);

			if (session) {
				// Valid session found
				req.session = session;
				req.sessionId = sessionId;

				logger.debug('Session validated', {
					sessionId,
					userId: session.userId,
					path: req.path
				});
			} else {
				// Invalid session ID provided
				logger.warn('Invalid session ID', {
					sessionId,
					path: req.path
				});
			}
		}

		// If no valid session but user is authenticated, create one
		if (!req.session && req.user && req.user.id) {
			const newSessionId = sessionManager.createSession(req.user.id);
			req.sessionId = newSessionId;
			req.session = sessionManager.getSession(newSessionId);

			// Add session ID to response headers
			res.setHeader('X-Session-Id', newSessionId);

			logger.info('Created new session via middleware', {
				userId: req.user.id,
				sessionId: newSessionId,
				path: req.path
			});
		}

		// Add session helper methods to request
		req.getSessionData = function () {
			return req.session || null;
		};

		req.updateSession = function (updates) {
			if (req.sessionId) {
				return sessionManager.updateSession(req.sessionId, updates);
			}
			return false;
		};

		req.endSession = function () {
			if (req.sessionId) {
				return sessionManager.deleteSession(req.sessionId);
			}
			return false;
		};

		next();
	} catch (error) {
		logger.error('Session middleware error:', error);
		// Continue without session on error
		next();
	}
}

/**
 * Middleware to require a valid session
 */
function requireSession(req, res, next) {
	if (!req.session) {
		return res.status(401).json({
			success: false,
			message: 'Valid session required',
			code: 'SESSION_REQUIRED'
		});
	}
	next();
}

/**
 * Middleware to optionally validate session
 */
function optionalSession(req, res, next) {
	// Session is optional, just continue
	next();
}

module.exports = {
	sessionMiddleware,
	requireSession,
	optionalSession
};