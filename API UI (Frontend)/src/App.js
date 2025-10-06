// src/App.js - Updated with Bank Client Routes
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import logger from './utils/logger';
import 'bootstrap/dist/css/bootstrap.min.css';
// Import your custom styles after Bootstrap
import './index.css';

// Components
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Layout/AdminRoute';
import BankClientRoute from './components/Layout/BankClientRoute'; // Import the new route component
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import HomePage from './components/HomePage';
import APITokenManagement from './components/APITokenManagement';
import Documentation from './components/Documentation/Documentation';
import SecuritySettings from './components/Account/SecuritySettings';
import DataRetention from './components/Account/DataRetention';

// Bank Dashboard Components
import BankDashboard from './components/Bank/BankDashboard';
import BankUserDetails from './components/Bank/BankUserDetails';

// Admin Components
import AdminDashboard from './components/Admin/AdminDashboard';
import ClientDetailPage from './components/Admin/ClientDetailPage';

// Unsubscribe Page
import UnsubscribePage from './pages/UnsubscribePage';

// Error Page Component
const ErrorPage = () => {
  logger.warn('404 Page Not Found');

  return (
    <div className="container text-center mt-5">
      <h1 className="display-4 text-danger">404 - Page Not Found</h1>
      <p className="lead">The page you are looking for does not exist.</p>
      <button
        onClick={() => window.location.href = '/'}
        className="btn btn-primary mt-3"
      >
        Return to Home
      </button>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/register" element={<Layout><Register /></Layout>} />

          {/* Protected routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/accounts" element={<Layout><div>Accounts Page</div></Layout>} />
            <Route path="/transactions" element={<Layout><div>Transactions Page</div></Layout>} />
            <Route path="/insights" element={<Layout><div>Insights Page</div></Layout>} />
            <Route path="/security" element={<Layout><SecuritySettings /></Layout>} />
            <Route path="/data-settings" element={<Layout><DataRetention /></Layout>} />
            <Route path="/docs" element={<Layout><Documentation /></Layout>} />
            <Route path="/api-tokens" element={<Layout><APITokenManagement /></Layout>} />
          </Route>

          {/* Bank Client Routes - Special protection for client dashboard */}
          <Route element={<BankClientRoute />}>
            <Route path="/bank-dashboard" element={<Layout><BankDashboard /></Layout>} />
            <Route path="/bank-dashboard/users/:bankUserId" element={<Layout><BankUserDetails /></Layout>} />
          </Route>

          {/* Admin routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
            <Route path="/admin/clients/:clientId" element={<Layout><ClientDetailPage /></Layout>} />
          </Route>

          {/* Unsubscribe Route */}
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          {/* Catch-all route for undefined paths */}
          <Route path="*" element={<Layout><ErrorPage /></Layout>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;