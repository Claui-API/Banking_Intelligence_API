// src/utils/ApiCheck.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';

// This component will check if the API is reachable
// It can be temporarily added to the Layout component to debug connection issues
const ApiCheck = () => {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState('');
  
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        setApiUrl(api.defaults.baseURL);
        
        // Try to connect to the API with a health/ping endpoint
        await api.get('/health');
        setStatus('connected');
      } catch (err) {
        setStatus('error');
        setError(`${err.message}`);
        
        // Try a simple endpoint in case /health doesn't exist
        try {
          await api.get('/');
          setStatus('connected-root');
        } catch (rootErr) {
          // Still couldn't connect to root
        }
      }
    };
    
    checkApiConnection();
  }, []);
  
  const getStatusColor = () => {
    if (status === 'checking') return 'bg-yellow-100 text-yellow-800';
    if (status === 'connected' || status === 'connected-root') return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };
  
  // Allow enabling mock API for development
  const enableMockAPI = () => {
    // Import dynamically to avoid issues
    import('../services/mockApi').then(({ useMockServices }) => {
      useMockServices();
      window.location.reload();
    });
  };
  
  return (
    <div className="fixed bottom-0 right-0 m-4 p-4 rounded-lg shadow-lg bg-white z-50">
      <div className="text-lg font-medium mb-2">API Connection Status</div>
      <div className={`px-2 py-1 rounded ${getStatusColor()} inline-block mb-2`}>
        {status === 'checking' && 'Checking API connection...'}
        {status === 'connected' && 'API Connected'}
        {status === 'connected-root' && 'Connected to API root'}
        {status === 'error' && 'API Connection Error'}
      </div>
      
      {error && (
        <div className="text-sm text-red-600 mb-3">
          Error: {error}
        </div>
      )}
      
      <div className="text-xs text-gray-500 mb-2">
        API URL: {apiUrl || 'Not set'}
      </div>
      
      {(status === 'error' || status === 'checking') && (
        <button
          onClick={enableMockAPI}
          className="bg-indigo-500 text-white px-3 py-1 rounded text-sm hover:bg-indigo-600"
        >
          Use Mock API
        </button>
      )}
    </div>
  );
};

export default ApiCheck;