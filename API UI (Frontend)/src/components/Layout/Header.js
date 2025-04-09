// src/components/Layout/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Nav, Container, Button, Image } from 'react-bootstrap';

const Header = () => {
  const { isAuthenticated, logout } = useAuth();
  
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
                <Button 
                  onClick={logout}
                  className="ms-2"
                  variant="secondary"
                >
                  Sign Out
                </Button>
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