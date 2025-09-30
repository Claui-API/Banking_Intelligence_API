// src/controllers/banking-command.controller.js
const logger = require('../utils/logger');
const { formatResponse, formatError } = require('../utils/response-formatter');
const reportCache = require('../utils/report-cache');

// Initialize banking command service
const bankingCommandService = require('../services/banking-command.service');

/**
 * Generate professional HTML report from report data
 * @param {Object} report - Report data object
 * @returns {string} - Complete HTML document
 */
function generateHTMLReport(report) {
	// Helper function to format currency
	const formatCurrency = (amount) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	};

	// Generate sections HTML
	const sectionsHTML = report.sections?.map(section => {
		let sectionContent = section.content || '';
		let additionalHTML = '';

		// Special handling for different section types
		if (section.id === 'accountSummary' && section.metrics) {
			additionalHTML = `
                <div class="metrics-grid">
                    <div class="metric-card balance">
                        <div class="metric-value">${formatCurrency(section.metrics.totalBalance)}</div>
                        <div class="metric-label">Total Balance</div>
                    </div>
                    <div class="metric-card income">
                        <div class="metric-value">${formatCurrency(section.metrics.income)}</div>
                        <div class="metric-label">Income</div>
                    </div>
                    <div class="metric-card expenses">
                        <div class="metric-value">${formatCurrency(section.metrics.expenses)}</div>
                        <div class="metric-label">Expenses</div>
                    </div>
                    <div class="metric-card net">
                        <div class="metric-value">${formatCurrency(section.metrics.netChange)}</div>
                        <div class="metric-label">Net Change</div>
                    </div>
                    <div class="metric-card daily">
                        <div class="metric-value">${formatCurrency(section.metrics.averageDailySpend)}</div>
                        <div class="metric-label">Daily Average</div>
                    </div>
                    <div class="metric-card period">
                        <div class="metric-value">${section.metrics.daysInPeriod}</div>
                        <div class="metric-label">Days in Period</div>
                    </div>
                </div>
            `;
		}

		if (section.id === 'behaviorPreferences' && section.categories && section.categories.length > 0) {
			additionalHTML += `
                <div class="data-table-container">
                    <h4>Top Spending Categories</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Transactions</th>
                                <th>Total Amount</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${section.categories.map(cat => `
                                <tr>
                                    <td><span class="category-name">${cat.name}</span></td>
                                    <td>${cat.count}</td>
                                    <td class="amount">${formatCurrency(cat.total)}</td>
                                    <td><span class="percentage">${cat.percent.toFixed(1)}%</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
		}

		if (section.id === 'merchantAnalysis' && section.merchants && section.merchants.length > 0) {
			additionalHTML += `
                <div class="data-table-container">
                    <h4>Top Merchants by Spending</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Transactions</th>
                                <th>Total Spent</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${section.merchants.map(merchant => `
                                <tr>
                                    <td><span class="merchant-name">${merchant.name}</span></td>
                                    <td>${merchant.count}</td>
                                    <td class="amount">${formatCurrency(merchant.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
		}

		return `
            <div class="report-section" data-section="${section.id}">
                <h2 class="section-title">
                    ${section.title}
                    <button class="section-toggle" onclick="toggleSection('${section.id}')" aria-label="Toggle section">
                        <span class="toggle-icon">−</span>
                    </button>
                </h2>
                <div class="section-content" id="content-${section.id}">
                    <div class="section-text">
                        ${sectionContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
                    </div>
                    ${additionalHTML}
                </div>
            </div>
        `;
	}).join('') || '<p>No sections available in this report.</p>';

	// Generate summary overview
	const summaryHTML = report.summary ? `
        <div class="summary-overview">
            <div class="summary-card">
                <h3>Report Summary</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <span class="stat-label">Total Balance:</span>
                        <span class="stat-value">${formatCurrency(report.summary.totalBalance || 0)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Transactions:</span>
                        <span class="stat-value">${report.summary.transactionCount || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Risk Factors:</span>
                        <span class="stat-value ${report.summary.hasCriticalRisks ? 'risk-high' : 'risk-low'}">
                            ${report.summary.riskCount || 0} ${report.summary.hasCriticalRisks ? '(Critical)' : ''}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title || 'Banking Intelligence Report'}</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .report-header {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            text-align: center;
            position: relative;
        }

        .report-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px 15px 0 0;
        }

        .report-title {
            font-size: 32px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 15px;
        }

        .report-meta {
            display: flex;
            justify-content: center;
            gap: 30px;
            color: #7f8c8d;
            font-size: 14px;
            flex-wrap: wrap;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .actions-bar {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .action-btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            font-size: 14px;
        }

        .btn-print {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-json {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }

        .btn-expand {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
        }

        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .summary-overview {
            margin-bottom: 30px;
        }

        .summary-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }

        .summary-card h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 20px;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .stat-label {
            font-weight: 600;
            color: #5a6c7d;
        }

        .stat-value {
            font-weight: 700;
            color: #2c3e50;
        }

        .risk-high {
            color: #e74c3c !important;
        }

        .risk-low {
            color: #27ae60 !important;
        }

        .report-section {
            background: white;
            margin-bottom: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .report-section:hover {
            box-shadow: 0 12px 35px rgba(0,0,0,0.12);
        }

        .section-title {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-toggle {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            border-radius: 4px;
            transition: background-color 0.3s ease;
        }

        .section-toggle:hover {
            background-color: rgba(255,255,255,0.2);
        }

        .toggle-icon {
            font-size: 18px;
            font-weight: bold;
        }

        .section-content {
            padding: 30px;
        }

        .section-text {
            font-size: 15px;
            line-height: 1.7;
            margin-bottom: 25px;
        }

        .section-text p {
            margin-bottom: 15px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }

        .metric-card {
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }

        .metric-card.balance {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .metric-card.income {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .metric-card.expenses {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .metric-card.net {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }

        .metric-card.daily {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        }

        .metric-card.period {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            color: #2c3e50;
        }

        .metric-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .metric-label {
            font-size: 12px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 500;
        }

        .data-table-container {
            margin: 25px 0;
        }

        .data-table-container h4 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 16px;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .data-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .data-table td {
            padding: 15px;
            border-bottom: 1px solid #eee;
            transition: background-color 0.3s ease;
        }

        .data-table tr:hover td {
            background-color: #f8f9fa;
        }

        .category-name, .merchant-name {
            font-weight: 600;
            color: #2c3e50;
        }

        .amount {
            font-weight: 700;
            color: #27ae60;
        }

        .percentage {
            padding: 4px 8px;
            background: #e8f5e8;
            color: #27ae60;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        /* Print styles */
        @media print {
            body {
                background: white !important;
                font-size: 12px;
            }
            
            .actions-bar {
                display: none !important;
            }
            
            .report-section {
                page-break-inside: avoid;
                box-shadow: none !important;
                border: 1px solid #ddd;
            }
            
            .section-toggle {
                display: none !important;
            }
            
            .metric-card {
                background: #f5f5f5 !important;
                color: #333 !important;
                border: 1px solid #ddd;
            }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            .report-header {
                padding: 25px 20px;
            }
            
            .report-title {
                font-size: 24px;
            }
            
            .report-meta {
                flex-direction: column;
                gap: 10px;
            }
            
            .metrics-grid {
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            
            .summary-stats {
                grid-template-columns: 1fr;
            }
            
            .section-content {
                padding: 20px;
            }
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="report-header">
            <h1 class="report-title">${report.title || 'Banking Intelligence Report'}</h1>
            <div class="report-meta">
                <div class="meta-item">
                    <strong>Period:</strong> ${report.period || 'N/A'}
                </div>
                <div class="meta-item">
                    <strong>Generated:</strong> ${new Date(report.generated).toLocaleString()}
                </div>
                <div class="meta-item">
                    <strong>Sections:</strong> ${report.sections?.length || 0}
                </div>
            </div>
        </div>

        <div class="actions-bar">
            <button class="action-btn btn-print" onclick="window.print()">
                🖨️ Print / Save as PDF
            </button>
            <button class="action-btn btn-expand" onclick="toggleAllSections()">
                📋 Expand All Sections
            </button>
            <a href="?format=json" class="action-btn btn-json">
                📄 View JSON Data
            </a>
        </div>

        ${summaryHTML}

        <div class="report-content">
            ${sectionsHTML}
        </div>
    </div>

    <script>
        let allExpanded = true;

        function toggleSection(sectionId) {
            const content = document.getElementById('content-' + sectionId);
            const toggle = content.parentElement.querySelector('.toggle-icon');
            
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                toggle.textContent = '−';
            } else {
                content.classList.add('hidden');
                toggle.textContent = '+';
            }
        }

        function toggleAllSections() {
            const contents = document.querySelectorAll('.section-content');
            const toggles = document.querySelectorAll('.toggle-icon');
            const button = document.querySelector('.btn-expand');
            
            if (allExpanded) {
                contents.forEach(content => content.classList.add('hidden'));
                toggles.forEach(toggle => toggle.textContent = '+');
                button.innerHTML = '📋 Expand All Sections';
                allExpanded = false;
            } else {
                contents.forEach(content => content.classList.remove('hidden'));
                toggles.forEach(toggle => toggle.textContent = '−');
                button.innerHTML = '📋 Collapse All Sections';
                allExpanded = true;
            }
        }

        // Add keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'p':
                        e.preventDefault();
                        window.print();
                        break;
                    case 'e':
                        e.preventDefault();
                        toggleAllSections();
                        break;
                }
            }
        });

        // Add smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        console.log('Banking Intelligence Report loaded successfully');
    </script>
</body>
</html>`;
}

/**
 * Enhanced Banking Command Controller with HTML reports
 */
const bankingCommandController = {
	/**
	 * Generate a comprehensive banking intelligence report with HTML support
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	generateReport: async (req, res) => {
		const { userId, timeframe, includeDetailed, format, statementData } = req.body;
		const requestId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
		const startTime = Date.now();

		try {
			logger.info('Banking Intelligence Command report requested', {
				userId, timeframe, requestId, includeDetailed, format, hasStatementData: !!statementData
			});

			// Validate required parameters
			if (!userId) {
				return res.status(400).json(formatError('Missing required parameter: userId'));
			}

			// Create cache parameters
			const cacheParams = {
				userId,
				timeframe,
				includeDetailed: includeDetailed !== false,
				statementData
			};

			// Try to get from cache first
			let report = reportCache.get(cacheParams);
			let fromCache = false;

			if (report) {
				fromCache = true;
				logger.info('Report served from cache', {
					userId, requestId,
					cacheAge: Date.now() - new Date(report.generated).getTime()
				});
			} else {
				// Generate new report
				logger.info('Generating new report (cache miss)', { userId, requestId });

				report = await bankingCommandService.generateReport({
					userId,
					timeframe,
					requestId,
					includeDetailed: includeDetailed !== false,
					format: 'json', // Always generate JSON for caching
					statementData
				});

				// Cache the report for future use
				reportCache.set(cacheParams, report);

				logger.info('New report generated and cached', {
					userId, requestId, generationTime: Date.now() - startTime
				});
			}

			// Handle different response formats
			if (format === 'html') {
				// Generate and return HTML report
				const htmlContent = generateHTMLReport(report);

				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'");
				res.setHeader('X-Report-Source', fromCache ? 'cache' : 'generated');
				res.setHeader('X-Report-ID', requestId);

				logger.info('HTML report generated successfully', {
					requestId, fromCache, totalTime: Date.now() - startTime,
					htmlLength: htmlContent.length
				});

				return res.send(htmlContent);

			} else if (format === 'pdf') {
				// Generate HTML and let browser handle PDF conversion
				const htmlContent = generateHTMLReport(report);

				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				res.setHeader('X-Report-Source', fromCache ? 'cache' : 'generated');
				res.setHeader('X-PDF-Instructions', 'Use Ctrl+P or Cmd+P to print/save as PDF');

				logger.info('PDF-ready HTML report generated', {
					requestId, fromCache, totalTime: Date.now() - startTime
				});

				return res.send(htmlContent);

			} else {
				// Return JSON response (default)
				logger.info('JSON report returned successfully', {
					requestId, fromCache, totalTime: Date.now() - startTime
				});

				// Add format links to JSON response
				const response = formatResponse({
					...report,
					_metadata: {
						fromCache,
						generationTime: Date.now() - startTime,
						availableFormats: ['json', 'html', 'pdf'],
						formatUrls: {
							html: req.originalUrl.replace(/[?&]format=[^&]*/, '') +
								(req.originalUrl.includes('?') ? '&' : '?') + 'format=html',
							pdf: req.originalUrl.replace(/[?&]format=[^&]*/, '') +
								(req.originalUrl.includes('?') ? '&' : '?') + 'format=pdf'
						},
						cacheStats: reportCache.getStats()
					}
				});

				return res.status(200).json(response);
			}

		} catch (error) {
			logger.error('Error generating Banking Intelligence Command report', {
				requestId, error: error.message, stack: error.stack, userId, format
			});

			// Return appropriate error format
			if (format === 'html' || format === 'pdf') {
				const errorHTML = `
                    <!DOCTYPE html>
                    <html><head><title>Report Error</title></head>
                    <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                        <h1 style="color: #e74c3c;">Report Generation Error</h1>
                        <p>Failed to generate the banking intelligence report.</p>
                        <p style="color: #666;">${error.message}</p>
                        <button onclick="history.back()" style="padding: 10px 20px; margin: 20px;">Go Back</button>
                    </body></html>
                `;
				return res.status(500).send(errorHTML);
			} else {
				return res.status(500).json(formatError('Failed to generate report', error.message));
			}
		}
	},

	/**
	 * Get cache statistics (for monitoring/debugging)
	 */
	getCacheStats: async (req, res) => {
		try {
			const stats = reportCache.getStats();
			return res.status(200).json(formatResponse(stats, 'Cache statistics retrieved successfully'));
		} catch (error) {
			logger.error('Error retrieving cache stats:', error);
			return res.status(500).json(formatError('Failed to retrieve cache statistics'));
		}
	},

	/**
	 * Clear cache (admin function)
	 */
	clearCache: async (req, res) => {
		try {
			const stats = reportCache.getStats();
			reportCache.clear();

			logger.info('Cache cleared manually', { previousSize: stats.size });
			return res.status(200).json(formatResponse({
				clearedEntries: stats.size
			}, 'Cache cleared successfully'));
		} catch (error) {
			logger.error('Error clearing cache:', error);
			return res.status(500).json(formatError('Failed to clear cache'));
		}
	},

	/**
	 * Analyze a bank statement and generate insights
	 */
	analyzeStatement: async (req, res) => {
		const { userId, statementData, includeDetailed, format } = req.body;
		const requestId = `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

		try {
			logger.info('Banking Intelligence Command statement analysis requested', {
				userId, requestId, includeDetailed, format, hasStatementData: !!statementData
			});

			if (!userId) {
				return res.status(400).json(formatError('Missing required parameter: userId'));
			}

			if (!statementData) {
				return res.status(400).json(formatError('Missing required parameter: statementData'));
			}

			// Generate report based on statement data (not cached)
			const report = await bankingCommandService.generateReport({
				userId,
				statementData,
				requestId,
				includeDetailed: includeDetailed !== false,
				format: 'json'
			});

			// Handle format response
			if (format === 'html') {
				const htmlContent = generateHTMLReport(report);
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				return res.send(htmlContent);
			} else {
				return res.status(200).json(formatResponse(report));
			}

		} catch (error) {
			logger.error('Error analyzing statement with Banking Intelligence Command', {
				requestId, error: error.message, stack: error.stack
			});

			return res.status(500).json(formatError('Failed to analyze statement', error.message));
		}
	}
};

module.exports = bankingCommandController;