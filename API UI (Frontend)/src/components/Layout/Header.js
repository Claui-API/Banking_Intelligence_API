// src/components/Layout/Header.js - Fixed account dropdown with proper click functionality
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Nav, Container, Button, Image, Dropdown } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import './Header.css';

const Header = () => {
  const { isAuthenticated, isAdmin, user, clientStatus, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef(null);

  // Check if user has active client
  const hasBankAccess = isAuthenticated && clientStatus === 'active' && !isAdmin;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle window resize to close mobile menu
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992 && expanded) {
        setExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [expanded]);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when clicking a link or outside
  const closeMenu = () => {
    setExpanded(false);
    setDropdownOpen(false);
  };

  // Close menu when route changes
  useEffect(() => {
    setExpanded(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Check if current path matches link
  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  // Toggle dropdown
  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <motion.nav
      className={`glass-navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Animated background particles */}
      <div className="navbar-particles">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="navbar-particle"
            initial={{
              opacity: 0,
              x: Math.random() * window.innerWidth,
              y: Math.random() * 100,
            }}
            animate={{
              opacity: [0, 0.6, 0],
              x: Math.random() * window.innerWidth,
              y: Math.random() * 100,
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      <Container fluid>
        {/* Brand Logo */}
        <motion.div
          className="navbar-brand-container"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/" className="glass-navbar-brand" onClick={closeMenu}>
            <motion.div
              className="logo-container"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.8 }}
            >
              <Image
                src="/images/logo.png"
                alt="CLAU Logo"
                className="navbar-logo"
              />
            </motion.div>
            <div className="brand-text-container">
              <span className="brand-text-main">CLAU API</span>
              <span className="brand-text-sub">Banking Intelligence</span>
            </div>
          </Link>
        </motion.div>

        {/* Mobile Menu Toggle */}
        <motion.button
          className={`glass-menu-toggle ${expanded ? 'active' : ''}`}
          onClick={() => setExpanded(!expanded)}
          whileTap={{ scale: 0.95 }}
          aria-label="Toggle navigation"
          aria-expanded={expanded}
        >
          <span className="toggle-line"></span>
          <span className="toggle-line"></span>
          <span className="toggle-line"></span>
        </motion.button>

        {/* Navigation Menu - Always render, control visibility with CSS */}
        <div className={`glass-navbar-collapse ${expanded ? 'show' : ''}`}>
          <div className="glass-nav-items">
            {isAuthenticated ? (
              <>
                {/* Admin Dashboard Button */}
                {isAdmin && (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link
                      to="/admin"
                      className="glass-nav-button admin-button"
                      onClick={closeMenu}
                    >
                      <i className="bi bi-gear-fill me-2"></i>
                      Admin Dashboard
                      <div className="button-glow admin-glow"></div>
                    </Link>
                  </motion.div>
                )}

                {/* Bank Dashboard Button */}
                {hasBankAccess && (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link
                      to="/bank-dashboard"
                      className="glass-nav-button bank-button"
                      onClick={closeMenu}
                    >
                      <i className="bi bi-bank me-2"></i>
                      Bank Dashboard
                      <div className="button-glow bank-glow"></div>
                    </Link>
                  </motion.div>
                )}

                {/* Account Dropdown - Fixed with click functionality */}
                <div className="glass-dropdown" ref={dropdownRef}>
                  <motion.button
                    className="glass-dropdown-toggle"
                    onClick={toggleDropdown}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <i className="bi bi-person-circle me-2"></i>
                    Account
                    <i className={`bi bi-chevron-${dropdownOpen ? 'up' : 'down'} ms-2`}></i>
                    <div className="button-glow account-glow"></div>
                  </motion.button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        className="glass-dropdown-menu show"
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Link
                          to="/dashboard"
                          className={`glass-dropdown-item ${isActiveLink('/dashboard') ? 'active' : ''}`}
                          onClick={closeMenu}
                        >
                          <i className="bi bi-speedometer2 me-2"></i>
                          Dashboard
                        </Link>

                        {hasBankAccess && (
                          <Link
                            to="/bank-dashboard"
                            className={`glass-dropdown-item ${isActiveLink('/bank-dashboard') ? 'active' : ''}`}
                            onClick={closeMenu}
                          >
                            <i className="bi bi-bank me-2"></i>
                            Bank Dashboard
                          </Link>
                        )}

                        <Link
                          to="/api-tokens"
                          className={`glass-dropdown-item ${isActiveLink('/api-tokens') ? 'active' : ''}`}
                          onClick={closeMenu}
                        >
                          <i className="bi bi-key me-2"></i>
                          API Tokens
                        </Link>

                        <Link
                          to="/security"
                          className={`glass-dropdown-item ${isActiveLink('/security') ? 'active' : ''}`}
                          onClick={closeMenu}
                        >
                          <i className="bi bi-shield-check me-2"></i>
                          Security Settings
                        </Link>

                        <Link
                          to="/data-settings"
                          className={`glass-dropdown-item ${isActiveLink('/data-settings') ? 'active' : ''}`}
                          onClick={closeMenu}
                        >
                          <i className="bi bi-sliders me-2"></i>
                          Data Settings
                        </Link>

                        <Link
                          to="/docs"
                          className={`glass-dropdown-item ${isActiveLink('/docs') ? 'active' : ''}`}
                          onClick={closeMenu}
                        >
                          <i className="bi bi-book me-2"></i>
                          Documentation
                        </Link>

                        <div className="dropdown-divider"></div>

                        <button
                          className="glass-dropdown-item logout-item"
                          onClick={() => {
                            closeMenu();
                            logout();
                          }}
                        >
                          <i className="bi bi-box-arrow-right me-2"></i>
                          Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="auth-buttons-container">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    to="/login"
                    className="glass-nav-button auth-button login-button"
                    onClick={closeMenu}
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Sign In
                    <div className="button-glow login-glow"></div>
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    to="/register"
                    className="glass-nav-button auth-button register-button"
                    onClick={closeMenu}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Register
                    <div className="button-glow register-glow"></div>
                  </Link>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </motion.nav>
  );
};

export default Header;