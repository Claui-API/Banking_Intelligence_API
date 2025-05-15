// src/services/crypto.service.js
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Service for handling encryption and decryption operations
 */
class CryptoService {
	constructor() {
		// Get encryption key from environment variables
		this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-environment';
		this.algorithm = 'aes-256-cbc';

		// Validate key length
		if (this.encryptionKey.length < 32 && process.env.NODE_ENV === 'production') {
			logger.warn('WARNING: Encryption key should be at least 32 characters in production');
		}

		// Ensure key is 32 bytes (for AES-256)
		this.key = crypto.createHash('sha256').update(this.encryptionKey).digest('base64').substring(0, 32);
	}

	/**
	 * Encrypt a string value
	 * @param {string} text - Text to encrypt
	 * @returns {string} - Encrypted text (base64 encoded)
	 */
	encrypt(text) {
		try {
			// Generate a random initialization vector
			const iv = crypto.randomBytes(16);

			// Create cipher
			const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key), iv);

			// Encrypt the text
			let encrypted = cipher.update(text, 'utf8', 'hex');
			encrypted += cipher.final('hex');

			// Combine IV and encrypted data
			return `${iv.toString('hex')}:${encrypted}`;
		} catch (error) {
			logger.error('Encryption error:', error);
			throw new Error('Failed to encrypt data');
		}
	}

	/**
	 * Decrypt an encrypted string
	 * @param {string} encryptedText - Encrypted text (base64 encoded)
	 * @returns {string} - Decrypted text
	 */
	decrypt(encryptedText) {
		try {
			// Split IV and encrypted data
			const parts = encryptedText.split(':');
			if (parts.length !== 2) {
				throw new Error('Invalid encrypted format');
			}

			const iv = Buffer.from(parts[0], 'hex');
			const encrypted = parts[1];

			// Create decipher
			const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key), iv);

			// Decrypt the data
			let decrypted = decipher.update(encrypted, 'hex', 'utf8');
			decrypted += decipher.final('utf8');

			return decrypted;
		} catch (error) {
			logger.error('Decryption error:', error);
			throw new Error('Failed to decrypt data');
		}
	}

	/**
	 * Generate a random secure token
	 * @param {number} length - Length of the token (default: 32)
	 * @returns {string} - Random token
	 */
	generateToken(length = 32) {
		try {
			return crypto.randomBytes(length).toString('hex');
		} catch (error) {
			logger.error('Token generation error:', error);
			throw new Error('Failed to generate secure token');
		}
	}

	/**
	 * Hash a value using SHA-256
	 * @param {string} value - Value to hash
	 * @returns {string} - Hashed value
	 */
	hash(value) {
		try {
			return crypto.createHash('sha256').update(value).digest('hex');
		} catch (error) {
			logger.error('Hashing error:', error);
			throw new Error('Failed to hash value');
		}
	}

	/**
	 * Create a secure HMAC signature
	 * @param {string} data - Data to sign
	 * @returns {string} - HMAC signature
	 */
	createSignature(data) {
		try {
			return crypto.createHmac('sha256', this.key)
				.update(data)
				.digest('hex');
		} catch (error) {
			logger.error('Signature creation error:', error);
			throw new Error('Failed to create signature');
		}
	}

	/**
	 * Verify a HMAC signature
	 * @param {string} data - Original data
	 * @param {string} signature - Signature to verify
	 * @returns {boolean} - Whether the signature is valid
	 */
	verifySignature(data, signature) {
		try {
			const computedSignature = this.createSignature(data);
			return crypto.timingSafeEqual(
				Buffer.from(signature, 'hex'),
				Buffer.from(computedSignature, 'hex')
			);
		} catch (error) {
			logger.error('Signature verification error:', error);
			return false;
		}
	}
}

// Export singleton instance
module.exports = new CryptoService();