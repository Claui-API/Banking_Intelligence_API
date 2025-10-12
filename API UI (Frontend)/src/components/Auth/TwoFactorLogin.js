// src/components/Auth/TwoFactorLogin.js - Enhanced with glassmorphism design
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth';
import logger from '../../utils/logger';
import './Auth.css'; // Same CSS file

const TwoFactorLogin = ({ userId, email, onSuccess, onCancel }) => {
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('token');

  // Handle token verification
  const handleVerifyToken = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      // Call the API to verify the token
      const authResult = await authService.verify2FA(userId, token);

      // Log success
      logger.info('2FA verification successful');

      // Make sure tokens are set in localStorage
      if (authResult.accessToken) {
        localStorage.setItem('token', authResult.accessToken);
      }

      if (authResult.refreshToken) {
        localStorage.setItem('refreshToken', authResult.refreshToken);
      }

      // Call onSuccess with the authentication result
      if (typeof onSuccess === 'function') {
        onSuccess(authResult);
      }
    } catch (err) {
      logger.error('2FA verification error:', err);
      setError(err.message || 'Failed to verify token');
      setVerifying(false);
    }
  };

  // Handle backup code verification
  const handleVerifyBackupCode = async (e) => {
    e.preventDefault();

    if (!backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      // Call the API to verify the backup code
      const authResult = await authService.verifyBackupCode(userId, backupCode);

      // Log success
      logger.info('Backup code verification successful');

      // Call onSuccess with the authentication result
      if (typeof onSuccess === 'function') {
        onSuccess(authResult);
      }
    } catch (err) {
      logger.error('Backup code verification error:', err);
      setError(err.message || 'Failed to verify backup code');
      setVerifying(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const inputVariants = {
    focused: { scale: 1.02, boxShadow: "0 0 20px rgba(40, 167, 69, 0.3)" },
    unfocused: { scale: 1, boxShadow: "0 0 0px rgba(40, 167, 69, 0)" }
  };

  return (
    <motion.div
      className="glass-card auth-card"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className="text-center mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div
          className="auth-logo"
          whileHover={{
            scale: 1.1,
            rotate: 360,
            boxShadow: "0 0 30px rgba(40, 167, 69, 0.6)"
          }}
          transition={{ duration: 0.6 }}
        >
          <i className="bi bi-shield-lock-fill"></i>
        </motion.div>
        <h2 className="auth-title">Two-Factor Authentication</h2>
        <div className="auth-subtitle">
          Verifying for account: <strong style={{ color: '#28a745' }}>{email}</strong>
        </div>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-alert error-alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="auth-tabs">
        <motion.button
          className={`auth-tab ${activeTab === 'token' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('token');
            setError('');
            setToken('');
            setBackupCode('');
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <i className="bi bi-phone-fill me-2"></i>
          Authenticator Code
        </motion.button>
        <motion.button
          className={`auth-tab ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('backup');
            setError('');
            setToken('');
            setBackupCode('');
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <i className="bi bi-key-fill me-2"></i>
          Backup Code
        </motion.button>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'token' ? (
          <motion.div
            key="token-form"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4 }}
          >
            <div className="glass-alert info-alert mb-4">
              <i className="bi bi-info-circle-fill me-2"></i>
              Open your authenticator app and enter the 6-digit code for this account.
            </div>

            <form onSubmit={handleVerifyToken}>
              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-phone-fill me-2"></i>
                  Authentication Code
                </label>
                <motion.div
                  className="input-container"
                  variants={inputVariants}
                  whileFocus="focused"
                  initial="unfocused"
                >
                  <input
                    type="text"
                    className="glass-input"
                    style={{
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      letterSpacing: '0.5rem',
                      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
                    }}
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    disabled={verifying}
                    autoComplete="one-time-code"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                  />
                </motion.div>
              </div>

              <motion.button
                type="submit"
                className="glass-button primary-button w-100"
                disabled={verifying || !token.trim() || token.length !== 6}
                whileHover={(!verifying && token.length === 6) ? {
                  scale: 1.02,
                  boxShadow: "0 10px 30px rgba(40, 167, 69, 0.4)"
                } : {}}
                whileTap={(!verifying && token.length === 6) ? { scale: 0.98 } : {}}
              >
                {verifying ? (
                  <>
                    <motion.div
                      className="loading-spinner"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </motion.div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Verify Code
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="backup-form"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
          >
            <div className="glass-alert warning-alert mb-4">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              If you can't access your authenticator app, enter one of your backup codes.
            </div>

            <form onSubmit={handleVerifyBackupCode}>
              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-key-fill me-2"></i>
                  Backup Code
                </label>
                <motion.div
                  className="input-container"
                  variants={inputVariants}
                  whileFocus="focused"
                  initial="unfocused"
                >
                  <input
                    type="text"
                    className="glass-input"
                    style={{
                      textAlign: 'center',
                      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                      letterSpacing: '1px'
                    }}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.replace(/\s+/g, '').toLowerCase())}
                    placeholder="Enter backup code"
                    disabled={verifying}
                    autoFocus
                  />
                </motion.div>
                <div className="text-muted small mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  <i className="bi bi-info-circle me-1"></i>
                  Each backup code can only be used once.
                </div>
              </div>

              <motion.button
                type="submit"
                className="glass-button primary-button w-100"
                disabled={verifying || !backupCode.trim()}
                whileHover={(!verifying && backupCode.trim()) ? {
                  scale: 1.02,
                  boxShadow: "0 10px 30px rgba(40, 167, 69, 0.4)"
                } : {}}
                whileTap={(!verifying && backupCode.trim()) ? { scale: 0.98 } : {}}
              >
                {verifying ? (
                  <>
                    <motion.div
                      className="loading-spinner"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </motion.div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="bi bi-unlock me-2"></i>
                    Use Backup Code
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Button */}
      <motion.div
        className="text-center mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <motion.button
          className="glass-button secondary-button"
          onClick={onCancel}
          disabled={verifying}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{ padding: '0.75rem 2rem' }}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to Login
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default TwoFactorLogin;