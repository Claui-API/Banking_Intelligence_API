// src/services/api-client.js
import axios from 'axios';

// Create an axios instance for API calls
export const apiClient = axios.create({
	baseURL: process.env.REACT_APP_API_URL || '/api',
	timeout: 300000,
	headers: {
		'Content-Type': 'application/json'
	}
});

// Add request interceptor to attach auth token
apiClient.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor to handle common errors
apiClient.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		// Handle unauthorized errors (token expired)
		if (error.response && error.response.status === 401) {
			// Clear token and redirect to login
			localStorage.removeItem('token');
			if (window.location.pathname !== '/login') {
				window.location.href = '/login?expired=true';
			}
		}

		return Promise.reject(error);
	}
);

// Bank client API functions
export const bankClientApi = {
	// Get dashboard statistics
	getDashboardStats: async () => {
		try {
			const response = await apiClient.get('/bank-client/stats');
			return response.data;
		} catch (error) {
			console.error('Error fetching dashboard stats:', error);
			throw error;
		}
	},

	// Get bank users
	getBankUsers: async (params = {}) => {
		try {
			const response = await apiClient.get('/bank-client/users', { params });
			return response.data;
		} catch (error) {
			console.error('Error fetching bank users:', error);
			throw error;
		}
	},

	// Get bank user details
	getBankUserDetails: async (bankUserId) => {
		try {
			const response = await apiClient.get(`/bank-client/users/${bankUserId}/details`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching details for bank user ${bankUserId}:`, error);
			throw error;
		}
	},

	// Get bank user accounts
	getBankUserAccounts: async (bankUserId) => {
		try {
			const response = await apiClient.get(`/bank-client/users/${bankUserId}/accounts`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching accounts for bank user ${bankUserId}:`, error);
			throw error;
		}
	},

	// Get bank user transactions
	getBankUserTransactions: async (bankUserId, params = {}) => {
		try {
			const response = await apiClient.get(`/bank-client/users/${bankUserId}/transactions`, { params });
			return response.data;
		} catch (error) {
			console.error(`Error fetching transactions for bank user ${bankUserId}:`, error);
			throw error;
		}
	},

	// Get activity data
	getActivityData: async (params = {}) => {
		try {
			const response = await apiClient.get('/bank-client/activity', { params });
			return response.data;
		} catch (error) {
			console.error('Error fetching activity data:', error);
			throw error;
		}
	}
};

// Banking Command API functions
export const bankingCommandApi = {
	// Generate a banking command report for a single user
	generateReport: async (userId, params = {}) => {
		try {
			const data = {
				userId,
				timeframe: params.timeframe || '30d',
				includeDetailed: params.includeDetailed !== false,
				format: params.format || 'json',
				statementData: params.statementData || null
			};

			const response = await apiClient.post('/banking-command/report', data);
			return response.data;
		} catch (error) {
			console.error(`Error generating report for user ${userId}:`, error);
			throw error;
		}
	},

	// Generate a PDF report for a single user
	generatePdfReport: async (userId, params = {}) => {
		try {
			const data = {
				userId,
				timeframe: params.timeframe || '30d',
				includeDetailed: params.includeDetailed !== false
			};

			const response = await apiClient.post('/banking-command/pdf-report', data);
			return response.data;
		} catch (error) {
			console.error(`Error generating PDF report for user ${userId}:`, error);
			throw error;
		}
	},

	// Analyze a bank statement
	analyzeStatement: async (userId, statementData, params = {}) => {
		try {
			const data = {
				userId,
				statementData,
				includeDetailed: params.includeDetailed !== false
			};

			const response = await apiClient.post('/banking-command/statement-analysis', data);
			return response.data;
		} catch (error) {
			console.error(`Error analyzing statement for user ${userId}:`, error);
			throw error;
		}
	},

	// Generate a bulk report for multiple users
	generateBulkReports: async (userIds, params = {}) => {
		try {
			// Create a promise for each user report
			const reportPromises = userIds.map(userId =>
				this.generateReport(userId, params)
					.then(result => ({ userId, status: 'success', data: result.data }))
					.catch(error => ({ userId, status: 'error', error: error.message }))
			);

			// Wait for all reports to be generated
			const results = await Promise.all(reportPromises);

			return {
				success: true,
				data: {
					total: userIds.length,
					successful: results.filter(r => r.status === 'success').length,
					failed: results.filter(r => r.status === 'error').length,
					results
				}
			};
		} catch (error) {
			console.error('Error generating bulk reports:', error);
			throw error;
		}
	},

	// Initiate an asynchronous banking report
	initiateAsyncReport: async (userId, params = {}) => {
		try {
			const data = {
				userId,
				timeframe: params.timeframe || '30d',
				includeDetailed: params.includeDetailed !== false,
				format: params.format || 'json',
				statementData: params.statementData || null
			};

			const response = await apiClient.post('/banking-command/async-report', data);
			return response.data;
		} catch (error) {
			console.error(`Error initiating async report for user ${userId}:`, error);
			throw error;
		}
	},

	// Check the status of an asynchronous report
	checkReportStatus: async (jobId) => {
		try {
			const response = await apiClient.get(`/banking-command/report-status/${jobId}`);
			return response.data;
		} catch (error) {
			console.error(`Error checking status for report job ${jobId}:`, error);
			throw error;
		}
	},

	// Get the result of a completed asynchronous report
	getReportResult: async (jobId) => {
		try {
			const response = await apiClient.get(`/banking-command/report-result/${jobId}`);
			return response.data;
		} catch (error) {
			console.error(`Error retrieving result for report job ${jobId}:`, error);
			throw error;
		}
	}
};

export default apiClient;