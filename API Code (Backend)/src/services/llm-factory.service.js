// src/services/llm-factory.service.js
const cohereService = require('./cohere.service');
const groqService = require('./groq.service');
const geminiService = require('./gemini.service');
const logger = require('../utils/logger');

/**
 * LLM Factory Service
 * Service for selecting and using different LLM providers based on configuration
 */
class LLMFactoryService {
	constructor() {
		this.providers = {
			cohere: cohereService,
			groq: groqService,
			gemini: geminiService
		};

		// Get configured providers from environment variables
		this.primaryProvider = process.env.PRIMARY_LLM_PROVIDER || 'cohere';
		this.backupProvider = process.env.BACKUP_LLM_PROVIDER || 'groq';
		this.forcedProvider = process.env.FORCE_LLM_PROVIDER || null;

		logger.info('LLM Factory Service initialized', {
			primaryProvider: this.primaryProvider,
			backupProvider: this.backupProvider,
			forcedProvider: this.forcedProvider,
			availableProviders: Object.keys(this.providers)
		});
	}

	/**
	 * Generate insights using the configured LLM provider(s)
	 * @param {Object} userData - User data including query and financial context
	 * @param {string} [requestedProvider] - Optionally request a specific provider
	 * @returns {Promise<Object>} - Generated insights with provider metadata
	 */
	async generateInsights(userData, requestedProvider = null) {
		// Track which provider was actually used
		let usedProvider = null;
		let usingBackup = false;

		// Determine which provider to use
		// Priority: 1. Forced provider 2. Requested provider 3. Primary provider
		const providerToUse = this.forcedProvider || requestedProvider || this.primaryProvider;

		// Verify the requested provider exists
		if (!this.providers[providerToUse]) {
			logger.warn(`Requested provider "${providerToUse}" not available, falling back to "${this.primaryProvider}"`, {
				requestedProvider: providerToUse,
				availableProviders: Object.keys(this.providers),
				requestId: userData.requestId
			});
			usedProvider = this.primaryProvider;
		} else {
			usedProvider = providerToUse;
		}

		try {
			// Log which provider we're using
			logger.info(`Generating insights with ${usedProvider} service`, {
				queryType: userData.queryType,
				requestId: userData.requestId,
				provider: usedProvider,
				forced: !!this.forcedProvider,
				requested: !!requestedProvider
			});

			// Call the selected provider
			const insights = await this.providers[usedProvider].generateInsights(userData);

			// Add provider metadata
			return {
				...insights,
				llmProvider: usedProvider,
				usingBackupService: usingBackup
			};

		} catch (error) {
			// If a provider was forced or specifically requested, don't use backup
			if (this.forcedProvider || requestedProvider) {
				logger.error(`Error with ${usedProvider} service and no fallback allowed:`, error, {
					requestId: userData.requestId,
					forced: !!this.forcedProvider,
					requested: !!requestedProvider
				});
				throw error;
			}

			// Try the backup provider
			try {
				usingBackup = true;
				usedProvider = this.backupProvider;

				// Check if backup provider exists
				if (!this.providers[usedProvider]) {
					logger.error(`Backup provider "${usedProvider}" not available`, {
						requestId: userData.requestId,
						availableProviders: Object.keys(this.providers)
					});
					throw error; // Throw the original error
				}

				logger.info(`Trying backup ${usedProvider} service`, {
					requestId: userData.requestId
				});

				// Call the backup provider
				const backupInsights = await this.providers[usedProvider].generateInsights(userData);

				// Add provider metadata
				return {
					...backupInsights,
					llmProvider: usedProvider,
					usingBackupService: true
				};

			} catch (backupError) {
				// Both primary and backup failed
				logger.error(`Failed with both primary and backup services:`, {
					primaryError: error.message,
					backupError: backupError.message,
					requestId: userData.requestId
				});

				throw new Error(`Failed with both primary and backup LLM services. Primary (${this.primaryProvider}) error: ${error.message}. Backup (${this.backupProvider}) error: ${backupError.message}`);
			}
		}
	}

	/**
	 * Get a list of available LLM providers
	 * @returns {Array<string>} - List of provider names
	 */
	getAvailableProviders() {
		return Object.keys(this.providers);
	}

	/**
	 * Check if a provider is available
	 * @param {string} providerName - The name of the provider to check
	 * @returns {boolean} - Whether the provider is available
	 */
	isProviderAvailable(providerName) {
		return !!this.providers[providerName];
	}
}

module.exports = new LLMFactoryService();