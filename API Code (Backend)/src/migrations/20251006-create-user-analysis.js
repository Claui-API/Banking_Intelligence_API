// migrations/YYYYMMDD-create-user-analysis.js
'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('UserAnalyses', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			userId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'Users',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			// Core metrics (cached from middleware)
			queryCount: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			successCount: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			failedCount: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			avgResponseTime: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			successRate: {
				type: Sequelize.DECIMAL(5, 2),
				defaultValue: 0.00
			},
			engagementScore: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			mostCommonQueryType: {
				type: Sequelize.STRING,
				defaultValue: 'general'
			},

			// AI Analysis Results (JSON fields)
			behaviorSummary: {
				type: Sequelize.TEXT
			},
			primaryInterests: {
				type: Sequelize.JSON // Array of strings
			},
			insights: {
				type: Sequelize.JSON // Array of insights
			},
			recommendations: {
				type: Sequelize.JSON // Array of recommendations
			},
			riskLevel: {
				type: Sequelize.ENUM('low', 'medium', 'high'),
				defaultValue: 'medium'
			},
			engagementPattern: {
				type: Sequelize.ENUM('casual', 'regular', 'heavy'),
				defaultValue: 'casual'
			},
			nextBestAction: {
				type: Sequelize.TEXT
			},
			confidence: {
				type: Sequelize.ENUM('low', 'medium', 'high'),
				defaultValue: 'medium'
			},

			// Activity patterns
			queryTypes: {
				type: Sequelize.JSON // Object with query type counts
			},
			activityByHour: {
				type: Sequelize.JSON // Array of 24 numbers
			},
			activityByDay: {
				type: Sequelize.JSON // Array of 7 numbers  
			},

			// Metadata
			lastAnalyzedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.NOW
			},
			dataVersion: {
				type: Sequelize.INTEGER,
				defaultValue: 1
			},
			analysisSource: {
				type: Sequelize.ENUM('ai', 'fallback', 'manual'),
				defaultValue: 'ai'
			},

			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		});

		// Add indexes for performance
		await queryInterface.addIndex('UserAnalyses', ['userId'], {
			unique: true,
			name: 'user_analyses_user_id_unique'
		});

		await queryInterface.addIndex('UserAnalyses', ['lastAnalyzedAt']);
		await queryInterface.addIndex('UserAnalyses', ['engagementScore']);
		await queryInterface.addIndex('UserAnalyses', ['riskLevel']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('UserAnalyses');
	}
};