// models/InsightMetrics.js - Factory function version
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const InsightMetrics = sequelize.define('InsightMetrics', {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
			allowNull: false
		},
		userId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'Users',
				key: 'id'
			},
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE'
		},
		queryId: {
			type: DataTypes.STRING(255),
			allowNull: false,
			unique: true
		},
		query: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		queryType: {
			type: DataTypes.STRING(50),
			allowNull: false,
			defaultValue: 'general'
		},
		responseTime: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null
		},
		success: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
			defaultValue: true
		},
		errorMessage: {
			type: DataTypes.TEXT,
			allowNull: true,
			defaultValue: null
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW
		}
	}, {
		tableName: 'InsightMetrics',
		timestamps: true, // This enables automatic createdAt and updatedAt
		indexes: [
			{
				unique: true,
				fields: ['queryId'],
				name: 'InsightMetrics_queryId_key'
			},
			{
				fields: ['userId'],
				name: 'insight_metrics_user_id_idx'
			},
			{
				fields: ['queryType'],
				name: 'insight_metrics_query_type_idx'
			},
			{
				fields: ['createdAt'],
				name: 'insight_metrics_created_at_idx'
			},
			{
				fields: ['success'],
				name: 'insight_metrics_success_idx'
			}
		]
	});

	// Instance methods
	InsightMetrics.prototype.toJSON = function () {
		const values = Object.assign({}, this.get());

		// Format dates consistently
		if (values.createdAt) {
			values.createdAt = values.createdAt.toISOString();
		}
		if (values.updatedAt) {
			values.updatedAt = values.updatedAt.toISOString();
		}

		return values;
	};

	InsightMetrics.prototype.getFormattedResponseTime = function () {
		if (!this.responseTime) return 'N/A';

		if (this.responseTime < 1000) {
			return `${this.responseTime}ms`;
		} else {
			return `${(this.responseTime / 1000).toFixed(2)}s`;
		}
	};

	InsightMetrics.prototype.isRecentQuery = function (hoursAgo = 24) {
		if (!this.createdAt) return false;

		const hoursAgoTimestamp = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000));
		return this.createdAt >= hoursAgoTimestamp;
	};

	// Static methods for common queries
	InsightMetrics.getUserMetrics = async function (userId, options = {}) {
		const {
			limit = 50,
			offset = 0,
			queryType = null,
			startDate = null,
			endDate = null,
			successOnly = null
		} = options;

		const whereClause = { userId };

		if (queryType) {
			whereClause.queryType = queryType;
		}

		if (startDate || endDate) {
			whereClause.createdAt = {};
			if (startDate) whereClause.createdAt[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) whereClause.createdAt[sequelize.Sequelize.Op.lte] = endDate;
		}

		if (successOnly !== null) {
			whereClause.success = successOnly;
		}

		return await this.findAll({
			where: whereClause,
			order: [['createdAt', 'DESC']],
			limit,
			offset
		});
	};

	InsightMetrics.getUserStats = async function (userId) {
		const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as "totalQueries",
        COUNT(CASE WHEN success = true THEN 1 END) as "successfulQueries",
        COUNT(CASE WHEN success = false THEN 1 END) as "failedQueries",
        AVG(CASE WHEN "responseTime" IS NOT NULL AND "responseTime" > 0 THEN "responseTime" END) as "avgResponseTime",
        MIN(CASE WHEN "responseTime" IS NOT NULL AND "responseTime" > 0 THEN "responseTime" END) as "minResponseTime",
        MAX(CASE WHEN "responseTime" IS NOT NULL AND "responseTime" > 0 THEN "responseTime" END) as "maxResponseTime",
        MODE() WITHIN GROUP (ORDER BY "queryType") as "mostCommonQueryType"
      FROM "InsightMetrics"
      WHERE "userId" = :userId
    `, {
			replacements: { userId },
			type: sequelize.QueryTypes.SELECT,
			plain: true
		});

		if (stats) {
			stats.successRate = stats.totalQueries > 0
				? ((stats.successfulQueries / stats.totalQueries) * 100).toFixed(1) + '%'
				: '0.0%';

			stats.avgResponseTime = stats.avgResponseTime ? Math.round(stats.avgResponseTime) : 0;
			stats.minResponseTime = stats.minResponseTime || 0;
			stats.maxResponseTime = stats.maxResponseTime || 0;
		}

		return stats || {
			totalQueries: 0,
			successfulQueries: 0,
			failedQueries: 0,
			avgResponseTime: 0,
			minResponseTime: 0,
			maxResponseTime: 0,
			mostCommonQueryType: null,
			successRate: '0.0%'
		};
	};

	InsightMetrics.getQueryTypeDistribution = async function (userId = null) {
		const whereClause = userId ? 'WHERE "userId" = :userId' : '';
		const replacements = userId ? { userId } : {};

		const results = await sequelize.query(`
      SELECT 
        "queryType",
        COUNT(*) as "count",
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 1) as "percentage"
      FROM "InsightMetrics"
      ${whereClause}
      GROUP BY "queryType"
      ORDER BY "count" DESC
    `, {
			replacements,
			type: sequelize.QueryTypes.SELECT
		});

		return results.map(row => ({
			queryType: row.queryType,
			count: parseInt(row.count),
			percentage: parseFloat(row.percentage)
		}));
	};

	InsightMetrics.getSystemStats = async function () {
		const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as "totalQueries",
        COUNT(CASE WHEN success = true THEN 1 END) as "successfulQueries",
        COUNT(CASE WHEN success = false THEN 1 END) as "failedQueries",
        AVG(CASE WHEN "responseTime" IS NOT NULL AND "responseTime" > 0 THEN "responseTime" END) as "avgResponseTime",
        COUNT(CASE WHEN "createdAt" >= CURRENT_DATE THEN 1 END) as "todayQueries",
        COUNT(DISTINCT "userId") as "activeUsers"
      FROM "InsightMetrics"
    `, {
			type: sequelize.QueryTypes.SELECT,
			plain: true
		});

		if (stats) {
			stats.successRate = stats.totalQueries > 0
				? ((stats.successfulQueries / stats.totalQueries) * 100).toFixed(1) + '%'
				: '0.0%';

			stats.avgResponseTime = stats.avgResponseTime ? Math.round(stats.avgResponseTime) : 0;
		}

		return stats || {
			totalQueries: 0,
			successfulQueries: 0,
			failedQueries: 0,
			avgResponseTime: 0,
			todayQueries: 0,
			activeUsers: 0,
			successRate: '0.0%'
		};
	};

	InsightMetrics.getHourlyActivity = async function (userId = null, days = 7) {
		const whereClause = userId ? 'AND "userId" = :userId' : '';
		const replacements = { days };
		if (userId) replacements.userId = userId;

		const results = await sequelize.query(`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as "hour",
        COUNT(*) as "count"
      FROM "InsightMetrics"
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${days} days'
      ${whereClause}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY "hour"
    `, {
			replacements,
			type: sequelize.QueryTypes.SELECT
		});

		// Fill in missing hours with 0
		const hourlyData = Array(24).fill(0);
		results.forEach(row => {
			const hour = parseInt(row.hour);
			if (hour >= 0 && hour < 24) {
				hourlyData[hour] = parseInt(row.count);
			}
		});

		return hourlyData;
	};

	InsightMetrics.getDailyActivity = async function (userId = null, days = 7) {
		const whereClause = userId ? 'AND "userId" = :userId' : '';
		const replacements = { days };
		if (userId) replacements.userId = userId;

		const results = await sequelize.query(`
      SELECT 
        DATE("createdAt") as "date",
        COUNT(*) as "count"
      FROM "InsightMetrics"
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${days} days'
      ${whereClause}
      GROUP BY DATE("createdAt")
      ORDER BY "date"
    `, {
			replacements,
			type: sequelize.QueryTypes.SELECT
		});

		return results.map(row => ({
			date: row.date,
			count: parseInt(row.count)
		}));
	};

	// Static method to set up associations
	InsightMetrics.associate = function (models) {
		if (models.User) {
			// InsightMetrics belongs to User
			InsightMetrics.belongsTo(models.User, {
				foreignKey: 'userId',
				as: 'user'
			});

			// User has many InsightMetrics
			models.User.hasMany(InsightMetrics, {
				foreignKey: 'userId',
				as: 'insightMetrics'
			});
		}
	};

	return InsightMetrics;
};