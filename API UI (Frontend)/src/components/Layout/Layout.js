// Layout.js
import React from 'react';
import { Container } from 'react-bootstrap';
import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
  const location = useLocation();
  
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <div className="flex-grow-1 d-flex">
      
        <main className="flex-grow-1 bg-light">
          <Container fluid className="py-4">
            {children}
          </Container>
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default Layout;