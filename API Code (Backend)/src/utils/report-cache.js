// src/utils/report-cache.js
const logger = require('./logger');

/**
 * In-memory cache for banking intelligence reports
 * In production, consider using Redis for distributed caching
 */
class ReportCache {
	constructor(options = {}) {
		this.cache = new Map();
		this.defaultTTL = options.ttl || 300000; // 5 minutes default
		this.maxSize = options.maxSize || 100; // Maximum cache entries
		this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute cleanup

		// Start cleanup interval
		this.startCleanup();
	}

	/**
	 * Generate cache key from report parameters
	 */
	generateKey(params) {
		const { userId, timeframe, includeDetailed, statementData } = params;
		const hasStatementData = !!statementData;
		return `${userId}-${timeframe}-${includeDetailed}-${hasStatementData}`;
	}

	/**
	 * Store report in cache
	 */
	set(params, report, customTTL = null) {
		const key = this.generateKey(params);
		const ttl = customTTL || this.defaultTTL;
		const expiresAt = Date.now() + ttl;

		// Check cache size limit
		if (this.cache.size >= this.maxSize) {
			// Remove oldest entry
			const oldestKey = this.cache.keys().next().value;
			this.cache.delete(oldestKey);
			logger.debug(`Cache size limit reached, removed oldest entry: ${oldestKey}`);
		}

		this.cache.set(key, {
			report,
			createdAt: Date.now(),
			expiresAt,
			accessCount: 0
		});

		logger.debug(`Report cached with key: ${key}, expires in ${ttl}ms`);
	}

	/**
	 * Get report from cache
	 */
	get(params) {
		const key = this.generateKey(params);
		const entry = this.cache.get(key);

		if (!entry) {
			logger.debug(`Cache miss for key: ${key}`);
			return null;
		}

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			logger.debug(`Cache entry expired and removed: ${key}`);
			return null;
		}

		// Update access count
		entry.accessCount++;
		entry.lastAccessedAt = Date.now();

		logger.debug(`Cache hit for key: ${key} (accessed ${entry.accessCount} times)`);
		return entry.report;
	}

	/**
	 * Check if report exists in cache
	 */
	has(params) {
		return this.get(params) !== null;
	}

	/**
	 * Remove specific report from cache
	 */
	delete(params) {
		const key = this.generateKey(params);
		const deleted = this.cache.delete(key);
		if (deleted) {
			logger.debug(`Manually removed cache entry: ${key}`);
		}
		return deleted;
	}

	/**
	 * Clear all cache entries
	 */
	clear() {
		const size = this.cache.size;
		this.cache.clear();
		logger.info(`Cleared ${size} cache entries`);
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		let totalAccess = 0;
		let oldestEntry = Date.now();
		let newestEntry = 0;

		for (const entry of this.cache.values()) {
			totalAccess += entry.accessCount;
			if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
			if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
		}

		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			totalAccess,
			oldestEntryAge: this.cache.size > 0 ? Date.now() - oldestEntry : 0,
			newestEntryAge: this.cache.size > 0 ? Date.now() - newestEntry : 0
		};
	}

	/**
	 * Start periodic cleanup of expired entries
	 */
	startCleanup() {
		setInterval(() => {
			this.cleanup();
		}, this.cleanupInterval);
	}

	/**
	 * Remove expired entries
	 */
	cleanup() {
		const now = Date.now();
		let removedCount = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				removedCount++;
			}
		}

		if (removedCount > 0) {
			logger.debug(`Cleaned up ${removedCount} expired cache entries`);
		}
	}

	/**
	 * Stop cleanup interval (for graceful shutdown)
	 */
	destroy() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}
		this.clear();
	}
}

// Create singleton instance
const reportCache = new ReportCache({
	ttl: 300000, // 5 minutes
	maxSize: 50,  // 50 reports max
	cleanupInterval: 60000 // 1 minute cleanup
});

module.exports = reportCache;