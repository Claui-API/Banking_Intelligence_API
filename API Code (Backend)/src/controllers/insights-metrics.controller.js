// controllers/insights-metrics.controller.js - FIXED VERSION with Recent Queries
const { getUserInsightMetrics, getSystemInsightMetrics, getHistoricalInsightMetrics, getQueryTypeMetrics } = require('../middleware/insights-metrics.middleware');
const { User, UserAnalysis } = require('../models');
const userAnalysisService = require('../services/user-analysis-background.service');
const logger = require('../utils/logger');

class InsightsMetricsController {

  /**
   * Get system-wide insight metrics
   */
  async getSystemMetrics(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const metrics = await getSystemInsightMetrics();

      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting system insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve system insight metrics',
        error: error.message
      });
    }
  }

  /**
   * Get historical insight metrics
   */
  async getHistoricalMetrics(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const days = parseInt(req.query.days) || 7;
      const metrics = await getHistoricalInsightMetrics(days);

      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting historical insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve historical insight metrics',
        error: error.message
      });
    }
  }

  /**
   * Get enhanced user metrics - FIXED VERSION with Recent Queries
   */
  async getUserMetrics(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const enhanced = req.query.enhanced === 'true';

      logger.info(`Getting user metrics (enhanced: ${enhanced})`);

      if (enhanced) {
        // FAST PATH: Use cached analysis from database
        const cachedAnalyses = await UserAnalysis.findAll({
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'clientName']
          }],
          order: [['lastAnalyzedAt', 'DESC']],
          limit: 100 // Safety limit
        });

        if (cachedAnalyses.length > 0) {
          // Transform cached data to API format and include recent queries
          const enrichedMetrics = await Promise.all(
            cachedAnalyses.map(async (analysis) => {
              const user = analysis.user || {};
              const apiResponse = analysis.toAPIResponse();

              try {
                // FIXED: Use the background service method to get recent queries
                const recentQueries = await userAnalysisService.getRecentQueriesForUser(analysis.userId, 10);

                return {
                  ...apiResponse,
                  name: user.clientName || 'Unknown User',
                  email: user.email || `${analysis.userId.substring(0, 8)}...`,
                  lastActive: analysis.lastAnalyzedAt,
                  recentQueries // Include the actual recent queries
                };
              } catch (queryError) {
                logger.error(`Error fetching recent queries for user ${analysis.userId}:`, queryError);
                return {
                  ...apiResponse,
                  name: user.clientName || 'Unknown User',
                  email: user.email || `${analysis.userId.substring(0, 8)}...`,
                  lastActive: analysis.lastAnalyzedAt,
                  recentQueries: [] // Fallback to empty array if queries can't be fetched
                };
              }
            })
          );

          logger.info(`Returned ${enrichedMetrics.length} cached user analyses with recent queries`);

          return res.status(200).json({
            success: true,
            data: enrichedMetrics,
            meta: {
              cached: true,
              totalUsers: enrichedMetrics.length,
              lastUpdated: cachedAnalyses[0]?.lastAnalyzedAt
            }
          });
        }

        // No cached data - trigger background analysis and return basic metrics
        logger.warn('No cached user analyses found, triggering background analysis');

        // Trigger analysis in background (don't wait)
        setImmediate(() => {
          userAnalysisService.processAllUsers({
            batchSize: 5,
            maxAgeHours: 24,
            forceRefresh: false
          }).catch(error => {
            logger.error('Background analysis trigger failed:', error);
          });
        });
      }

      // FALLBACK: Return basic metrics without analysis (fast) - but with recent queries
      const basicMetrics = await getUserInsightMetrics();

      const enrichedBasicMetrics = await Promise.all(
        basicMetrics.slice(0, 20).map(async (metric) => { // Limit to 20 for speed
          try {
            const user = await User.findByPk(metric.userId, {
              attributes: ['id', 'email', 'clientName']
            });

            // FIXED: Get recent queries even for basic metrics
            let recentQueries = [];
            try {
              recentQueries = await userAnalysisService.getRecentQueriesForUser(metric.userId, 5);
            } catch (queryError) {
              logger.warn(`Could not fetch recent queries for user ${metric.userId}:`, queryError.message);
              // Use the recentQueries from the basic metrics if available
              recentQueries = metric.recentQueries || [];
            }

            return {
              ...metric,
              name: user ? user.clientName : 'Unknown User',
              email: user ? user.email : `${metric.userId.substring(0, 8)}...`,

              // Basic analysis fallback
              queryAnalysis: {
                behaviorSummary: `User has made ${metric.queryCount || 0} queries.`,
                primaryInterests: [metric.mostCommonQueryType || 'general'],
                insights: [`User shows ${metric.queryCount > 20 ? 'high' : 'moderate'} engagement`],
                recommendations: ['Continue using the platform regularly'],
                riskLevel: 'medium',
                engagementPattern: metric.queryCount > 50 ? 'heavy' : metric.queryCount > 15 ? 'regular' : 'casual',
                nextBestAction: 'Explore more features',
                confidence: 'low',
                generatedAt: new Date()
              },

              queryTypes: metric.queryTypes || {},
              activityByHour: metric.activityByHour || Array(24).fill(0),
              activityByDay: metric.activityByDay || Array(7).fill(0),
              recentQueries, // FIXED: Include actual recent queries
              engagementScore: Math.min(100, (metric.queryCount || 0) * 2),
              lastAnalyzedAt: null
            };
          } catch (error) {
            logger.error(`Error enriching user ${metric.userId}:`, error);
            return {
              ...metric,
              name: 'Unknown User',
              email: `${metric.userId.substring(0, 8)}...`,
              queryAnalysis: null,
              recentQueries: metric.recentQueries || [], // Use whatever is available
              engagementScore: 0
            };
          }
        })
      );

      logger.info(`Returned ${enrichedBasicMetrics.length} basic user metrics with recent queries`);

      return res.status(200).json({
        success: true,
        data: enrichedBasicMetrics,
        meta: {
          cached: false,
          totalUsers: enrichedBasicMetrics.length,
          message: enhanced ? 'Analysis in progress. Refresh in a few minutes for enhanced data.' : 'Basic metrics'
        }
      });

    } catch (error) {
      logger.error('Error getting user insight metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user insight metrics',
        error: error.message
      });
    }
  }

  /**
   * Get query type distribution metrics
   */
  async getQueryTypeMetrics(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const metrics = await getQueryTypeMetrics();

      const totalQueries = Object.values(metrics).reduce((sum, count) => sum + count, 0);

      const formattedMetrics = Object.entries(metrics)
        .filter(([type, count]) => count > 0)
        .map(([type, count]) => ({
          type: type.charAt(0).toUpperCase() + type.slice(1),
          count,
          percentage: totalQueries > 0 ? ((count / totalQueries) * 100).toFixed(1) : '0.0'
        }))
        .sort((a, b) => b.count - a.count);

      return res.status(200).json({
        success: true,
        data: {
          distribution: metrics,
          formattedData: formattedMetrics,
          totalQueries,
          activeTypes: formattedMetrics.length
        }
      });
    } catch (error) {
      logger.error('Error getting query type metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve query type metrics',
        error: error.message
      });
    }
  }

  /**
   * Manually trigger analysis for specific users
   */
  async triggerUserAnalysis(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const { userIds, forceRefresh = false } = req.body;

      if (userIds && Array.isArray(userIds)) {
        // Analyze specific users
        const results = await userAnalysisService.analyzeSpecificUsers(userIds);

        return res.status(200).json({
          success: true,
          data: {
            results,
            totalRequested: userIds.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          }
        });
      } else {
        // Trigger general analysis
        await userAnalysisService.processAllUsers({
          batchSize: 5,
          maxAgeHours: forceRefresh ? 0 : 24,
          forceRefresh
        });

        return res.status(200).json({
          success: true,
          message: 'User analysis triggered successfully',
          data: userAnalysisService.getStatus()
        });
      }

    } catch (error) {
      logger.error('Error triggering user analysis:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to trigger user analysis',
        error: error.message
      });
    }
  }

  /**
   * Get background analysis status
   */
  async getAnalysisStatus(req, res) {
    try {
      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const status = userAnalysisService.getStatus();

      // Add database stats
      const totalAnalyses = await UserAnalysis.count();
      const recentAnalyses = await UserAnalysis.count({
        where: {
          lastAnalyzedAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          ...status,
          database: {
            totalAnalyses,
            recentAnalyses,
            cacheHitRate: totalAnalyses > 0 ? ((totalAnalyses - status.processedCount) / totalAnalyses * 100).toFixed(1) + '%' : '0%'
          }
        }
      });

    } catch (error) {
      logger.error('Error getting analysis status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get analysis status',
        error: error.message
      });
    }
  }
}

module.exports = new InsightsMetricsController();