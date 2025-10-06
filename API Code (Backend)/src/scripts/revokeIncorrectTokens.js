// src/scripts/revokeIncorrectTokens.js

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Token } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function revokeIncorrectTokens() {
	try {
		// Test connection
		await sequelize.authenticate();
		console.log('Database connection established successfully');

		console.log('Starting token audit and cleanup process');

		// Get all tokens that aren't already revoked
		const tokens = await Token.findAll({
			where: {
				isRevoked: false
			}
		});

		console.log(`Found ${tokens.length} active tokens to audit`);

		let revokedCount = 0;
		let mismatchCount = 0;

		for (const token of tokens) {
			try {
				// Decode token to check its type
				const decoded = jwt.decode(token.token);

				// Skip if token can't be decoded
				if (!decoded) {
					console.warn(`Couldn't decode token ${token.id}`);
					continue;
				}

				console.log(`Token ${token.id}: DB Type=${token.tokenType}, JWT Type=${decoded.type || 'undefined'}`);

				// Check if token type in JWT doesn't match database type
				if (decoded.type && decoded.type !== token.tokenType) {
					console.warn(`Token type mismatch: DB=${token.tokenType}, JWT=${decoded.type}, ID=${token.id}, ClientID=${token.clientId}, UserID=${token.userId}`);
					mismatchCount++;

					// Revoke mismatched token
					token.isRevoked = true;
					await token.save();
					revokedCount++;
				}
			} catch (tokenError) {
				console.error(`Error processing token ${token.id}: ${tokenError.message}`);

				// Revoke invalid tokens
				token.isRevoked = true;
				await token.save();
				revokedCount++;
			}
		}

		console.log(`Token audit complete. Found ${mismatchCount} type mismatches. Revoked ${revokedCount} tokens.`);

		return { mismatchCount, revokedCount };
	} catch (error) {
		console.error(`Token audit failed: ${error.message}`, error.stack);
		throw error;
	} finally {
		// No need to close connection manually as it's shared with the application
	}
}

// Run if called directly
if (require.main === module) {
	revokeIncorrectTokens()
		.then(({ mismatchCount, revokedCount }) => {
			console.log(`Token cleanup completed successfully. Revoked ${revokedCount} tokens with ${mismatchCount} type mismatches.`);
			process.exit(0);
		})
		.catch(error => {
			console.error('Token cleanup failed:', error);
			process.exit(1);
		});
}

module.exports = revokeIncorrectTokens;