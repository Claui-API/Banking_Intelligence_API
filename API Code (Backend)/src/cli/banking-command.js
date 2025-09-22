#!/usr/bin/env node
// src/cli/banking-command.js

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const dotenv = require('dotenv');
const chalk = require('chalk');
const ora = require('ora');
const { table } = require('table');
const BankingCommandService = require('../services/banking-command.service');

// Load environment variables
dotenv.config();

// Initialize service
const bankingCommandService = new BankingCommandService();

/**
 * Banking Intelligence Command CLI tool
 * Generates comprehensive banking intelligence reports from transaction data
 */
async function main() {
	// Configure CLI options
	const argv = yargs
		.usage('Usage: $0 <command> [options]')
		.command('generate', 'Generate a Banking Intelligence Command report', {
			userId: {
				description: 'User ID',
				alias: 'u',
				type: 'string',
				demandOption: true
			},
			timeframe: {
				description: 'Time period for analysis (e.g., 30d, 90d, all)',
				alias: 't',
				type: 'string',
				default: '30d'
			},
			detailed: {
				description: 'Include detailed breakdown sections',
				alias: 'd',
				type: 'boolean',
				default: true
			},
			format: {
				description: 'Output format (json, html, pdf)',
				alias: 'f',
				type: 'string',
				choices: ['json', 'html', 'pdf'],
				default: 'json'
			},
			output: {
				description: 'Output file path',
				alias: 'o',
				type: 'string'
			}
		})
		.command('analyze-statement', 'Analyze a bank statement file', {
			file: {
				description: 'Path to statement file (PDF or CSV)',
				alias: 'f',
				type: 'string',
				demandOption: true
			},
			userId: {
				description: 'User ID',
				alias: 'u',
				type: 'string',
				demandOption: true
			},
			detailed: {
				description: 'Include detailed breakdown sections',
				alias: 'd',
				type: 'boolean',
				default: true
			},
			output: {
				description: 'Output file path',
				alias: 'o',
				type: 'string'
			}
		})
		.example('$0 generate -u user123 -t 90d -f html -o report.html', 'Generate an HTML report for the last 90 days')
		.example('$0 analyze-statement -f statement.pdf -u user123 -o analysis.json', 'Analyze a bank statement and output to JSON')
		.help()
		.alias('help', 'h')
		.version()
		.alias('version', 'v')
		.argv;

	// Extract the command
	const command = argv._[0];

	// Handle commands
	switch (command) {
		case 'generate':
			await generateReport(argv);
			break;
		case 'analyze-statement':
			await analyzeStatement(argv);
			break;
		default:
			yargs.showHelp();
			break;
	}
}

/**
 * Generate a Banking Intelligence Command report
 * @param {Object} args - Command arguments
 */
async function generateReport(args) {
	const { userId, timeframe, detailed, format, output } = args;
	const requestId = `cli-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

	// Start spinner
	const spinner = ora('Generating Banking Intelligence Command report...').start();

	try {
		// Generate report
		const report = await bankingCommandService.generateReport({
			userId,
			timeframe,
			requestId,
			includeDetailed: detailed,
			format
		});

		// Stop spinner
		spinner.succeed('Report generated successfully');

		// Process output based on format
		if (output) {
			// Determine what to write based on format
			let outputContent;
			let outputFormat = 'json'; // Default

			if (format === 'html' && report.htmlContent) {
				outputContent = report.htmlContent;
				outputFormat = 'html';
			} else if (format === 'pdf' && report.pdfBuffer) {
				outputContent = report.pdfBuffer;
				outputFormat = 'pdf';
			} else {
				// Default to JSON
				outputContent = JSON.stringify(report, null, 2);
			}

			// Write to file
			fs.writeFileSync(output, outputContent, outputFormat === 'pdf' ? 'binary' : 'utf8');
			console.log(chalk.green(`Report saved to ${output}`));
		} else {
			// Display summary to console
			displayReportSummary(report);
		}
	} catch (error) {
		// Handle error
		spinner.fail('Failed to generate report');
		console.error(chalk.red(`Error: ${error.message}`));
	}
}

/**
 * Analyze a bank statement file
 * @param {Object} args - Command arguments
 */
async function analyzeStatement(args) {
	const { file, userId, detailed, output } = args;
	const requestId = `cli-stmt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

	// Start spinner
	const spinner = ora('Analyzing bank statement...').start();

	try {
		// Validate file existence
		if (!fs.existsSync(file)) {
			spinner.fail('Statement file not found');
			console.error(chalk.red(`Error: File not found at ${file}`));
			return;
		}

		// Read the file
		const statementData = fs.readFileSync(file, 'utf8');

		// In a real implementation, we would parse the statement file based on its format
		// For now, we'll assume it's already in a compatible format

		// Generate report based on statement data
		const report = await bankingCommandService.generateReport({
			userId,
			statementData, // This would be passed to a special method that handles statement data
			requestId,
			includeDetailed: detailed,
			format: 'json'
		});

		// Stop spinner
		spinner.succeed('Statement analysis complete');

		// Process output
		if (output) {
			fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');
			console.log(chalk.green(`Analysis saved to ${output}`));
		} else {
			// Display summary to console
			displayReportSummary(report);
		}
	} catch (error) {
		// Handle error
		spinner.fail('Failed to analyze statement');
		console.error(chalk.red(`Error: ${error.message}`));
	}
}

/**
 * Display a summary of the report to the console
 * @param {Object} report - Generated report
 */
function displayReportSummary(report) {
	console.log(chalk.green.bold(`\n${report.title}`));
	console.log(chalk.cyan(`Period: ${report.period}`));
	console.log(chalk.cyan(`Generated: ${new Date(report.generated).toLocaleString()}`));

	// Account summary table
	console.log(chalk.yellow.bold('\nAccount Summary:'));
	const summaryData = [
		['Metric', 'Value'],
		['Beginning Balance', `$${report.summary.accountSummary.beginningBalance.toFixed(2)}`],
		['Ending Balance', `$${report.summary.accountSummary.endingBalance.toFixed(2)}`],
		['Net Change', `$${report.summary.accountSummary.netChange.toFixed(2)}`],
		['Total Outflows', `$${report.summary.accountSummary.totalOutflows.toFixed(2)}`],
		['Average Daily Spend', `$${report.summary.accountSummary.averageDailySpend.toFixed(2)}/day`]
	];
	console.log(table(summaryData));

	// Top categories table
	console.log(chalk.yellow.bold('\nTop Spending Categories:'));
	const categoriesData = [
		['Category', 'Count', 'Total', 'Percent', 'Elasticity']
	];
	report.summary.topCategories.forEach(category => {
		categoriesData.push([
			category.category,
			category.count.toString(),
			`$${category.total.toFixed(2)}`,
			`${category.percentOfTotal.toFixed(2)}%`,
			category.elasticity
		]);
	});
	console.log(table(categoriesData));

	// Top merchants table
	console.log(chalk.yellow.bold('\nTop Merchants:'));
	const merchantsData = [
		['Merchant', 'Count', 'Total']
	];
	report.summary.topMerchants.forEach(merchant => {
		merchantsData.push([
			merchant.merchant,
			merchant.count.toString(),
			`$${merchant.total.toFixed(2)}`
		]);
	});
	console.log(table(merchantsData));

	// Risk assessment
	console.log(chalk.yellow.bold('\nRisk Assessment:'));
	if (report.summary.hasCriticalRisks) {
		console.log(chalk.red(`Critical risks detected: ${report.summary.riskCount} total risks`));
	} else if (report.summary.riskCount > 0) {
		console.log(chalk.yellow(`Moderate risks detected: ${report.summary.riskCount} total risks`));
	} else {
		console.log(chalk.green('No significant risks detected'));
	}

	// Section list
	console.log(chalk.yellow.bold('\nReport Sections:'));
	report.sections.forEach(section => {
		console.log(`${section.order}. ${chalk.cyan(section.title)}`);
	});

	console.log(chalk.green('\nTo view the full report, use the --output option to save to a file.'));
}

// Execute main function
main().catch(error => {
	console.error(chalk.red(`Fatal error: ${error.message}`));
	process.exit(1);
});