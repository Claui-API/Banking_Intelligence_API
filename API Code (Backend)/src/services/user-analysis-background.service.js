// services/user-analysis-background.service.js
const { User, UserAnalysis } = require('../models');
const { getUserInsightMetrics } = require('../middleware/insights-metrics.middleware');
const logger = require('../utils/logger');

// Try to load query analysis agent
let queryAnalysisAgent = null;
try {
	queryAnalysisAgent = require('./query-analysis-agent.service');
} catch (error) {
	logger.warn('Query Analysis Agent not available for background service');
}

class UserAnalysisBackgroundService {
	constructor() {
		this.isRunning = false;
		this.processedCount = 0;
		this.errorCount = 0;
		this.currentBatch = [];
	}

	// Get recent queries for a user (same as controller)
	async getRecentQueriesForUser(userId, limit = 10) {
		try {
			const { sequelize } = require('../models');
			const queries = await sequelize.query(`
        SELECT 
          "queryType",
          "responseTime",
          "createdAt",
          "success",
          "query"
        FROM "InsightMetrics"
        WHERE "userId" = :userId
        ORDER BY "createdAt" DESC
        LIMIT :limit
      `, {
				replacements: { userId, limit },
				type: sequelize.QueryTypes.SELECT
			});

			return queries.map(q => ({
				query: q.query || 'Query text not available',
				queryType: q.queryType || 'general',
				processingTime: q.responseTime || 0,
				createdAt: q.createdAt,
				success: q.success !== false
			}));
		} catch (error) {
			logger.error(`Error getting recent queries for user ${userId}:`, error);
			return [];
		}
	}

	// Generate fallback analysis when AI is not available
	generateFallbackAnalysis(recentQueries, userMetrics) {
		const queryCount = userMetrics.queryCount || 0;
		let engagementPattern = 'casual';

		if (queryCount > 50) engagementPattern = 'heavy';
		else if (queryCount > 15) engagementPattern = 'regular';

		const queryTypes = recentQueries.map(q => q.queryType || 'general');
		const typeFrequency = {};
		queryTypes.forEach(type => {
			typeFrequency[type] = (typeFrequency[type] || 0) + 1;
		});

		const topTypes = Object.entries(typeFrequency)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([type]) => type);

		return {
			behaviorSummary: `User has made ${queryCount} queries and shows ${engagementPattern} engagement with financial planning tools.`,
			primaryInterests: topTypes.length > 0 ? topTypes : ['financial planning', 'budgeting'],
			insights: [
				`User has completed ${queryCount} financial queries`,
				`Primary focus area appears to be ${userMetrics.mostCommonQueryType || 'general financial planning'}`,
				`Maintains a ${userMetrics.successRate || '95'}% success rate in interactions`
			].slice(0, 3),
			recommendations: [
				"Continue exploring personalized financial insights",
				"Set up regular budget reviews",
				"Consider long-term financial goal planning"
			],
			riskLevel: 'medium',
			engagementPattern,
			nextBestAction: "Explore advanced financial planning features",
			confidence: 'low'
		};
	}

	// Calculate engagement score
	calculateEngagementScore(metrics, recentQueries) {
		let score = 0;

		const queryCount = metrics.queryCount || 0;
		if (queryCount > 100) score += 40;
		else if (queryCount > 50) score += 30;
		else if (queryCount > 20) score += 20;
		else if (queryCount > 5) score += 10;

		const successRate = parseFloat(metrics.successRate || 0);
		score += Math.floor(successRate / 4);

		if (recentQueries.length > 10) score += 20;
		else if (recentQueries.length > 5) score += 15;
		else if (recentQueries.length > 0) score += 10;

		const avgResponseTime = metrics.avgResponseTime || 1000;
		if (avgResponseTime < 500) score += 15;
		else if (avgResponseTime < 1000) score += 10;
		else if (avgResponseTime < 2000) score += 5;

		return Math.min(100, score);
	}

	// Analyze a single user
	async analyzeUser(userId) {
		try {
			logger.info(`Starting analysis for user ${userId}`);

			// Get user details
			const user = await User.findByPk(userId);
			if (!user) {
				logger.warn(`User ${userId} not found, skipping analysis`);
				return null;
			}

			// CRITICAL FIX: Get current metrics from the middleware (includes queryTypes)
			const allMetrics = await getUserInsightMetrics();
			const userMetric = allMetrics.find(m => m.userId === userId);

			if (!userMetric) {
				logger.warn(`No metrics found for user ${userId}, skipping analysis`);
				return null;
			}

			// Get recent queries
			const recentQueries = await this.getRecentQueriesForUser(userId);

			// Generate AI analysis or fallback
			let analysisResult;
			let analysisSource = 'fallback';

			try {
				if (queryAnalysisAgent && typeof queryAnalysisAgent.analyzeUserQueryPatterns === 'function') {
					logger.info(`Generating AI analysis for user ${userId}`);
					analysisResult = await queryAnalysisAgent.analyzeUserQueryPatterns(
						userId,
						recentQueries,
						userMetric
					);
					analysisSource = 'ai';
					logger.info(`AI analysis completed for user ${userId}`);
				} else {
					throw new Error('AI agent not available');
				}
			} catch (error) {
				logger.warn(`AI analysis failed for user ${userId}, using fallback:`, error.message);
				analysisResult = this.generateFallbackAnalysis(recentQueries, userMetric);
				analysisSource = 'fallback';
			}

			// Calculate engagement score
			const engagementScore = this.calculateEngagementScore(userMetric, recentQueries);

			// CRITICAL FIX: Use queryTypes from middleware (this includes the aggregated data)
			const queryTypes = userMetric.queryTypes || {};

			// Log the queryTypes data for debugging
			logger.info(`User ${userId} queryTypes:`, queryTypes);

			// Prepare data for database
			const analysisData = {
				userId: userId,
				queryCount: userMetric.queryCount,
				successCount: userMetric.successCount,
				failedCount: userMetric.failedCount,
				avgResponseTime: userMetric.avgResponseTime,
				successRate: userMetric.successRate,
				engagementScore,
				mostCommonQueryType: userMetric.mostCommonQueryType,

				behaviorSummary: analysisResult.behaviorSummary,
				primaryInterests: analysisResult.primaryInterests,
				insights: analysisResult.insights,
				recommendations: analysisResult.recommendations,
				riskLevel: analysisResult.riskLevel,
				engagementPattern: analysisResult.engagementPattern,
				nextBestAction: analysisResult.nextBestAction,
				confidence: analysisResult.confidence,

				// CRITICAL FIX: Store the aggregated queryTypes from middleware
				queryTypes: queryTypes,
				activityByHour: userMetric.activityByHour || Array(24).fill(0),
				activityByDay: userMetric.activityByDay || Array(7).fill(0),

				lastAnalyzedAt: new Date(),
				analysisSource,
				dataVersion: 1
			};

			// Debug log the data being stored
			logger.info(`Storing analysis for user ${userId}:`, {
				queryTypes: analysisData.queryTypes,
				queryTypesKeys: Object.keys(analysisData.queryTypes),
				queryTypesCount: Object.keys(analysisData.queryTypes).length
			});

			// Upsert the analysis
			const [analysis, created] = await UserAnalysis.upsert(analysisData, {
				returning: true
			});

			logger.info(`Analysis ${created ? 'created' : 'updated'} for user ${userId} (source: ${analysisSource})`);

			return analysis;

		} catch (error) {
			logger.error(`Error analyzing user ${userId}:`, error);
			this.errorCount++;
			throw error;
		}
	}

	// Process all users that need analysis
	async processAllUsers(options = {}) {
		const {
			batchSize = 5, // Process 5 users at a time
			maxAgeHours = 24, // Re-analyze after 24 hours
			forceRefresh = false
		} = options;

		if (this.isRunning) {
			logger.warn('Background analysis is already running');
			return;
		}

		this.isRunning = true;
		this.processedCount = 0;
		this.errorCount = 0;

		try {
			logger.info('Starting background user analysis process');

			// Get all users who need analysis
			const usersNeedingAnalysis = await this.getUsersNeedingAnalysis(maxAgeHours, forceRefresh);

			if (usersNeedingAnalysis.length === 0) {
				logger.info('No users need analysis at this time');
				return;
			}

			logger.info(`Found ${usersNeedingAnalysis.length} users needing analysis`);

			// Process in batches to avoid overwhelming the system
			for (let i = 0; i < usersNeedingAnalysis.length; i += batchSize) {
				const batch = usersNeedingAnalysis.slice(i, i + batchSize);
				this.currentBatch = batch.map(u => u.id);

				logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}: users ${batch.map(u => u.id).join(', ')}`);

				// Process batch in parallel
				const promises = batch.map(user => this.analyzeUser(user.id));
				const results = await Promise.allSettled(promises);

				// Count results
				results.forEach((result, index) => {
					if (result.status === 'fulfilled') {
						this.processedCount++;
						logger.info(`Successfully processed user ${batch[index].id}`);
					} else {
						this.errorCount++;
						logger.error(`Failed to process user ${batch[index].id}:`, result.reason);
					}
				});

				// Brief pause between batches to avoid overwhelming the database
				if (i + batchSize < usersNeedingAnalysis.length) {
					await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause
				}
			}

			logger.info(`Background analysis completed: ${this.processedCount} processed, ${this.errorCount} errors`);

		} catch (error) {
			logger.error('Background analysis process failed:', error);
		} finally {
			this.isRunning = false;
			this.currentBatch = [];
		}
	}

	// Get users who need analysis
	async getUsersNeedingAnalysis(maxAgeHours = 24, forceRefresh = false) {
		try {
			if (forceRefresh) {
				// Get all active users
				return await User.findAll({
					where: {
						// Add any conditions for active users
					},
					attributes: ['id', 'email', 'clientName'],
					limit: 100 // Safety limit
				});
			}

			// Get users with stale or missing analysis - FIXED SQL QUERY
			const staleDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

			// Method 1: Simple approach - get all users and filter programmatically
			const allUsers = await User.findAll({
				include: [{
					model: UserAnalysis,
					as: 'UserAnalysis',
					required: false,
					where: {
						[sequelize.Sequelize.Op.or]: [
							{ id: null }, // This won't work in include, so we'll filter below
							{ lastAnalyzedAt: { [sequelize.Sequelize.Op.lt]: staleDate } }
						]
					}
				}],
				attributes: ['id', 'email', 'clientName'],
				limit: 100
			});

			// Filter to get users with no analysis or stale analysis
			const usersNeedingAnalysis = allUsers.filter(user => {
				// No analysis exists
				if (!user.UserAnalysis) return true;

				// Analysis is stale
				if (user.UserAnalysis.lastAnalyzedAt < staleDate) return true;

				return false;
			});

			return usersNeedingAnalysis;

		} catch (error) {
			logger.error('Error getting users needing analysis:', error);

			// Fallback: Use raw SQL query that definitely works
			try {
				const { sequelize } = require('../models');
				const staleDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

				const results = await sequelize.query(`
          SELECT u.id, u.email, u."clientName"
          FROM "Users" u
          LEFT JOIN "UserAnalyses" ua ON u.id = ua."userId"
          WHERE u."deletedAt" IS NULL
          AND (ua.id IS NULL OR ua."lastAnalyzedAt" < :staleDate)
          LIMIT 100
        `, {
					replacements: { staleDate },
					type: sequelize.QueryTypes.SELECT
				});

				return results.map(r => ({
					id: r.id,
					email: r.email,
					clientName: r.clientName
				}));

			} catch (rawSqlError) {
				logger.error('Fallback raw SQL also failed:', rawSqlError);
				return [];
			}
		}
	}

	// Get current status
	getStatus() {
		return {
			isRunning: this.isRunning,
			processedCount: this.processedCount,
			errorCount: this.errorCount,
			currentBatch: this.currentBatch,
			agentAvailable: queryAnalysisAgent !== null
		};
	}

	// Force analyze specific users
	async analyzeSpecificUsers(userIds) {
		if (!Array.isArray(userIds)) {
			throw new Error('userIds must be an array');
		}

		logger.info(`Force analyzing ${userIds.length} specific users`);

		const results = [];
		for (const userId of userIds) {
			try {
				const result = await this.analyzeUser(userId);
				results.push({ userId, success: true, result });
			} catch (error) {
				results.push({ userId, success: false, error: error.message });
			}
		}

		return results;
	}
}

module.exports = new UserAnalysisBackgroundService();