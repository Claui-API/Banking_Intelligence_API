// src/components/Auth/Login.js - Updated with glassmorphism design

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, Modal } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '../../utils/logger';
import TwoFactorLogin from './TwoFactorLogin';
import './Auth.css'; // We'll create this CSS file

const Login = () => {
  // User credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // API credentials state
  const [clientId, setClientId] = useState(localStorage.getItem('clientId') || '');
  const [clientSecret, setClientSecret] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState('user'); // 'user' or 'api'

  // 2FA State
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);

  const { login, updateAuth } = useAuth();
  const navigate = useNavigate();

  /**
   * Handle successful 2FA verification
   */
  const handleTwoFactorSuccess = (authResult) => {
    logger.info('2FA verification successful, completing login');
    setLoading(false);
    setRequireTwoFactor(false);

    // Ensure tokens are stored
    localStorage.setItem('token', authResult.accessToken);
    if (authResult.refreshToken) {
      localStorage.setItem('refreshToken', authResult.refreshToken);
    }

    // Update auth context
    if (updateAuth) {
      updateAuth(); // If you have an update function in your auth context
    }

    // Navigate to dashboard with a small delay to ensure context updates
    setTimeout(() => {
      navigate('/dashboard');
    }, 100);
  };

  /**
   * Cancel 2FA verification and go back to login form
   */
  const handleTwoFactorCancel = () => {
    setRequireTwoFactor(false);
    setTwoFactorData(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Choose credentials based on login method
      const credentials = loginMethod === 'user'
        ? { email, password }
        : { clientId, clientSecret };

      // Validate required fields
      if (loginMethod === 'user' && (!email || !password)) {
        throw new Error('Email and password are required');
      } else if (loginMethod === 'api' && (!clientId || !clientSecret)) {
        throw new Error('Client ID and Client Secret are required');
      }

      // Attempt login
      const loginResult = await login(credentials);

      // Check if 2FA is required
      if (loginResult.requireTwoFactor) {
        logger.info('2FA verification required');

        setTwoFactorData({
          userId: loginResult.userId,
          email: loginResult.email || email
        });

        setRequireTwoFactor(true);
        setLoading(false);
        return;
      }

      // Check if this is a first-time login or requires token generation
      if (loginResult.requiresTokenGeneration) {
        // Show modal for token generation
        setGeneratedToken(loginResult.token);
        setShowTokenModal(true);
        setLoading(false);
      } else {
        // Standard login - navigate to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      logger.error('Login Error', err);
      setError(err.message || 'Failed to log in');
      setLoading(false);
    }
  };

  const handleCloseTokenModal = () => {
    if (generatedToken) {
      // Store the generated token
      localStorage.setItem('token', generatedToken);
    }

    setShowTokenModal(false);
    navigate('/dashboard');
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      logger.info('Authentication token copied to clipboard');
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

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9, rotateX: -15 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        delay: 0.2
      }
    }
  };

  const inputVariants = {
    focused: { scale: 1.02, boxShadow: "0 0 20px rgba(40, 167, 69, 0.3)" },
    unfocused: { scale: 1, boxShadow: "0 0 0px rgba(40, 167, 69, 0)" }
  };

  return (
    <div className="auth-container">
      {/* Animated background */}
      <div className="auth-background">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="floating-particle"
            initial={{
              opacity: 0,
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: 20 + Math.random() * 20,
              repeat: Infinity,
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>

      {requireTwoFactor ? (
        <Container className="d-flex justify-content-center align-items-center min-vh-100">
          <motion.div
            style={{ maxWidth: '500px', width: '100%' }}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <TwoFactorLogin
              userId={twoFactorData.userId}
              email={twoFactorData.email}
              onSuccess={handleTwoFactorSuccess}
              onCancel={handleTwoFactorCancel}
            />
          </motion.div>
        </Container>
      ) : (
        <Container className="d-flex justify-content-center align-items-center min-vh-100">
          <motion.div
            className="w-100"
            style={{ maxWidth: '480px' }}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div
              className="glass-card auth-card"
              variants={cardVariants}
            >
              {/* Header with logo/icon */}
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
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
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-subtitle">Sign in to your account</p>
              </motion.div>

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
                  className={`auth-tab ${loginMethod === 'user' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginMethod('user');
                    setError('');
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <i className="bi bi-person-fill me-2"></i>
                  Email & Password
                </motion.button>
                <motion.button
                  className={`auth-tab ${loginMethod === 'api' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginMethod('api');
                    setError('');
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <i className="bi bi-key-fill me-2"></i>
                  API Credentials
                </motion.button>
              </div>

              {/* Form Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={loginMethod}
                  initial={{ opacity: 0, x: loginMethod === 'user' ? -50 : 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: loginMethod === 'user' ? 50 : -50 }}
                  transition={{ duration: 0.4 }}
                >
                  <Form onSubmit={handleSubmit}>
                    {loginMethod === 'user' ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">
                            <i className="bi bi-envelope-fill me-2"></i>
                            Email Address
                          </label>
                          <motion.div
                            className="input-container"
                            variants={inputVariants}
                            whileFocus="focused"
                            initial="unfocused"
                          >
                            <input
                              type="email"
                              className="glass-input"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (error) setError('');
                              }}
                              placeholder="Enter your email"
                              required
                            />
                          </motion.div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <i className="bi bi-lock-fill me-2"></i>
                            Password
                          </label>
                          <motion.div
                            className="input-container"
                            variants={inputVariants}
                            whileFocus="focused"
                            initial="unfocused"
                          >
                            <input
                              type="password"
                              className="glass-input"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError('');
                              }}
                              placeholder="Enter your password"
                              required
                            />
                          </motion.div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="form-label">
                            <i className="bi bi-key-fill me-2"></i>
                            Client ID
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
                              value={clientId}
                              onChange={(e) => {
                                setClientId(e.target.value);
                                if (error) setError('');
                              }}
                              placeholder="Enter Client ID"
                              required={loginMethod === 'api'}
                            />
                          </motion.div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <i className="bi bi-shield-lock-fill me-2"></i>
                            Client Secret
                          </label>
                          <motion.div
                            className="input-container"
                            variants={inputVariants}
                            whileFocus="focused"
                            initial="unfocused"
                          >
                            <input
                              type="password"
                              className="glass-input"
                              value={clientSecret}
                              onChange={(e) => {
                                setClientSecret(e.target.value);
                                if (error) setError('');
                              }}
                              placeholder="Enter Client Secret"
                              required={loginMethod === 'api'}
                            />
                          </motion.div>
                        </div>
                      </>
                    )}

                    <motion.button
                      type="submit"
                      className="glass-button primary-button w-100"
                      disabled={loading || (loginMethod === 'user' && (!email || !password)) || (loginMethod === 'api' && (!clientId || !clientSecret))}
                      whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(40, 167, 69, 0.4)" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <>
                          <motion.div
                            className="loading-spinner"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <i className="bi bi-arrow-clockwise"></i>
                          </motion.div>
                          Signing in...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-in-right me-2"></i>
                          Sign In
                        </>
                      )}
                    </motion.button>
                  </Form>
                </motion.div>
              </AnimatePresence>

              {/* Footer Link */}
              <motion.div
                className="text-center mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <p className="auth-link-text">
                  Don't have an account?{' '}
                  <Link to="/register" className="auth-link">
                    Register here
                  </Link>
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        </Container>
      )}

      {/* Token Generation Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-modal"
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h4 className="modal-title">
                  <i className="bi bi-key-fill me-2"></i>
                  Authentication Token
                </h4>
                <button
                  className="modal-close"
                  onClick={handleCloseTokenModal}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>

              <div className="modal-body">
                <div className="glass-alert info-alert">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  This is your unique authentication token. Please save it securely.
                  You'll need this token to access the API.
                </div>

                <div className="form-group">
                  <label className="form-label">Your Authentication Token</label>
                  <div className="token-display">
                    <input
                      type="text"
                      value={generatedToken || ''}
                      readOnly
                      className="glass-input token-input"
                    />
                    <motion.button
                      className="glass-button secondary-button"
                      onClick={handleCopyToken}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <i className="bi bi-clipboard"></i>
                    </motion.button>
                  </div>
                </div>

                <div className="modal-actions">
                  <motion.button
                    className="glass-button primary-button"
                    onClick={handleCloseTokenModal}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <i className="bi bi-arrow-right me-2"></i>
                    Continue to Dashboard
                  </motion.button>
                </div>

                <div className="security-notice">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Keep this token confidential. Do not share it with anyone.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;