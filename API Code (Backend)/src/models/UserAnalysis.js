// models/UserAnalysis.js - Factory function version compatible with your model loading pattern
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const UserAnalysis = sequelize.define('UserAnalysis', {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		userId: {
			type: DataTypes.UUID,
			allowNull: false,
			unique: true,
			references: {
				model: 'Users',
				key: 'id'
			},
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE'
		},

		// Core metrics (cached from middleware)
		queryCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		successCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		failedCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		avgResponseTime: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		successRate: {
			type: DataTypes.DECIMAL(5, 2),
			defaultValue: 0.00
		},
		engagementScore: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		mostCommonQueryType: {
			type: DataTypes.STRING,
			defaultValue: 'general'
		},

		// AI Analysis Results (JSON fields)
		behaviorSummary: {
			type: DataTypes.TEXT
		},
		primaryInterests: {
			type: DataTypes.JSON // Array of strings
		},
		insights: {
			type: DataTypes.JSON // Array of insights
		},
		recommendations: {
			type: DataTypes.JSON // Array of recommendations
		},
		riskLevel: {
			type: DataTypes.ENUM('low', 'medium', 'high'),
			defaultValue: 'medium'
		},
		engagementPattern: {
			type: DataTypes.ENUM('casual', 'regular', 'heavy'),
			defaultValue: 'casual'
		},
		nextBestAction: {
			type: DataTypes.TEXT
		},
		confidence: {
			type: DataTypes.ENUM('low', 'medium', 'high'),
			defaultValue: 'medium'
		},

		// Activity patterns
		queryTypes: {
			type: DataTypes.JSON // Object with query type counts
		},
		activityByHour: {
			type: DataTypes.JSON // Array of 24 numbers
		},
		activityByDay: {
			type: DataTypes.JSON // Array of 7 numbers  
		},

		// Metadata
		lastAnalyzedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW
		},
		dataVersion: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		analysisSource: {
			type: DataTypes.ENUM('ai', 'fallback', 'manual'),
			defaultValue: 'ai'
		}
	}, {
		tableName: 'UserAnalyses',
		indexes: [
			{
				unique: true,
				fields: ['userId'],
				name: 'user_analyses_user_id_unique'
			},
			{
				fields: ['lastAnalyzedAt'],
				name: 'user_analyses_last_analyzed_idx'
			},
			{
				fields: ['engagementScore'],
				name: 'user_analyses_engagement_idx'
			},
			{
				fields: ['riskLevel'],
				name: 'user_analyses_risk_level_idx'
			}
		]
	});

	// Instance methods
	UserAnalysis.prototype.isStale = function (maxAgeHours = 24) {
		if (!this.lastAnalyzedAt) return true;

		const ageInHours = (Date.now() - this.lastAnalyzedAt.getTime()) / (1000 * 60 * 60);
		return ageInHours > maxAgeHours;
	};

	UserAnalysis.prototype.toAPIResponse = function () {
		return {
			userId: this.userId,
			queryCount: this.queryCount,
			successCount: this.successCount,
			failedCount: this.failedCount,
			avgResponseTime: this.avgResponseTime,
			successRate: parseFloat(this.successRate),
			engagementScore: this.engagementScore,
			mostCommonQueryType: this.mostCommonQueryType,

			queryAnalysis: {
				behaviorSummary: this.behaviorSummary,
				primaryInterests: this.primaryInterests || [],
				insights: this.insights || [],
				recommendations: this.recommendations || [],
				riskLevel: this.riskLevel,
				engagementPattern: this.engagementPattern,
				nextBestAction: this.nextBestAction,
				confidence: this.confidence,
				generatedAt: this.lastAnalyzedAt
			},

			queryTypes: this.queryTypes || {},
			activityByHour: this.activityByHour || Array(24).fill(0),
			activityByDay: this.activityByDay || Array(7).fill(0),

			lastAnalyzedAt: this.lastAnalyzedAt,
			analysisSource: this.analysisSource
		};
	};

	// Static method to set up associations
	UserAnalysis.associate = function (models) {
		if (models.User) {
			// UserAnalysis belongs to User
			UserAnalysis.belongsTo(models.User, {
				foreignKey: 'userId',
				as: 'user'
			});

			// User has one UserAnalysis
			models.User.hasOne(UserAnalysis, {
				foreignKey: 'userId',
				as: 'UserAnalysis'
			});
		}
	};

	// Static helper methods
	UserAnalysis.findStaleAnalyses = async function (maxAgeHours = 24) {
		const staleDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

		return await this.findAll({
			where: {
				lastAnalyzedAt: {
					[sequelize.Sequelize.Op.lt]: staleDate
				}
			},
			include: [{
				model: sequelize.models.User,
				as: 'user',
				attributes: ['id', 'email', 'clientName']
			}],
			order: [['lastAnalyzedAt', 'ASC']]
		});
	};

	UserAnalysis.findByUserId = async function (userId) {
		return await this.findOne({
			where: { userId },
			include: [{
				model: sequelize.models.User,
				as: 'user',
				attributes: ['id', 'email', 'clientName']
			}]
		});
	};

	UserAnalysis.getAnalysisStats = async function () {
		const total = await this.count();
		const recent = await this.count({
			where: {
				lastAnalyzedAt: {
					[sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
				}
			}
		});

		const bySource = await this.findAll({
			attributes: [
				'analysisSource',
				[sequelize.fn('COUNT', sequelize.col('id')), 'count']
			],
			group: ['analysisSource'],
			raw: true
		});

		const sourceStats = {};
		bySource.forEach(stat => {
			sourceStats[stat.analysisSource] = parseInt(stat.count);
		});

		return {
			total,
			recent,
			bySource: sourceStats
		};
	};

	return UserAnalysis;
};