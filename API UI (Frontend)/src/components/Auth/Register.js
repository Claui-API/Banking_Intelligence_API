// src/components/Auth/Register.js - Updated with glassmorphism design
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Container, Form, Button, Alert, Card, InputGroup, Modal, Row, Col } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '../../utils/logger';
import './Auth.css'; // Same CSS file as Login

const Register = () => {
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Password strength calculator
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const validateForm = () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    // Confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Register user
      const result = await register({
        clientName,
        email,
        password,
        description
      });

      // Store credentials
      setSuccess(result.data);
      setCredentialsSaved(false);

      // Store the client ID in localStorage for later use
      localStorage.setItem('clientId', result.data.clientId);

      // Check if 2FA was auto-enabled and setup info returned
      if (result.data.twoFactorEnabled && result.data.twoFactorSecret) {
        setTwoFactorData({
          secret: result.data.twoFactorSecret,
          qrCode: result.data.twoFactorQrCode,
          backupCodes: result.data.backupCodes
        });

        // Show 2FA setup
        setShowTwoFactorSetup(true);
      }
    } catch (err) {
      logger.error('Registration Error', err);
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleCredentialsSaved = () => {
    setCredentialsSaved(true);
  };

  const handleLoginRedirect = () => {
    navigate('/login');
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
    hidden: { opacity: 0, scale: 0.9, rotateY: -15 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateY: 0,
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

  const successVariants = {
    hidden: { opacity: 0, scale: 0.8, rotateX: -90 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 25) return '#dc3545';
    if (passwordStrength < 50) return '#fd7e14';
    if (passwordStrength < 75) return '#ffc107';
    return '#28a745';
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
  };

  return (
    <div className="auth-container">
      {/* Animated background */}
      <div className="auth-background">
        {[...Array(25)].map((_, i) => (
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
              duration: 25 + Math.random() * 15,
              repeat: Infinity,
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>

      <Container className="d-flex justify-content-center align-items-center min-vh-100 py-4">
        <motion.div
          className="w-100"
          style={{ maxWidth: '540px' }}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                className="glass-card auth-card"
                variants={successVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Success Header */}
                <motion.div
                  className="text-center mb-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <motion.div
                    className="auth-logo success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    <i className="bi bi-check-circle-fill"></i>
                  </motion.div>
                  <h2 className="auth-title">Registration Complete!</h2>
                  <p className="auth-subtitle">Save your credentials securely</p>
                </motion.div>

                <div className="glass-alert warning-alert">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Important:</strong> Please save these credentials securely. They will only be shown once!
                </div>

                {/* API Credentials Display */}
                <div className="credentials-container">
                  <h5 className="credentials-title">
                    <i className="bi bi-key-fill me-2"></i>
                    API Credentials
                  </h5>

                  <div className="form-group">
                    <label className="form-label">Client ID</label>
                    <div className="credential-display">
                      <input
                        type="text"
                        readOnly
                        value={success.clientId}
                        className="glass-input credential-input"
                      />
                      <motion.button
                        className="glass-button secondary-button"
                        onClick={() => handleCopyToClipboard(success.clientId)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <i className="bi bi-clipboard"></i>
                      </motion.button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Client Secret</label>
                    <div className="credential-display">
                      <input
                        type="text"
                        readOnly
                        value={success.clientSecret}
                        className="glass-input credential-input"
                      />
                      <motion.button
                        className="glass-button secondary-button"
                        onClick={() => handleCopyToClipboard(success.clientSecret)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <i className="bi bi-clipboard"></i>
                      </motion.button>
                    </div>
                  </div>

                  <div className="glass-alert info-alert">
                    <i className="bi bi-info-circle-fill me-2"></i>
                    <strong>Note:</strong> You can now login with either your email/password or these API credentials.
                  </div>

                  <div className="form-group">
                    <motion.label
                      className="credentials-checkbox"
                      whileHover={{ scale: 1.02 }}
                    >
                      <input
                        type="checkbox"
                        checked={credentialsSaved}
                        onChange={() => setCredentialsSaved(!credentialsSaved)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-checkmark">
                        <i className="bi bi-check"></i>
                      </span>
                      I have saved my credentials securely
                    </motion.label>
                  </div>

                  <motion.button
                    className="glass-button primary-button w-100"
                    disabled={!credentialsSaved}
                    onClick={handleLoginRedirect}
                    whileHover={credentialsSaved ? { scale: 1.02, boxShadow: "0 10px 30px rgba(40, 167, 69, 0.4)" } : {}}
                    whileTap={credentialsSaved ? { scale: 0.98 } : {}}
                  >
                    <i className="bi bi-arrow-right me-2"></i>
                    Proceed to Login
                  </motion.button>
                </div>

                <div className="security-notice">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Do not share these credentials with anyone
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
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
                    <i className="bi bi-person-plus-fill"></i>
                  </motion.div>
                  <h2 className="auth-title">Join Us Today</h2>
                  <p className="auth-subtitle">Create your new account</p>
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

                <Form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">
                      <i className="bi bi-person me-2"></i>
                      Application Name
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
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        required
                        placeholder="My Banking App"
                      />
                    </motion.div>
                  </div>

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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
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
                          setPasswordStrength(calculatePasswordStrength(e.target.value));
                        }}
                        required
                        placeholder="At least 8 characters"
                      />
                    </motion.div>

                    {password && (
                      <motion.div
                        className="password-strength"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="strength-bar">
                          <motion.div
                            className="strength-fill"
                            style={{ backgroundColor: getPasswordStrengthColor() }}
                            initial={{ width: 0 }}
                            animate={{ width: `${passwordStrength}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <span
                          className="strength-label"
                          style={{ color: getPasswordStrengthColor() }}
                        >
                          {getPasswordStrengthLabel()}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <i className="bi bi-shield-check me-2"></i>
                      Confirm Password
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
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Confirm your password"
                      />
                    </motion.div>

                    {confirmPassword && password !== confirmPassword && (
                      <motion.div
                        className="password-mismatch"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <i className="bi bi-exclamation-circle me-1"></i>
                        Passwords do not match
                      </motion.div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <i className="bi bi-file-text me-2"></i>
                      Description <span className="optional">(Optional)</span>
                    </label>
                    <motion.div
                      className="input-container"
                      variants={inputVariants}
                      whileFocus="focused"
                      initial="unfocused"
                    >
                      <textarea
                        className="glass-input textarea"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the purpose of your application"
                      />
                    </motion.div>
                  </div>

                  <motion.button
                    type="submit"
                    className="glass-button primary-button w-100"
                    disabled={loading}
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
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-person-plus me-2"></i>
                        Create Account
                      </>
                    )}
                  </motion.button>
                </Form>

                {/* Footer Link */}
                <motion.div
                  className="text-center mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <p className="auth-link-text">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link">
                      Sign in here
                    </Link>
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Container>

      {/* 2FA Setup Modal */}
      <AnimatePresence>
        {showTwoFactorSetup && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-modal large"
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h4 className="modal-title">
                  <i className="bi bi-shield-lock me-2"></i>
                  Set Up Two-Factor Authentication
                </h4>
                <button
                  className="modal-close"
                  onClick={() => setShowTwoFactorSetup(false)}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>

              <div className="modal-body">
                <div className="glass-alert info-alert">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  <strong>Two-Factor Authentication Required:</strong> For enhanced security, 2FA has been enabled for your account.
                  Please complete the setup by scanning the QR code with your authenticator app.
                </div>

                <div className="qr-container">
                  <motion.img
                    src={twoFactorData?.qrCode}
                    alt="2FA QR Code"
                    className="qr-code"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <div className="secret-key">
                  <strong>Secret Key:</strong>
                  <code className="secret-code">{twoFactorData?.secret}</code>
                </div>

                <hr className="divider" />

                <h5 className="backup-title">Backup Codes</h5>
                <div className="backup-warning">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  <strong>IMPORTANT:</strong> Save these backup codes in a secure place.
                  Each code can only be used once if you lose access to your authenticator app.
                </div>

                <div className="backup-codes-grid">
                  <Row>
                    {twoFactorData?.backupCodes?.map((code, index) => (
                      <Col xs={6} md={4} className="mb-2" key={index}>
                        <div className="backup-code">
                          <code>{code}</code>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>

                <div className="backup-actions">
                  <motion.button
                    className="glass-button secondary-button"
                    onClick={() => {
                      if (twoFactorData?.backupCodes) {
                        navigator.clipboard.writeText(twoFactorData.backupCodes.join('\n'));
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <i className="bi bi-clipboard me-1"></i>
                    Copy Codes
                  </motion.button>

                  <motion.button
                    className="glass-button secondary-button"
                    onClick={() => {
                      if (twoFactorData?.backupCodes) {
                        const element = document.createElement("a");
                        const file = new Blob([twoFactorData.backupCodes.join('\n')], { type: 'text/plain' });
                        element.href = URL.createObjectURL(file);
                        element.download = "2fa-backup-codes.txt";
                        document.body.appendChild(element);
                        element.click();
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <i className="bi bi-download me-1"></i>
                    Download Codes
                  </motion.button>
                </div>
              </div>

              <div className="modal-footer">
                <motion.button
                  className="glass-button primary-button"
                  onClick={() => {
                    setShowTwoFactorSetup(false);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <i className="bi bi-check me-2"></i>
                  I've Saved My Codes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Register;