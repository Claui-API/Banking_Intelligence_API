// src/components/Layout/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Nav, Container, Button, Image, Dropdown } from 'react-bootstrap';

const Header = () => {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  
  return (
    <Navbar variant="light" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/" className='text-white d-flex align-items-center'>
          <Image 
            src="/images/1-back.png" 
            alt="CLAU Logo" 
            className="me-2" 
            style={{ width: '32px', height: '32px' }}
          />
          CLAU API
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Button 
                    as={Link} 
                    to="/admin" 
                    variant="success" 
                    className="me-2"
                  >
                    Admin Dashboard
                  </Button>
                )}
                
                <Dropdown align="end" className="me-2">
                  <Dropdown.Toggle variant="outline-dark" id="dropdown-menu">
                    Account
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item as={Link} to="/dashboard">Dashboard</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/api-tokens">API Tokens</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/docs">Documentation</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={logout}>Sign Out</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <>
                <Button 
                  as={Link} 
                  to="/login" 
                  variant="light" 
                  className="ms-2"
                >
                  Sign In
                </Button>
                <Button 
                  as={Link} 
                  to="/register" 
                  variant="light" 
                  className="ms-2"
                >
                  Register
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;