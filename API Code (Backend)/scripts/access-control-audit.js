// scripts/access-control-audit.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../src/utils/logger');

/**
 * Access Control Audit Tool
 * This script audits and documents access controls for your application
 */

// Configuration
const CONFIG = {
	outputDir: path.join(__dirname, '..', 'security-reports'),
	accessControlReportFile: 'access-control-audit.json',
	codebaseDir: path.join(__dirname, '..'),
	reviewApiRoutes: true,
	reviewAdminRoutes: true,
	reviewAuthMiddleware: true,
	reviewDatabase: true
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
	fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Access control report file path
const accessControlReportPath = path.join(CONFIG.outputDir, CONFIG.accessControlReportFile);

// Load existing access control report if available
let accessControlReport = {
	lastAudit: null,
	accessControls: [],
	apiRoutes: [],
	adminRoutes: [],
	authMiddleware: [],
	databaseControls: [],
	summary: {
		total: 0,
		api: 0,
		admin: 0,
		middleware: 0,
		database: 0
	},
	recommendations: []
};

if (fs.existsSync(accessControlReportPath)) {
	try {
		accessControlReport = JSON.parse(fs.readFileSync(accessControlReportPath, 'utf8'));
		logger.info(`Loaded existing access control report with ${accessControlReport.accessControls.length} controls`);
	} catch (error) {
		logger.error('Error loading access control report:', error);
		// Initialize with empty report
	}
}

/**
 * Scan codebase for API routes
 */
function scanApiRoutes() {
	if (!CONFIG.reviewApiRoutes) {
		logger.info('API routes review is disabled');
		return [];
	}

	logger.info('Scanning for API routes...');
	const apiRoutes = [];

	try {
		// Find route files
		const routeFiles = findFiles(path.join(CONFIG.codebaseDir, 'src'), 'routes');

		for (const file of routeFiles) {
			// Skip test files
			if (file.includes('.test.') || file.includes('__tests__') || file.includes('test/')) {
				continue;
			}

			logger.info(`Analyzing route file: ${file}`);

			// Read file content
			const content = fs.readFileSync(file, 'utf8');

			// Extract routes (simple regex-based approach)
			const routeMatches = content.matchAll(/router\.(get|post|put|delete|patch)\s*\(\s*['"](.*?)['"].*?,.*?(authMiddleware|apiTokenMiddleware)?/g);

			for (const match of routeMatches) {
				const method = match[1].toUpperCase();
				const path = match[2];
				const requiresAuth = !!match[3];

				// Extract route description from comments
				let description = '';
				let access = 'unknown';

				const commentRegex = new RegExp(`\\/\\*\\*\\s*\\n\\s*\\*\\s*@route\\s+${method}\\s+${path.replace(/\//g, '\\/')}\\s*\\n\\s*\\*\\s*@desc\\s+([^\\n]*)\\s*\\n\\s*\\*\\s*@access\\s+([^\\n]*)`, 'i');
				const commentMatch = content.match(commentRegex);

				if (commentMatch) {
					description = commentMatch[1].trim();
					access = commentMatch[2].trim().toLowerCase();
				}

				apiRoutes.push({
					method,
					path,
					file: path.relative(CONFIG.codebaseDir, file),
					requiresAuth,
					description: description || `${method} endpoint for ${path}`,
					access: access || (requiresAuth ? 'private' : 'public'),
					securityControls: requiresAuth ? ['JWT Authentication'] : []
				});
			}
		}

		logger.info(`Found ${apiRoutes.length} API routes`);
	} catch (error) {
		logger.error('Error scanning API routes:', error);
	}

	return apiRoutes;
}

/**
 * Scan codebase for admin routes
 */
function scanAdminRoutes() {
	if (!CONFIG.reviewAdminRoutes) {
		logger.info('Admin routes review is disabled');
		return [];
	}

	logger.info('Scanning for admin routes...');
	const adminRoutes = [];

	try {
		// Find admin route files
		const adminFiles = findFiles(path.join(CONFIG.codebaseDir, 'src'), 'admin');

		for (const file of adminFiles) {
			// Skip test files
			if (file.includes('.test.') || file.includes('__tests__') || file.includes('test/')) {
				continue;
			}

			logger.info(`Analyzing admin file: ${file}`);

			// Read file content
			const content = fs.readFileSync(file, 'utf8');

			// Check for admin authorization
			const hasAdminCheck = content.includes('authorize(\'admin\')') ||
				content.includes('req.auth.role === \'admin\'') ||
				content.includes('isAdmin');

			if (!hasAdminCheck) {
				continue; // Skip files without admin checks
			}

			// Extract routes
			const routeMatches = content.matchAll(/router\.(get|post|put|delete|patch)\s*\(\s*['"](.*?)['"].*?,.*?(authorize\(['"]admin['"]\))?/g);

			for (const match of routeMatches) {
				const method = match[1].toUpperCase();
				const path = match[2];
				const hasExplicitAdminAuth = !!match[3];

				adminRoutes.push({
					method,
					path,
					file: path.relative(CONFIG.codebaseDir, file),
					hasExplicitAdminAuth,
					securityControls: ['JWT Authentication', 'Admin Role Authorization'],
					notes: hasExplicitAdminAuth ? 'Explicit admin role check' : 'Implicit admin check in route'
				});
			}
		}

		logger.info(`Found ${adminRoutes.length} admin routes`);
	} catch (error) {
		logger.error('Error scanning admin routes:', error);
	}

	return adminRoutes;
}

/**
 * Analyze authentication middleware
 */
function analyzeAuthMiddleware() {
	if (!CONFIG.reviewAuthMiddleware) {
		logger.info('Auth middleware review is disabled');
		return [];
	}

	logger.info('Analyzing authentication middleware...');
	const authMiddleware = [];

	try {
		// Find auth middleware files
		const middlewareFiles = findFiles(path.join(CONFIG.codebaseDir, 'src'), 'middleware');
		const authFiles = middlewareFiles.filter(file =>
			file.includes('auth') ||
			file.includes('authorize') ||
			file.includes('authentication')
		);

		for (const file of authFiles) {
			// Skip test files
			if (file.includes('.test.') || file.includes('__tests__')) {
				continue;
			}

			logger.info(`Analyzing auth middleware file: ${file}`);

			// Read file content
			const content = fs.readFileSync(file, 'utf8');

			// Look for middleware functions
			const middlewareFunctions = [];

			// Find exports
			const exportMatches = content.matchAll(/exports\.(\w+)\s*=|module\.exports\s*=\s*{([^}]*)}/g);

			for (const match of exportMatches) {
				if (match[1]) {
					// Single export
					middlewareFunctions.push(match[1]);
				} else if (match[2]) {
					// Multiple exports
					const exports = match[2].split(',').map(exp => {
						const nameMatch = exp.trim().match(/(\w+):/);
						return nameMatch ? nameMatch[1] : exp.trim();
					});

					middlewareFunctions.push(...exports);
				}
			}

			// Check each middleware function
			for (const funcName of middlewareFunctions) {
				// Skip if not a middleware function
				if (!content.includes(funcName)) {
					continue;
				}

				// Check what the middleware validates
				const checksToken = content.includes('req.headers.authorization') || content.includes('authHeader');
				const checksRole = content.includes('req.auth.role') || content.includes('authorize(');
				const checksStatus = content.includes('client.status') || content.includes('status !== \'active\'');
				const checksQuota = content.includes('usageCount') && content.includes('usageQuota');

				authMiddleware.push({
					name: funcName,
					file: path.relative(CONFIG.codebaseDir, file),
					checks: {
						token: checksToken,
						role: checksRole,
						status: checksStatus,
						quota: checksQuota
					},
					securityFeatures: [
						checksToken ? 'Token Validation' : null,
						checksRole ? 'Role-Based Access Control' : null,
						checksStatus ? 'Account Status Validation' : null,
						checksQuota ? 'Usage Quota Enforcement' : null
					].filter(Boolean)
				});
			}
		}

		logger.info(`Analyzed ${authMiddleware.length} auth middleware components`);
	} catch (error) {
		logger.error('Error analyzing auth middleware:', error);
	}

	return authMiddleware;
}

/**
 * Analyze database access controls
 */
function analyzeDatabaseControls() {
	if (!CONFIG.reviewDatabase) {
		logger.info('Database controls review is disabled');
		return [];
	}

	logger.info('Analyzing database access controls...');
	const databaseControls = [];

	try {
		// Find database models and connection files
		const dbFiles = [
			...findFiles(path.join(CONFIG.codebaseDir, 'src'), 'models'),
			...findFiles(path.join(CONFIG.codebaseDir, 'src'), 'database')
		];

		for (const file of dbFiles) {
			// Skip test files
			if (file.includes('.test.') || file.includes('__tests__')) {
				continue;
			}

			logger.info(`Analyzing database file: ${file}`);

			// Read file content
			const content = fs.readFileSync(file, 'utf8');

			// Check for model definitions
			const isModel = content.includes('sequelize.define(') ||
				content.includes('extends Model') ||
				content.includes('mongoose.model(') ||
				content.includes('mongoose.Schema');

			// Check for foreign keys and associations
			const hasAssociations = content.includes('hasMany(') ||
				content.includes('belongsTo(') ||
				content.includes('hasOne(') ||
				content.includes('belongsToMany(');

			// Check for access control in models
			const hasRoleField = content.includes('role') && content.includes('enum');
			const hasStatusField = content.includes('status') && content.includes('enum');
			const hasFilterByUser = content.includes('userId') || content.includes('where: { userId');

			// Check for parameterized queries
			const usesParamQueries = !content.includes('sequelize.query(') ||
				(content.includes('sequelize.query(') && content.includes('replacements:'));

			databaseControls.push({
				file: path.relative(CONFIG.codebaseDir, file),
				isModel,
				accessControls: {
					hasRoleField,
					hasStatusField,
					hasAssociations,
					hasFilterByUser,
					usesParamQueries
				},
				securityFeatures: [
					hasRoleField ? 'Role-Based Access Control' : null,
					hasStatusField ? 'Status-Based Access Control' : null,
					hasAssociations ? 'Data Association Controls' : null,
					hasFilterByUser ? 'User-Based Data Filtering' : null,
					usesParamQueries ? 'Parameterized Queries (SQL Injection Protection)' : null
				].filter(Boolean)
			});
		}

		logger.info(`Analyzed ${databaseControls.length} database files`);
	} catch (error) {
		logger.error('Error analyzing database controls:', error);
	}

	return databaseControls;
}

/**
 * Generate access control recommendations
 */
function generateRecommendations(apiRoutes, adminRoutes, authMiddleware, databaseControls) {
	const recommendations = [];

	// Check for unauthenticated routes
	const unauthenticatedRoutes = apiRoutes.filter(route => !route.requiresAuth && !route.path.includes('/health') && !route.path.includes('/auth/login') && !route.path.includes('/auth/register'));

	if (unauthenticatedRoutes.length > 0) {
		recommendations.push({
			priority: 'high',
			area: 'API Security',
			recommendation: 'Add authentication to public API routes',
			details: `Found ${unauthenticatedRoutes.length} routes without authentication requirements. Consider adding auth middleware to these endpoints.`,
			affectedItems: unauthenticatedRoutes.map(r => `${r.method} ${r.path}`)
		});
	}

	// Check for admin routes without explicit admin checks
	const unsecuredAdminRoutes = adminRoutes.filter(route => !route.hasExplicitAdminAuth);

	if (unsecuredAdminRoutes.length > 0) {
		recommendations.push({
			priority: 'high',
			area: 'Admin Security',
			recommendation: 'Add explicit admin role checks to admin routes',
			details: `Found ${unsecuredAdminRoutes.length} admin routes without explicit admin role verification. Add authorize('admin') middleware to these routes.`,
			affectedItems: unsecuredAdminRoutes.map(r => `${r.method} ${r.path}`)
		});
	}

	// Check for weak middleware
	const weakMiddleware = authMiddleware.filter(mw => !mw.checks.role || !mw.checks.status);

	if (weakMiddleware.length > 0) {
		recommendations.push({
			priority: 'medium',
			area: 'Authentication',
			recommendation: 'Enhance authentication middleware with additional checks',
			details: 'Some authentication middleware lacks comprehensive checks for roles or account status.',
			affectedItems: weakMiddleware.map(m => m.name)
		});
	}

	// Check for database models without user filtering
	const modelsWithoutUserFiltering = databaseControls.filter(db => db.isModel && !db.accessControls.hasFilterByUser);

	if (modelsWithoutUserFiltering.length > 0) {
		recommendations.push({
			priority: 'medium',
			area: 'Data Access Control',
			recommendation: 'Add user-based filtering to data models',
			details: 'Some data models do not have user-based filtering, which could lead to data leakage across users.',
			affectedItems: modelsWithoutUserFiltering.map(db => path.basename(db.file))
		});
	}

	// Check for missing parameterized queries
	const unsafeQueryFiles = databaseControls.filter(db => !db.accessControls.usesParamQueries);

	if (unsafeQueryFiles.length > 0) {
		recommendations.push({
			priority: 'high',
			area: 'SQL Injection Prevention',
			recommendation: 'Use parameterized queries for all database operations',
			details: 'Some database files may contain non-parameterized queries, which can lead to SQL injection vulnerabilities.',
			affectedItems: unsafeQueryFiles.map(db => path.basename(db.file))
		});
	}

	return recommendations;
}

/**
 * Find files in a directory with a specific keyword
 */
function findFiles(startPath, keyword) {
	const results = [];

	if (!fs.existsSync(startPath)) {
		return results;
	}

	const files = fs.readdirSync(startPath);

	for (const file of files) {
		const filename = path.join(startPath, file);
		const stat = fs.lstatSync(filename);

		if (stat.isDirectory()) {
			results.push(...findFiles(filename, keyword));
		} else if (filename.includes(keyword)) {
			results.push(filename);
		}
	}

	return results;
}

/**
 * Run a comprehensive access control audit
 */
async function runAccessControlAudit() {
	const startTime = Date.now();
	logger.info('Starting access control audit...');

	try {
		// Scan API routes
		const apiRoutes = scanApiRoutes();
		accessControlReport.apiRoutes = apiRoutes;

		// Scan admin routes
		const adminRoutes = scanAdminRoutes();
		accessControlReport.adminRoutes = adminRoutes;

		// Analyze auth middleware
		const authMiddleware = analyzeAuthMiddleware();
		accessControlReport.authMiddleware = authMiddleware;

		// Analyze database controls
		const databaseControls = analyzeDatabaseControls();
		accessControlReport.databaseControls = databaseControls;

		// Combine all access controls
		accessControlReport.accessControls = [
			...apiRoutes.map(route => ({
				type: 'api-route',
				name: `${route.method} ${route.path}`,
				description: route.description,
				controls: route.securityControls,
				access: route.access
			})),
			...adminRoutes.map(route => ({
				type: 'admin-route',
				name: `${route.method} ${route.path}`,
				description: `Admin route: ${route.method} ${route.path}`,
				controls: route.securityControls,
				access: 'admin'
			})),
			...authMiddleware.map(mw => ({
				type: 'middleware',
				name: mw.name,
				description: `Auth middleware: ${mw.name}`,
				controls: mw.securityFeatures,
				access: mw.checks.role ? 'role-based' : 'authenticated'
			})),
			...databaseControls.map(db => ({
				type: 'database',
				name: path.basename(db.file),
				description: `Database controls in ${path.basename(db.file)}`,
				controls: db.securityFeatures,
				access: db.accessControls.hasRoleField ? 'role-based' : (db.accessControls.hasFilterByUser ? 'user-filtered' : 'unknown')
			}))
		];

		// Generate recommendations
		accessControlReport.recommendations = generateRecommendations(
			apiRoutes,
			adminRoutes,
			authMiddleware,
			databaseControls
		);

		// Update summary
		accessControlReport.summary = {
			total: accessControlReport.accessControls.length,
			api: apiRoutes.length,
			admin: adminRoutes.length,
			middleware: authMiddleware.length,
			database: databaseControls.length,
			recommendations: {
				total: accessControlReport.recommendations.length,
				high: accessControlReport.recommendations.filter(r => r.priority === 'high').length,
				medium: accessControlReport.recommendations.filter(r => r.priority === 'medium').length,
				low: accessControlReport.recommendations.filter(r => r.priority === 'low').length
			}
		};

		// Update last audit timestamp
		accessControlReport.lastAudit = new Date().toISOString();

		// Save access control report to file
		fs.writeFileSync(
			accessControlReportPath,
			JSON.stringify(accessControlReport, null, 2)
		);

		logger.info(`Access control audit completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
		logger.info(`Found ${accessControlReport.accessControls.length} access controls and ${accessControlReport.recommendations.length} recommendations`);

		// Output summary
		console.log('\nAccess Control Audit Summary:');
		console.log('============================');
		console.log(`Total access controls: ${accessControlReport.summary.total}`);
		console.log(`  API Routes: ${accessControlReport.summary.api}`);
		console.log(`  Admin Routes: ${accessControlReport.summary.admin}`);
		console.log(`  Auth Middleware: ${accessControlReport.summary.middleware}`);
		console.log(`  Database Controls: ${accessControlReport.summary.database}`);
		console.log('\nRecommendations:');
		console.log(`  High Priority: ${accessControlReport.summary.recommendations.high}`);
		console.log(`  Medium Priority: ${accessControlReport.summary.recommendations.medium}`);
		console.log(`  Low Priority: ${accessControlReport.summary.recommendations.low}`);

		if (accessControlReport.recommendations.length > 0) {
			console.log('\nTop Recommendations:');
			accessControlReport.recommendations
				.sort((a, b) => {
					const priorityScore = { high: 3, medium: 2, low: 1 };
					return priorityScore[b.priority] - priorityScore[a.priority];
				})
				.slice(0, 3)
				.forEach((rec, i) => {
					console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation} - ${rec.details}`);
				});
		}

		console.log(`\nReport saved to: ${accessControlReportPath}`);
	} catch (error) {
		logger.error('Error in access control audit process:', error);
	}
}

// Run the access control audit
runAccessControlAudit();

module.exports = {
	runAccessControlAudit,
	scanApiRoutes,
	scanAdminRoutes,
	analyzeAuthMiddleware,
	analyzeDatabaseControls,
	generateRecommendations,
	CONFIG
};