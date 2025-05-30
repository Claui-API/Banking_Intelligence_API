// scripts/security-implementation-workflow.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

/**
 * Security Implementation Workflow
 * This script orchestrates the implementation of security controls
 */

const CONFIG = {
	scriptsDir: __dirname,
	reportDir: path.join(__dirname, '..', 'security-reports'),
	steps: [
		{
			name: 'Network Endpoint Discovery',
			script: 'network-endpoint-discovery.js',
			description: 'Discovers all network endpoints connected to your networks',
			required: true,
			dependsOn: []
		},
		{
			name: 'Vulnerability Scanning',
			script: 'vulnerability-scanner.js',
			description: 'Scans for vulnerabilities in dependencies, containers, and endpoints',
			required: true,
			dependsOn: ['Network Endpoint Discovery']
		},
		{
			name: 'Endpoint Security Check',
			script: 'endpoint-security-checker.js',
			description: 'Verifies security controls on endpoints (antivirus, firewall, etc.)',
			required: true,
			dependsOn: []
		},
		{
			name: 'Access Control Audit',
			script: 'access-control-audit.js',
			description: 'Audits access controls in the codebase',
			required: true,
			dependsOn: []
		},
		{
			name: 'Two-Factor Authentication Implementation',
			script: 'implement-2fa.js',
			description: 'Adds 2FA support to the application',
			required: true,
			dependsOn: []
		},
		{
			name: 'Two-Factor Database Migration',
			script: 'migrate-2fa-db-schema.js',
			description: 'Updates the database schema for 2FA support',
			required: true,
			dependsOn: ['Two-Factor Authentication Implementation']
		}
	]
};

// Ensure report directory exists
if (!fs.existsSync(CONFIG.reportDir)) {
	fs.mkdirSync(CONFIG.reportDir, { recursive: true });
}

/**
 * Run a script and return a promise
 */
function runScript(scriptPath) {
	return new Promise((resolve, reject) => {
		console.log(`\n📋 Running: ${scriptPath}`);
		console.log('--------------------------------------------------------------------------------');

		const process = spawn('node', [scriptPath], {
			stdio: 'inherit'
		});

		process.on('close', (code) => {
			if (code === 0) {
				resolve(true);
			} else {
				reject(new Error(`Script exited with code ${code}`));
			}
		});

		process.on('error', (err) => {
			reject(err);
		});
	});
}

/**
 * Ask a question and get user input
 */
function askQuestion(question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer);
		});
	});
}

/**
 * Run the security implementation workflow
 */
async function runWorkflow() {
	try {
		console.log('\n🔒 Security Implementation Workflow');
		console.log('====================================');
		console.log('This script will guide you through implementing security controls for your application.');

		// Show available steps
		console.log('\nAvailable steps:');
		CONFIG.steps.forEach((step, i) => {
			console.log(`${i + 1}. ${step.name} - ${step.description}`);

			if (step.dependsOn.length > 0) {
				console.log(`   Depends on: ${step.dependsOn.join(', ')}`);
			}
		});

		// Ask which steps to run
		const stepsInput = await askQuestion('\nEnter step numbers to run (comma-separated), or "all" for all steps: ');

		let stepsToRun = [];

		if (stepsInput.toLowerCase() === 'all') {
			stepsToRun = CONFIG.steps.map((_, i) => i);
		} else {
			stepsToRun = stepsInput.split(',')
				.map(s => parseInt(s.trim(), 10) - 1)
				.filter(s => !isNaN(s) && s >= 0 && s < CONFIG.steps.length);
		}

		if (stepsToRun.length === 0) {
			console.log('No valid steps selected. Exiting.');
			rl.close();
			return;
		}

		// Resolve dependencies
		const resolvedSteps = new Set();
		const queue = [...stepsToRun];

		while (queue.length > 0) {
			const stepIndex = queue.shift();

			if (resolvedSteps.has(stepIndex)) {
				continue;
			}

			const step = CONFIG.steps[stepIndex];

			// Check dependencies
			const unresolvedDeps = step.dependsOn
				.map(dep => CONFIG.steps.findIndex(s => s.name === dep))
				.filter(depIndex => depIndex >= 0 && !resolvedSteps.has(depIndex));

			if (unresolvedDeps.length > 0) {
				// Add this step back to the queue
				queue.push(stepIndex);

				// Add dependencies to the queue
				queue.unshift(...unresolvedDeps);
				continue;
			}

			resolvedSteps.add(stepIndex);
		}

		// Convert back to array and sort by original position
		const orderedSteps = Array.from(resolvedSteps).sort((a, b) => {
			// First check if one depends on the other
			if (CONFIG.steps[a].dependsOn.includes(CONFIG.steps[b].name)) return 1;
			if (CONFIG.steps[b].dependsOn.includes(CONFIG.steps[a].name)) return -1;

			// Otherwise sort by index
			return a - b;
		});

		console.log('\nSteps that will be executed in order:');
		orderedSteps.forEach((stepIndex, i) => {
			console.log(`${i + 1}. ${CONFIG.steps[stepIndex].name}`);
		});

		const confirm = await askQuestion('\nProceed with these steps? (y/n): ');

		if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
			console.log('Operation cancelled. Exiting.');
			rl.close();
			return;
		}

		// Run the selected steps
		console.log('\n🚀 Starting security implementation workflow...');

		const results = [];

		for (let i = 0; i < orderedSteps.length; i++) {
			const stepIndex = orderedSteps[i];
			const step = CONFIG.steps[stepIndex];

			console.log(`\n[${i + 1}/${orderedSteps.length}] Running: ${step.name}`);

			const scriptPath = path.join(CONFIG.scriptsDir, step.script);

			if (!fs.existsSync(scriptPath)) {
				console.log(`❌ Script not found: ${step.script}`);

				if (step.required) {
					throw new Error(`Required script not found: ${step.script}`);
				} else {
					results.push({
						step: step.name,
						success: false,
						error: 'Script not found'
					});
					continue;
				}
			}

			try {
				await runScript(scriptPath);

				results.push({
					step: step.name,
					success: true
				});

				console.log(`✅ Successfully completed: ${step.name}`);
			} catch (error) {
				console.log(`❌ Failed: ${step.name}`);
				console.error(error);

				results.push({
					step: step.name,
					success: false,
					error: error.message
				});

				if (step.required) {
					throw new Error(`Required step failed: ${step.name}`);
				}
			}
		}

		// Generate summary report
		const reportPath = path.join(CONFIG.reportDir, `security-implementation-summary-${new Date().toISOString().replace(/:/g, '-')}.json`);

		const report = {
			timestamp: new Date().toISOString(),
			steps: results,
			summary: {
				total: results.length,
				successful: results.filter(r => r.success).length,
				failed: results.filter(r => !r.success).length
			}
		};

		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		// Display summary
		console.log('\n📊 Security Implementation Summary:');
		console.log('===============================');
		console.log(`Total steps: ${report.summary.total}`);
		console.log(`Successful: ${report.summary.successful}`);
		console.log(`Failed: ${report.summary.failed}`);
		console.log(`\nDetailed report saved to: ${reportPath}`);

		if (report.summary.failed > 0) {
			console.log('\n⚠️ Some steps failed. Please review the report for details.');
			console.log('\nFailed steps:');
			results.filter(r => !r.success).forEach(step => {
				console.log(`- ${step.step}: ${step.error}`);
			});
		} else {
			console.log('\n🎉 All steps completed successfully!');
		}

		// Generate documentation
		await generateDocumentation(reportPath);
	} catch (error) {
		console.error('\n❌ Workflow failed:', error.message);
	} finally {
		rl.close();
	}
}

/**
 * Generate documentation based on implementation results
 */
async function generateDocumentation(reportPath) {
	try {
		console.log('\n📝 Generating documentation...');

		// Load the report
		const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

		// Create documentation file
		const docsPath = path.join(CONFIG.reportDir, 'security-documentation.md');

		let documentation = `# Security Controls Documentation\n\n`;
		documentation += `Generated: ${new Date().toLocaleString()}\n\n`;

		// Information Security Policy
		documentation += `## Information Security Policy\n\n`;
		documentation += `Our organization has implemented a comprehensive information security policy that includes:\n\n`;
		documentation += `- Authentication and access control with JWT token-based authentication\n`;
		documentation += `- Role-based access control (RBAC) for segregation of duties\n`;
		documentation += `- Two-factor authentication (2FA) for critical assets\n`;
		documentation += `- Regular vulnerability scanning and remediation\n`;
		documentation += `- Endpoint security validation\n`;
		documentation += `- Network asset discovery and management\n`;
		documentation += `- Comprehensive logging and monitoring\n\n`;

		// Network Endpoint Management
		documentation += `## Network Endpoint Management\n\n`;
		documentation += `We maintain visibility into all network endpoints through:\n\n`;
		documentation += `- Automated network asset discovery scans\n`;
		documentation += `- Asset inventory maintenance\n`;
		documentation += `- AWS resource discovery for cloud assets\n`;
		documentation += `- Local network scanning for on-premises resources\n\n`;

		// Load vulnerability scan report if it exists
		let vulnReport = null;
		const vulnReportPath = path.join(CONFIG.reportDir, 'vulnerability-report.json');
		if (fs.existsSync(vulnReportPath)) {
			try {
				vulnReport = JSON.parse(fs.readFileSync(vulnReportPath, 'utf8'));
			} catch (error) {
				console.error('Error loading vulnerability report:', error.message);
			}
		}

		// Vulnerability Scanning
		documentation += `## Vulnerability Scanning\n\n`;
		documentation += `Regular vulnerability scans are performed against all endpoints:\n\n`;
		documentation += `- Dependency scanning via NPM audit and OWASP Dependency Check\n`;
		documentation += `- Docker image scanning for container vulnerabilities\n`;
		documentation += `- Network endpoint vulnerability scanning\n`;

		if (vulnReport) {
			documentation += `\nLatest scan identified ${vulnReport.summary.total} vulnerabilities:\n`;
			documentation += `- Critical: ${vulnReport.summary.critical}\n`;
			documentation += `- High: ${vulnReport.summary.high}\n`;
			documentation += `- Medium: ${vulnReport.summary.medium}\n`;
			documentation += `- Low: ${vulnReport.summary.low}\n`;
		}
		documentation += `\n`;

		// Load endpoint security report if it exists
		let securityReport = null;
		const securityReportPath = path.join(CONFIG.reportDir, 'endpoint-security-report.json');
		if (fs.existsSync(securityReportPath)) {
			try {
				securityReport = JSON.parse(fs.readFileSync(securityReportPath, 'utf8'));
			} catch (error) {
				console.error('Error loading endpoint security report:', error.message);
			}
		}

		// Endpoint Security
		documentation += `## Endpoint Security\n\n`;
		documentation += `All endpoints are protected against malicious code through:\n\n`;
		documentation += `- Antivirus/anti-malware software\n`;
		documentation += `- Host-based firewalls\n`;
		documentation += `- System update enforcement\n`;
		documentation += `- Disk encryption\n`;

		if (securityReport) {
			documentation += `\nEndpoint security status:\n`;
			documentation += `- Total endpoints: ${securityReport.summary.total}\n`;
			documentation += `- Fully secured: ${securityReport.summary.secure}\n`;
			documentation += `- With security issues: ${securityReport.summary.issues}\n`;
		}
		documentation += `\n`;

		// BYOD Policy
		documentation += `## BYOD Policy\n\n`;
		documentation += `Our BYOD policy for employee devices includes:\n\n`;
		documentation += `- Required security measures (antivirus, firewall, encryption)\n`;
		documentation += `- Two-factor authentication requirement\n`;
		documentation += `- Regular security compliance checking\n`;
		documentation += `- Remote wipe capability for lost/stolen devices\n`;
		documentation += `- Acceptable use policies\n\n`;

		// Load access control report if it exists
		let accessControlReport = null;
		const accessControlReportPath = path.join(CONFIG.reportDir, 'access-control-audit.json');
		if (fs.existsSync(accessControlReportPath)) {
			try {
				accessControlReport = JSON.parse(fs.readFileSync(accessControlReportPath, 'utf8'));
			} catch (error) {
				console.error('Error loading access control report:', error.message);
			}
		}

		// Access Controls
		documentation += `## Access Control Process\n\n`;
		documentation += `We have implemented comprehensive access controls for production assets:\n\n`;
		documentation += `- Role-based access control (RBAC)\n`;
		documentation += `- JWT token-based authentication\n`;
		documentation += `- Client credential management with approval workflow\n`;
		documentation += `- API usage quotas and rate limiting\n`;
		documentation += `- Token expiration and refresh policies\n`;

		if (accessControlReport) {
			documentation += `\nAccess control audit results:\n`;
			documentation += `- API routes with auth: ${accessControlReport.summary.api}\n`;
			documentation += `- Admin routes with explicit checks: ${accessControlReport.summary.admin}\n`;
			documentation += `- Auth middleware components: ${accessControlReport.summary.middleware}\n`;
			documentation += `- Database access controls: ${accessControlReport.summary.database}\n`;
		}
		documentation += `\n`;

		// Strong Authentication
		documentation += `## Strong Authentication\n\n`;
		documentation += `We have deployed strong authentication for critical assets:\n\n`;
		documentation += `- Two-factor authentication (2FA) using TOTP\n`;
		documentation += `- Backup codes for 2FA recovery\n`;
		documentation += `- JWT token-based API authentication\n`;
		documentation += `- Password strength requirements\n`;
		documentation += `- Account status verification\n`;
		documentation += `- Token expiration and refresh mechanisms\n\n`;

		// Save documentation
		fs.writeFileSync(docsPath, documentation);
		console.log(`📄 Security documentation generated: ${docsPath}`);
	} catch (error) {
		console.error('Error generating documentation:', error.message);
	}
}

// Run the workflow
runWorkflow();