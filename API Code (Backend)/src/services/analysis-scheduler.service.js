// services/analysis-scheduler.service.js - Fixed for older node-cron versions
const cron = require('node-cron');
const userAnalysisService = require('./user-analysis-background.service');
const logger = require('../utils/logger');

class AnalysisSchedulerService {
	constructor() {
		this.jobs = new Map();
		this.isEnabled = process.env.ENABLE_BACKGROUND_ANALYSIS === 'true';
	}

	// Start all scheduled jobs
	start() {
		if (!this.isEnabled) {
			logger.info('Background analysis scheduler is disabled');
			return;
		}

		logger.info('Starting analysis scheduler service');

		// Daily full analysis at 2 AM
		this.scheduleJob('daily-analysis', '0 2 * * *', async () => {
			logger.info('Starting scheduled daily user analysis');
			try {
				await userAnalysisService.processAllUsers({
					batchSize: 10,
					maxAgeHours: 24,
					forceRefresh: false
				});
				logger.info('Scheduled daily analysis completed');
			} catch (error) {
				logger.error('Scheduled daily analysis failed:', error);
			}
		});

		// Incremental analysis every 4 hours during business hours
		this.scheduleJob('incremental-analysis', '0 */4 8-20 * * *', async () => {
			logger.info('Starting scheduled incremental user analysis');
			try {
				await userAnalysisService.processAllUsers({
					batchSize: 5,
					maxAgeHours: 4,
					forceRefresh: false
				});
				logger.info('Scheduled incremental analysis completed');
			} catch (error) {
				logger.error('Scheduled incremental analysis failed:', error);
			}
		});

		// Quick refresh for highly active users every hour
		this.scheduleJob('active-users-refresh', '0 * * * *', async () => {
			logger.info('Starting active users refresh');
			try {
				// This would target users with recent activity - implement based on your needs
				await userAnalysisService.processAllUsers({
					batchSize: 3,
					maxAgeHours: 1,
					forceRefresh: false
				});
				logger.info('Active users refresh completed');
			} catch (error) {
				logger.error('Active users refresh failed:', error);
			}
		});
	}

	// Schedule a job - Fixed for older node-cron versions
	scheduleJob(name, cronPattern, task) {
		try {
			const job = cron.schedule(cronPattern, task, {
				scheduled: true,
				timezone: 'UTC'
			});

			// Store job info without using nextDates() method
			this.jobs.set(name, {
				job,
				pattern: cronPattern,
				lastRun: null,
				nextRun: this.calculateNextRun(cronPattern) // Custom method instead of job.nextDates()
			});

			logger.info(`Scheduled job '${name}' with pattern '${cronPattern}'`);
		} catch (error) {
			logger.error(`Failed to schedule job '${name}':`, error);
		}
	}

	// Custom method to calculate next run time (simplified)
	calculateNextRun(cronPattern) {
		try {
			// Simple approximation - for production you might want to use a cron parser library
			const now = new Date();
			const patterns = {
				'0 2 * * *': this.getNextDailyTime(2, 0), // Daily at 2 AM
				'0 */4 8-20 * * *': this.getNextIntervalTime(4), // Every 4 hours during 8-20
				'0 * * * *': this.getNextHourlyTime() // Every hour
			};

			return patterns[cronPattern] || 'Next run time unavailable';
		} catch (error) {
			return 'Next run time calculation failed';
		}
	}

	getNextDailyTime(hour, minute) {
		const now = new Date();
		const next = new Date();
		next.setHours(hour, minute, 0, 0);

		// If time has passed today, set to tomorrow
		if (next <= now) {
			next.setDate(next.getDate() + 1);
		}

		return next.toISOString();
	}

	getNextIntervalTime(intervalHours) {
		const now = new Date();
		const currentHour = now.getHours();

		// Find next interval within business hours (8-20)
		let nextHour = Math.ceil(currentHour / intervalHours) * intervalHours;

		if (nextHour >= 20 || nextHour < 8) {
			// Next business day at 8 AM
			const next = new Date(now);
			next.setDate(next.getDate() + 1);
			next.setHours(8, 0, 0, 0);
			return next.toISOString();
		}

		const next = new Date(now);
		next.setHours(nextHour, 0, 0, 0);
		return next.toISOString();
	}

	getNextHourlyTime() {
		const now = new Date();
		const next = new Date(now);
		next.setMinutes(0, 0, 0);
		next.setHours(next.getHours() + 1);
		return next.toISOString();
	}

	// Stop all jobs
	stop() {
		logger.info('Stopping analysis scheduler service');

		this.jobs.forEach((jobInfo, name) => {
			try {
				jobInfo.job.stop();
				logger.info(`Stopped job '${name}'`);
			} catch (error) {
				logger.error(`Error stopping job '${name}':`, error);
			}
		});
	}

	// Get scheduler status
	getStatus() {
		const jobStatuses = {};

		this.jobs.forEach((jobInfo, name) => {
			jobStatuses[name] = {
				pattern: jobInfo.pattern,
				running: jobInfo.job ? true : false, // Simplified check
				lastRun: jobInfo.lastRun,
				nextRun: jobInfo.nextRun
			};
		});

		return {
			enabled: this.isEnabled,
			totalJobs: this.jobs.size,
			jobs: jobStatuses,
			backgroundService: userAnalysisService ? userAnalysisService.getStatus() : { available: false }
		};
	}

	// Manually trigger analysis
	async triggerAnalysis(options = {}) {
		logger.info('Manually triggering user analysis');

		try {
			if (!userAnalysisService) {
				throw new Error('User analysis service not available');
			}

			const result = await userAnalysisService.processAllUsers({
				batchSize: options.batchSize || 5,
				maxAgeHours: options.maxAgeHours || 24,
				forceRefresh: options.forceRefresh || false
			});

			logger.info('Manual analysis trigger completed');
			return result;
		} catch (error) {
			logger.error('Manual analysis trigger failed:', error);
			throw error;
		}
	}

	// Check if cron validation works
	validateCronPattern(pattern) {
		try {
			return cron.validate(pattern);
		} catch (error) {
			logger.warn('Cron validation not available in this version');
			return true; // Assume valid if validation method doesn't exist
		}
	}
}

module.exports = new AnalysisSchedulerService();