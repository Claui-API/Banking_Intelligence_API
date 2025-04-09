// Layout.js
import React from 'react';
import { Container } from 'react-bootstrap';
import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const location = useLocation();
  
  // Determine if we should show sidebar based on route
  // Added '/docs' route to the list
  const showSidebar = location.pathname.startsWith('/dashboard') ||
                     location.pathname.startsWith('/docs');
  
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <div className="flex-grow-1 d-flex">
        {showSidebar && <Sidebar />}
        
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