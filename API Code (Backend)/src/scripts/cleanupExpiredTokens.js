// src/scripts/cleanupExpiredTokens.js

require('dotenv').config();
const { Op } = require('sequelize');
const { Token } = require('../models');
const { sequelize } = require('../config/database');

async function cleanupExpiredTokens() {
	try {
		// Test connection
		await sequelize.authenticate();
		console.log('Database connection established successfully');

		console.log('Starting cleanup of expired tokens');

		const now = new Date();

		// Count the expired tokens
		const expiredCount = await Token.count({
			where: {
				expiresAt: {
					[Op.lt]: now
				},
				isRevoked: false // Only count non-revoked tokens
			}
		});

		console.log(`Found ${expiredCount} expired tokens to mark as revoked`);

		// Mark expired tokens as revoked first
		const revokeResult = await Token.update(
			{ isRevoked: true },
			{
				where: {
					expiresAt: {
						[Op.lt]: now
					},
					isRevoked: false
				}
			}
		);

		console.log(`Marked ${revokeResult[0]} expired tokens as revoked`);

		// Then count all tokens that are revoked or expired
		const totalToDeleteCount = await Token.count({
			where: {
				[Op.or]: [
					{ isRevoked: true },
					{
						expiresAt: {
							[Op.lt]: now
						}
					}
				]
			}
		});

		console.log(`Found a total of ${totalToDeleteCount} tokens to delete (revoked or expired)`);

		// Delete all tokens that are revoked or expired
		const deleteResult = await Token.destroy({
			where: {
				[Op.or]: [
					{ isRevoked: true },
					{
						expiresAt: {
							[Op.lt]: now
						}
					}
				]
			}
		});

		console.log(`Successfully deleted ${deleteResult} tokens from the database`);

		return {
			expiredCount,
			revokedCount: revokeResult[0],
			deletedCount: deleteResult
		};
	} catch (error) {
		console.error(`Token cleanup failed: ${error.message}`, error.stack);
		throw error;
	}
}

// Run if called directly
if (require.main === module) {
	cleanupExpiredTokens()
		.then(({ expiredCount, revokedCount, deletedCount }) => {
			console.log(`Token cleanup completed successfully.`);
			console.log(`Found ${expiredCount} expired tokens.`);
			console.log(`Marked ${revokedCount} tokens as revoked.`);
			console.log(`Deleted ${deletedCount} tokens total.`);
			process.exit(0);
		})
		.catch(error => {
			console.error('Token cleanup failed:', error);
			process.exit(1);
		});
}

module.exports = cleanupExpiredTokens;