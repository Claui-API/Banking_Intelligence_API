// src/scripts/deleteRevokedTokens.js

require('dotenv').config();
const Token = require('../models/Token');
const { sequelize } = require('../config/database');

async function deleteRevokedTokens() {
	try {
		// Test connection
		await sequelize.authenticate();
		console.log('Database connection established successfully');

		console.log('Starting deletion of revoked tokens');

		// Count the revoked tokens
		const revokedCount = await Token.count({
			where: {
				isRevoked: true
			}
		});

		console.log(`Found ${revokedCount} revoked tokens to delete`);

		// Delete all revoked tokens
		const deleteResult = await Token.destroy({
			where: {
				isRevoked: true
			}
		});

		console.log(`Successfully deleted ${deleteResult} revoked tokens from the database`);

		return { deletedCount: deleteResult };
	} catch (error) {
		console.error(`Token deletion failed: ${error.message}`, error.stack);
		throw error;
	}
}

// Run if called directly
if (require.main === module) {
	deleteRevokedTokens()
		.then(({ deletedCount }) => {
			console.log(`Token cleanup completed successfully. Deleted ${deletedCount} revoked tokens.`);
			process.exit(0);
		})
		.catch(error => {
			console.error('Token deletion failed:', error);
			process.exit(1);
		});
}

module.exports = deleteRevokedTokens;