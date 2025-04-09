// Sidebar.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Nav, Button } from 'react-bootstrap';

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  
  // Try to load collapsed state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setCollapsed(savedState === 'true');
    }
  }, []);
  
  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed.toString());
  }, [collapsed]);
  
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { path: '/docs', label: 'Documentation', icon: 'bi-book' }
  ];
  
  return (
    <Nav 
      className={`d-md-block bg-black sidebar transition-width ${collapsed ? 'collapsed' : ''}`}
      style={{ 
        width: collapsed ? '60px' : '210px',
        transition: 'width 0.3s ease'
      }}
    >
      <div className="position-sticky pt-3">
        <div className="d-flex justify-content-end px-3 mb-3">
          <Button 
            variant="dark" 
            size="sm" 
            onClick={() => setCollapsed(!collapsed)}
            className="border-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
          </Button>
        </div>
        
        {navItems.map((item) => (
          <Nav.Item key={item.path}>
            <Nav.Link 
              as={Link} 
              to={item.path} 
              className={`nav-link ${location.pathname === item.path ? 'active' : ''} text-white`}
              title={collapsed ? item.label : ''}
            >
              <i className={`bi ${item.icon} text-white ${collapsed ? '' : 'me-2'}`}></i>
              {!collapsed && <span>{item.label}</span>}
            </Nav.Link>
          </Nav.Item>
        ))}
      </div>
    </Nav>
  );
};

export default Sidebar;