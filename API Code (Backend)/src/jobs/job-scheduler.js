// src/jobs/job-scheduler.js
const cron = require('node-cron');
const { resetQuotasJob } = require('./quota-reset.job');
const logger = require('../utils/logger');

/**
 * Initialize and schedule all recurring jobs
 */
const initializeJobs = () => {
	try {
		logger.info('Initializing scheduled jobs');

		// Schedule quota reset job to run at midnight on the 1st of each month
		cron.schedule('0 0 1 * *', async () => {
			try {
				logger.info('Running scheduled quota reset job');
				await resetQuotasJob();
			} catch (error) {
				logger.error('Error executing scheduled quota reset job:', error);
			}
		});

		// Schedule a job to run the quota reset at startup as well (in case it was missed)
		// This will check for any clients that should have been reset but weren't
		setTimeout(async () => {
			try {
				logger.info('Running startup quota reset check');
				await resetQuotasJob();
			} catch (error) {
				logger.error('Error executing startup quota reset check:', error);
			}
		}, 5000); // Wait 5 seconds after initialization

		logger.info('All jobs scheduled successfully');
		return true;
	} catch (error) {
		logger.error('Failed to initialize scheduled jobs:', error);
		return false;
	}
};

module.exports = {
	initializeJobs
};