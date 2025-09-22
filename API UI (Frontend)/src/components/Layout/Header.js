// src/components/Layout/Header.js - Mobile Optimized with Bank Dashboard
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Nav, Container, Button, Image, Dropdown } from 'react-bootstrap';

const Header = () => {
  const { isAuthenticated, isAdmin, user, clientStatus, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  // Check if user has active client
  const hasBankAccess = isAuthenticated && clientStatus === 'active' && !isAdmin;

  // Close mobile menu when clicking a link
  const closeMenu = () => {
    if (window.innerWidth < 992) {
      setExpanded(false);
    }
  };

  return (
    <Navbar
      variant="dark"
      expand="lg"
      expanded={expanded}
      onToggle={setExpanded}
      className="mobile-optimized-navbar"
    >
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className='text-white d-flex align-items-center' onClick={closeMenu}>
          <Image
            src="/images/logo.png"
            alt="CLAU Logo"
            className="navbar-logo me-2"
            style={{ width: '100px', height: '100px' }}
          />
          <span className="brand-text">CLAU API</span>
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="responsive-navbar-nav"
          className="custom-toggler"
        />

        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="ms-auto nav-items">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Button
                    as={Link}
                    to="/admin"
                    variant="success"
                    className="me-2 admin-button"
                    onClick={closeMenu}
                  >
                    Admin Dashboard
                  </Button>
                )}

                {hasBankAccess && (
                  <Button
                    as={Link}
                    to="/bank-dashboard"
                    variant="primary"
                    className="me-2 bank-button"
                    onClick={closeMenu}
                  >
                    Bank Dashboard
                  </Button>
                )}

                <Dropdown align="end" className="account-dropdown">
                  <Dropdown.Toggle variant="outline-light" id="dropdown-menu" className="account-dropdown-toggle">
                    Account
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="account-dropdown-menu">
                    <Dropdown.Item as={Link} to="/dashboard" onClick={closeMenu}>Dashboard</Dropdown.Item>
                    {hasBankAccess && (
                      <Dropdown.Item as={Link} to="/bank-dashboard" onClick={closeMenu}>Bank Dashboard</Dropdown.Item>
                    )}
                    <Dropdown.Item as={Link} to="/api-tokens" onClick={closeMenu}>API Tokens</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/security" onClick={closeMenu}>Security Settings</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/data-settings" onClick={closeMenu}>Data Settings</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/docs" onClick={closeMenu}>Documentation</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      onClick={() => {
                        closeMenu();
                        logout();
                      }}
                    >
                      Sign Out
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <div className="auth-buttons">
                <Button
                  as={Link}
                  to="/login"
                  variant="light"
                  className="auth-button"
                  onClick={closeMenu}
                >
                  Sign In
                </Button>
                <Button
                  as={Link}
                  to="/register"
                  variant="light"
                  className="auth-button ms-2"
                  onClick={closeMenu}
                >
                  Register
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;