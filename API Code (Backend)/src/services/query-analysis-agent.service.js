// src/services/query-analysis-agent.service.js
const llmFactory = require('./llm-factory.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Query Analysis Agent - Summarizes user behavior patterns and query intentions
 */
class QueryAnalysisAgent {
	constructor() {
		this.llmService = null;
		this.analysisCache = new Map();
		this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
	}

	/**
	 * Initialize the agent with LLM service
	 */
	async initialize() {
		try {
			// Check if llmFactory is available (it's a singleton instance, not a class)
			if (!llmFactory || typeof llmFactory.generateInsights !== 'function') {
				throw new Error('LLM Factory service is not available or does not have generateInsights method');
			}

			this.llmService = llmFactory; // Use the factory directly
			logger.info('Query Analysis Agent initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Query Analysis Agent:', error);
			throw error;
		}
	}

	/**
	 * Analyze and summarize user's recent query patterns
	 * @param {string} userId - User ID
	 * @param {Array} recentQueries - Array of recent queries
	 * @param {Object} userMetrics - User metrics object
	 * @returns {Promise<Object>} Analysis summary
	 */
	async analyzeUserQueryPatterns(userId, recentQueries = [], userMetrics = {}) {
		try {
			// Check cache first
			const cacheKey = `${userId}-${Date.now() - Date.now() % this.cacheTimeout}`;
			if (this.analysisCache.has(cacheKey)) {
				return this.analysisCache.get(cacheKey);
			}

			if (!this.llmService) {
				await this.initialize();
			}

			// Prepare context data
			const queryTexts = recentQueries.map(q => q.query || q).slice(0, 10);
			const queryTypes = recentQueries.map(q => q.queryType || 'general').slice(0, 10);

			// Create analysis prompt
			const analysisPrompt = this._buildAnalysisPrompt(queryTexts, queryTypes, userMetrics);

			// Generate analysis
			const response = await this.llmService.generateInsights({
				query: analysisPrompt,
				queryType: 'planning', // Use planning type for analysis queries
				requestId: `${userId}-analysis-${Date.now()}`,
				userId: userId,
				// Add minimal financial data context for the analysis
				accounts: [],
				transactions: [],
				insights: {
					totalQueries: userMetrics.queryCount || 0,
					avgResponseTime: userMetrics.avgResponseTime || 0,
					mostCommonType: userMetrics.mostCommonQueryType || 'general'
				}
			});

			// Extract the generated content (the LLM response will be in the insight field)
			const analysisContent = response?.insight || response;

			// Parse and structure the response
			const analysis = this._parseAnalysisResponse(analysisContent, userMetrics);

			// Cache the result
			this.analysisCache.set(cacheKey, analysis);

			logger.info(`Generated query analysis for user ${userId}`);
			return analysis;

		} catch (error) {
			logger.error(`Error analyzing user query patterns for ${userId}:`, error);

			// Return fallback analysis
			return this._generateFallbackAnalysis(recentQueries, userMetrics);
		}
	}

	/**
	 * Build analysis prompt for the LLM
	 * @private
	 */
	_buildAnalysisPrompt(queries, queryTypes, userMetrics) {
		const queryTypeDistribution = this._calculateQueryTypeDistribution(queryTypes);

		return `
You are a financial behavior analyst. Analyze this user's query patterns and provide insights about their financial behavior and needs.

USER METRICS:
- Total Queries: ${userMetrics.queryCount || 0}
- Average Response Time: ${userMetrics.avgResponseTime || 0}ms
- Success Rate: ${userMetrics.successRate || '100'}%
- Most Common Query Type: ${userMetrics.mostCommonQueryType || 'general'}

RECENT QUERIES (${queries.length}):
${queries.map((query, i) => `${i + 1}. "${query}" [Type: ${queryTypes[i] || 'general'}]`).join('\n')}

QUERY TYPE DISTRIBUTION:
${Object.entries(queryTypeDistribution).map(([type, count]) => `- ${type}: ${count} queries`).join('\n')}

Please analyze this user's financial behavior and provide a structured response with the following information:

1. BEHAVIOR SUMMARY: A 2-3 sentence summary of the user's financial behavior patterns
2. PRIMARY INTERESTS: List their top 3-5 financial interests based on query patterns
3. KEY INSIGHTS: 2-4 specific insights about their financial habits or needs
4. RECOMMENDATIONS: 2-3 actionable recommendations based on their query patterns
5. RISK LEVEL: Assess as low, medium, or high based on their financial behavior
6. ENGAGEMENT PATTERN: Classify as casual, regular, or heavy based on query frequency
7. NEXT BEST ACTION: Suggest the most helpful next step for this user

Focus on:
- What financial goals or concerns they seem to have
- Their level of financial sophistication
- Patterns in their question topics
- Recommendations to help them succeed

Provide your response in a clear, structured format that can be easily parsed.
`;
	}

	/**
	 * Parse LLM response into structured analysis
	 * @private
	 */
	_parseAnalysisResponse(response, userMetrics) {
		try {
			// First try to parse as JSON
			let jsonStart = response.indexOf('{');
			let jsonEnd = response.lastIndexOf('}') + 1;

			if (jsonStart !== -1 && jsonEnd > jsonStart) {
				const jsonString = response.substring(jsonStart, jsonEnd);
				const parsed = JSON.parse(jsonString);

				// Validate and enhance the parsed response
				return {
					behaviorSummary: parsed.behaviorSummary || "User shows active engagement with financial planning tools.",
					primaryInterests: Array.isArray(parsed.primaryInterests) ? parsed.primaryInterests.slice(0, 5) : ['financial planning'],
					insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 4) : ['User seeks financial guidance'],
					recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3) : ['Continue exploring financial topics'],
					riskLevel: ['low', 'medium', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'medium',
					engagementPattern: ['casual', 'regular', 'heavy'].includes(parsed.engagementPattern) ? parsed.engagementPattern : 'regular',
					nextBestAction: parsed.nextBestAction || "Continue exploring financial topics that interest you",
					generatedAt: new Date().toISOString(),
					confidence: 'high'
				};
			}

			// If no JSON found, try to parse the structured text response
			return this._parseStructuredTextResponse(response, userMetrics);

		} catch (error) {
			logger.warn('Failed to parse LLM analysis response:', error);
			return this._generateFallbackAnalysis([], userMetrics);
		}
	}

	/**
	 * Parse structured text response when JSON parsing fails
	 * @private
	 */
	_parseStructuredTextResponse(response, userMetrics) {
		const lines = response.split('\n').map(line => line.trim()).filter(line => line);

		let behaviorSummary = '';
		let primaryInterests = [];
		let insights = [];
		let recommendations = [];
		let riskLevel = 'medium';
		let engagementPattern = 'regular';
		let nextBestAction = '';

		let currentSection = '';

		for (const line of lines) {
			// Detect section headers
			if (line.toUpperCase().includes('BEHAVIOR SUMMARY') || line.includes('1.')) {
				currentSection = 'summary';
				continue;
			} else if (line.toUpperCase().includes('PRIMARY INTERESTS') || line.includes('2.')) {
				currentSection = 'interests';
				continue;
			} else if (line.toUpperCase().includes('KEY INSIGHTS') || line.includes('3.')) {
				currentSection = 'insights';
				continue;
			} else if (line.toUpperCase().includes('RECOMMENDATIONS') || line.includes('4.')) {
				currentSection = 'recommendations';
				continue;
			} else if (line.toUpperCase().includes('RISK LEVEL') || line.includes('5.')) {
				currentSection = 'risk';
				continue;
			} else if (line.toUpperCase().includes('ENGAGEMENT PATTERN') || line.includes('6.')) {
				currentSection = 'engagement';
				continue;
			} else if (line.toUpperCase().includes('NEXT BEST ACTION') || line.includes('7.')) {
				currentSection = 'action';
				continue;
			}

			// Parse content based on current section
			if (currentSection === 'summary' && line.length > 10) {
				behaviorSummary = line.replace(/^[0-9]+\.\s*/, '');
			} else if (currentSection === 'interests' && (line.startsWith('-') || line.startsWith('•'))) {
				primaryInterests.push(line.replace(/^[-•]\s*/, ''));
			} else if (currentSection === 'insights' && (line.startsWith('-') || line.startsWith('•'))) {
				insights.push(line.replace(/^[-•]\s*/, ''));
			} else if (currentSection === 'recommendations' && (line.startsWith('-') || line.startsWith('•'))) {
				recommendations.push(line.replace(/^[-•]\s*/, ''));
			} else if (currentSection === 'risk' && line.length > 3) {
				const riskMatch = line.toLowerCase().match(/(low|medium|high)/);
				if (riskMatch) riskLevel = riskMatch[1];
			} else if (currentSection === 'engagement' && line.length > 3) {
				const engagementMatch = line.toLowerCase().match(/(casual|regular|heavy)/);
				if (engagementMatch) engagementPattern = engagementMatch[1];
			} else if (currentSection === 'action' && line.length > 10) {
				nextBestAction = line.replace(/^[0-9]+\.\s*/, '');
			}
		}

		return {
			behaviorSummary: behaviorSummary || "User shows engagement with financial planning tools.",
			primaryInterests: primaryInterests.length > 0 ? primaryInterests.slice(0, 5) : ['financial planning'],
			insights: insights.length > 0 ? insights.slice(0, 4) : ['User seeks financial guidance'],
			recommendations: recommendations.length > 0 ? recommendations.slice(0, 3) : ['Continue exploring financial topics'],
			riskLevel,
			engagementPattern,
			nextBestAction: nextBestAction || "Continue exploring financial topics that interest you",
			generatedAt: new Date().toISOString(),
			confidence: 'medium'
		};
	}

	/**
	 * Generate fallback analysis when LLM fails
	 * @private
	 */
	_generateFallbackAnalysis(queries, userMetrics) {
		const queryCount = userMetrics.queryCount || queries.length || 0;
		let engagementPattern = 'casual';

		if (queryCount > 50) engagementPattern = 'heavy';
		else if (queryCount > 15) engagementPattern = 'regular';

		return {
			behaviorSummary: `User has made ${queryCount} queries and shows ${engagementPattern} engagement with financial planning tools.`,
			primaryInterests: [userMetrics.mostCommonQueryType || 'financial planning', 'budgeting', 'saving'],
			insights: [
				`User has completed ${queryCount} financial queries`,
				`Primary focus area appears to be ${userMetrics.mostCommonQueryType || 'general financial planning'}`,
				`Maintains a ${userMetrics.successRate || '95'}% success rate in interactions`
			],
			recommendations: [
				"Continue exploring personalized financial insights",
				"Set up regular budget reviews",
				"Consider long-term financial goal planning"
			],
			riskLevel: 'medium',
			engagementPattern,
			nextBestAction: "Explore advanced financial planning features",
			generatedAt: new Date().toISOString(),
			confidence: 'medium'
		};
	}

	/**
	 * Calculate query type distribution
	 * @private
	 */
	_calculateQueryTypeDistribution(queryTypes) {
		const distribution = {};
		queryTypes.forEach(type => {
			distribution[type] = (distribution[type] || 0) + 1;
		});
		return distribution;
	}

	/**
	 * Get batch analysis for multiple users
	 * @param {Array} userDataList - Array of user data objects
	 * @returns {Promise<Array>} Array of analysis results
	 */
	async analyzeBatchUsers(userDataList) {
		const results = [];

		for (const userData of userDataList) {
			try {
				const analysis = await this.analyzeUserQueryPatterns(
					userData.userId,
					userData.recentQueries || [],
					userData
				);

				results.push({
					userId: userData.userId,
					analysis
				});
			} catch (error) {
				logger.error(`Failed to analyze user ${userData.userId}:`, error);
				results.push({
					userId: userData.userId,
					analysis: this._generateFallbackAnalysis(userData.recentQueries || [], userData),
					error: error.message
				});
			}
		}

		return results;
	}

	/**
	 * Clean up cache periodically
	 */
	cleanupCache() {
		const now = Date.now();
		for (const [key, value] of this.analysisCache.entries()) {
			if (value.generatedAt && (now - new Date(value.generatedAt).getTime()) > this.cacheTimeout) {
				this.analysisCache.delete(key);
			}
		}
	}
}

// Create and export singleton instance
const queryAnalysisAgent = new QueryAnalysisAgent();

module.exports = queryAnalysisAgent;