// src/components/Layout/Header.js
// Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';

const Header = () => {
  const { isAuthenticated, logout } = useAuth();
  
  return (
    <Navbar variant="light" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/" className='text-white'>CLAU API</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isAuthenticated ? (
              <>
                <Button 
                  class="btn btn-secondary"
                  onClick={logout}
                  className="ms-2"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button 
                  as={Link} 
                  class="btn btn-secondary"
                  to="/login" 
                  variant="light" 
                  className="ms-2"
                >
                  Sign In
                </Button>
                <Button 
                  as={Link} 
                  class="btn btn-secondary"
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