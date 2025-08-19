// src/components/Dashboard/Dashboard.js - Fixed version with proper data isolation
import VisualFinanceIntegration from '../Chat/VisualFinanceIntegration';
import DirectDataIntegration from './DirectDataIntegration';
import DataIntegrationModeSelector from './DataIntegrationModeSelector';
import InlineQueryHelper from './InlineQueryHelper';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Nav, Form, InputGroup, Badge, Dropdown, Spinner, Alert } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { insightsService } from '../../services/insights';
import { useAuth } from '../../context/AuthContext';
import Documentation from '../Documentation/Documentation';
import './Dashboard.css';
import APIKeysManagement from '../APITokenManagement';
import { EventSourcePolyfill } from 'event-source-polyfill';
import PlaidLinkButton from '../Plaid/PlaidLinkButton';
import logger from '../../utils/logger';
import api from '../../services/api';
import PlaidDataSidebar from '../Dashboard/PlaidDataSidebar';

// Simple API Status component
const PlaidApiStatus = () => {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const checkApi = async () => {
      try {
        // First try the health endpoint since /plaid/status might not exist yet
        const response = await api.get('/health');

        if (response.data && response.status === 200) {
          setStatus('connected');

          // Also try to check plaid status, but don't fail if it's not available
          try {
            await api.get('/plaid/status');
          } catch (plaidErr) {
            // Just log this error, don't change the status
            console.log('Plaid status endpoint not available yet');
          }
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('API health check failed:', error);
        setStatus('error');
      }
    };

    checkApi();
  }, []);

  return (
    <Badge
      bg={status === 'checking' ? 'secondary' : status === 'connected' ? 'success' : 'danger'}
      className="d-flex align-items-center"
    >
      <span className="status-indicator me-1"></span>
      API: {status === 'checking' ? 'Checking...' : status === 'connected' ? 'Online' : 'Error'}
    </Badge>
  );
};

const Dashboard = () => {
  const { user, clientStatus, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [apiKey, setApiKey] = useState(() => {
    return user?.token || localStorage.getItem('token') || 'No API key found';
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am CLAU, your Banking Intelligence Assistant. How can I help you with your financial data today?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  const [insightsData, setInsightsData] = useState(null);

  // Add a ref to track the latest request ID
  const latestRequestIdRef = useRef(null);
  const chatEndRef = useRef(null);

  // Add Plaid connection state
  const [connected, setConnected] = useState(false);
  const [institution, setInstitution] = useState('');
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  // Add state for the financial data sidebar
  const [showDataSidebar, setShowDataSidebar] = useState(false);
  const [financialData, setFinancialData] = useState(null);
  const [loadingFinancialData, setLoadingFinancialData] = useState(false);

  // Add state for tracking Plaid connection status
  const [plaidStatus, setPlaidStatus] = useState('ready');
  const [plaidError, setPlaidError] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // State for visualizations
  const [visualizationsVisible, setVisualizationsVisible] = useState(true);

  // State for integration mode
  const [integrationMode, setIntegrationMode] = useState(() => {
    // Try to get from localStorage first, default to 'plaid'
    return localStorage.getItem('integrationMode') || 'plaid';
  }); // 'plaid' or 'direct'
  const [directFinancialData, setDirectFinancialData] = useState(null);

  const [selectorExpanded, setSelectorExpanded] = useState(true);

  // Handler to toggle between integration modes
  const handleIntegrationModeChange = (mode) => {
    // Only make changes if the mode is actually changing
    if (mode === integrationMode) return;

    console.log(`Switching integration mode from ${integrationMode} to ${mode}`);

    // Persist the mode to localStorage for API consistency
    localStorage.setItem('integrationMode', mode);

    // Update the connection status in localStorage too
    localStorage.setItem('plaidConnected', connected ? 'true' : 'false');

    // Set the new mode in state
    setIntegrationMode(mode);

    // Add a system message to the chat showing mode change
    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: mode === 'plaid'
        ? `I've switched to Plaid Integration mode. ${connected ? `I'm now using your connected bank data from ${institution}.` : "Connect a bank to use real financial data."}`
        : "I've switched to Direct Data Integration mode. I'm now using the simulated financial data that you can customize.",
      timestamp: new Date().toISOString(),
      isSystemMessage: true
    }]);

    // IMPORTANT: Break the data connection between modes
    // This is the key fix - we must completely separate data between modes
    if (mode === 'plaid') {
      // In Plaid mode, sidebar visibility depends on connection status
      setShowDataSidebar(connected);

      // If connected, fetch fresh Plaid data
      if (connected) {
        fetchFinancialData();
      } else {
        // Important: Set financialData to null, not directFinancialData
        setFinancialData(null);
      }
    } else if (mode === 'direct') {
      // In Direct mode, always show sidebar
      setShowDataSidebar(true);

      // CRITICAL FIX: Create a deep copy of directFinancialData to break any references to Plaid data
      // This prevents data leakage between modes
      const directDataCopy = directFinancialData ? JSON.parse(JSON.stringify(directFinancialData)) : null;
      setFinancialData(directDataCopy);
    }
  };

  // Add handler for direct data changes
  const handleDirectDataChange = (newData) => {
    // Always create a deep copy to prevent reference issues
    const newDataCopy = newData ? JSON.parse(JSON.stringify(newData)) : null;

    // Set the direct data state
    setDirectFinancialData(newDataCopy);

    // Update if this data is being used in the chat (we're in direct mode)
    if (integrationMode === 'direct') {
      // Create another deep copy to ensure complete isolation
      const financialDataCopy = newDataCopy ? JSON.parse(JSON.stringify(newDataCopy)) : null;
      setFinancialData(financialDataCopy);

      // IMPORTANT: Add a system message to notify the user that data has changed
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I've updated my knowledge with your changed financial data. You now have ${financialDataCopy?.accounts?.length || 0} accounts with a total balance of $${calculateTotalBalance(financialDataCopy).toFixed(2)}.`,
          timestamp: new Date().toISOString(),
          isSystemMessage: true
        }
      ]);

      // Log the data update for debugging
      console.log("Financial data updated:", financialDataCopy);
    }
  };

  const calculateTotalBalance = (data) => {
    if (!data || !data.accounts || !Array.isArray(data.accounts)) {
      return 0;
    }

    return data.accounts.reduce((total, account) => {
      // For credit accounts, use available balance (limit - current)
      if (account.type === 'credit') {
        return total + (account.balances.available || 0);
      }
      // For regular accounts, use current balance
      return total + (account.balances.current || 0);
    }, 0);
  };

  // Handler for clearing chat messages
  const handleClearChat = () => {
    // Add confirmation dialog
    if (window.confirm('Are you sure you want to clear all chat messages?')) {
      // Reset to initial welcome message
      setChatMessages([
        {
          role: 'assistant',
          content: `Hello ${user?.email || ''}! I am CLAU, your Banking Intelligence Assistant. How can I help you with your financial data today?`,
          timestamp: new Date().toISOString()
        }
      ]);

      // Scroll to bottom after clearing
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Handler for clearing visualizations
  const handleClearVisualizations = () => {
    setVisualizationsVisible(false);

    // Re-enable visualizations after a short delay
    // This allows for properly clearing the current visualizations
    setTimeout(() => {
      setVisualizationsVisible(true);
    }, 300);
  };

  // Sample suggested prompts
  const suggestedPrompts = [
    "How much did I spend on dining out last month?",
    "What are my top expense categories?",
    "How can I improve my savings rate?",
    "Am I on track with my budget this month?"
  ];

  // Connected account prompts
  const connectedPrompts = [
    "How much did I spend on dining out last month?",
    "What's my current account balance?",
    "How can I improve my savings?",
    "Am I spending more on groceries than average?"
  ];

  useEffect(() => {
    // Update the connection status in localStorage when it changes
    localStorage.setItem('plaidConnected', connected ? 'true' : 'false');
  }, [connected]);

  // Reset all state when user changes - IMPORTANT for data isolation
  useEffect(() => {
    if (user) {
      // Reset all financial data when user changes
      setFinancialData(null);
      setConnected(false);
      setInstitution('');
      setShowDataSidebar(false);

      // Reset chat messages to initial state for new user
      setChatMessages([
        {
          role: 'assistant',
          content: `Hello ${user.email || ''}! I am CLAU, your Banking Intelligence Assistant. How can I help you with your financial data today?`,
          timestamp: new Date().toISOString()
        }
      ]);

      // Check for existing connections for THIS user
      checkExistingConnections();
    }
  }, [user?.id]); // Only trigger when user ID changes

  // Fetch financial data from Plaid
  const fetchFinancialData = useCallback(async () => {
    // Don't fetch if not connected or no user
    if (!connected || !user?.id) return;

    try {
      setLoadingFinancialData(true);
      logger.info(`Fetching financial data from Plaid for user ${user.id}`);

      // Add auth timestamp to URL to prevent caching and ensure fresh data
      const timestamp = Date.now();

      // Fetch accounts data with user validation
      const accountsResponse = await api.get(`/plaid/accounts?_t=${timestamp}`);

      // Fetch transactions data with user validation
      const transactionsResponse = await api.get(`/plaid/transactions?_t=${timestamp}`);

      if (accountsResponse.data.success && transactionsResponse.data.success) {
        const combinedData = {
          accounts: accountsResponse.data.data || [],
          transactions: transactionsResponse.data.data || [],
          institution: institution,
          lastUpdated: new Date().toISOString(),
          userId: user.id // Store user ID with the data for validation
        };

        // Store the data in component state
        setFinancialData(combinedData);
        setShowDataSidebar(true);

        logger.info(`Financial data fetched for user ${user.id}: ${combinedData.accounts.length} accounts, ${combinedData.transactions.length} transactions`);
      } else {
        throw new Error('Failed to retrieve complete financial data');
      }
    } catch (error) {
      logger.error(`Error fetching financial data for user ${user.id}:`, error);
      console.error('Error fetching financial data:', error);

      // Don't disable sidebar if we have partial data
      if (!financialData) {
        setShowDataSidebar(false);
      }
    } finally {
      setLoadingFinancialData(false);
    }
  }, [connected, institution, user?.id]);

  // Check for existing Plaid connections on component mount or when user changes
  const checkExistingConnections = useCallback(async () => {
    if (!user?.id) return;

    try {
      logger.info(`Checking existing Plaid connections for user ${user.id}`);
      // Check if we already have accounts for THIS user
      const response = await api.get('/plaid/status');

      if (response.data.success && response.data.data.connected) {
        // We have existing accounts for this user, set the connected state
        setConnected(true);
        setShowDataSidebar(true);

        // Get institution information if available
        if (response.data.data.institution) {
          setInstitution(response.data.data.institution);
        }

        // Fetch financial data for THIS user
        fetchFinancialData();

        logger.info(`Found existing Plaid connection for user ${user.id} to ${response.data.data.institution || 'a bank'}`);
      } else {
        // No connected accounts for this user
        setConnected(false);
        setShowDataSidebar(false);
        setFinancialData(null);
        logger.info(`No existing Plaid connections found for user ${user.id}`);
      }
    } catch (error) {
      // No connected accounts or error fetching
      logger.error(`Error checking existing connections for user ${user.id}:`, error);
      setConnected(false);
      setShowDataSidebar(false);
      setFinancialData(null);
    }
  }, [user?.id, fetchFinancialData]);

  useEffect(() => {
    // When integration mode changes or when directFinancialData updates
    if (integrationMode === 'plaid') {
      // In Plaid mode: show sidebar only if connected
      setShowDataSidebar(connected);

      // If connected, use Plaid data
      if (connected) {
        // Fetch fresh data from Plaid to ensure we have the latest
        fetchFinancialData();
      } else {
        // Clear financial data if not connected
        setFinancialData(null);
      }
    } else if (integrationMode === 'direct') {
      // In Direct mode: always show the sidebar
      setShowDataSidebar(true);

      // CRITICAL FIX: Create a deep copy of directFinancialData to break any references
      const directDataCopy = directFinancialData ? JSON.parse(JSON.stringify(directFinancialData)) : null;

      // IMPORTANT: Always set financialData to a copy of directFinancialData in direct mode
      // This breaks any reference to Plaid data
      setFinancialData(directDataCopy);

      // Debug logging
      console.log("Direct mode active, financial data set to:", directDataCopy);
    }

    // Update localStorage with current mode
    localStorage.setItem('integrationMode', integrationMode);
  }, [integrationMode, connected, directFinancialData, fetchFinancialData]);

  useEffect(() => {
    // Scroll to bottom of chat when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Check Plaid status and user's connections on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      checkExistingConnections();
    }
  }, [user?.id, checkExistingConnections]);

  // Clean up function to clear state when component unmounts
  useEffect(() => {
    return () => {
      // Clear any cached data when dashboard unmounts
      setFinancialData(null);
      setConnected(false);

      // Clear any in-progress requests
      latestRequestIdRef.current = null;
    };
  }, []);

  // Add this useEffect to initialize direct data when needed
  useEffect(() => {
    // Initialize direct data if we're in direct mode and there's no data yet
    if (integrationMode === 'direct' && !directFinancialData) {
      // Create a default dataset if needed
      const defaultData = {
        // Your default data structure here
        accounts: [],
        transactions: [],
        institution: 'Demo Bank',
        lastUpdated: new Date().toISOString(),
        userId: user?.id
      };

      // Set the direct data
      setDirectFinancialData(defaultData);

      // Show the sidebar
      setShowDataSidebar(true);
    }
  }, [integrationMode, directFinancialData, user?.id]);

  // Generate a unique request ID
  const generateRequestId = () => {
    return `req_${user?.id || 'nouser'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle Plaid connection success
  const handlePlaidSuccess = ({ itemId, metadata }) => {
    try {
      // Log detailed success info
      logger.info(`Bank account connected successfully for user ${user?.id}`, {
        institution: metadata.institution.name,
        accountCount: metadata.accounts.length,
        itemId: itemId
      });

      // Save institution name for display
      setInstitution(metadata.institution.name);

      // Mark as connected
      setConnected(true);

      // Explicitly set showDataSidebar to true
      setShowDataSidebar(true);

      // Show success message
      setConnectionSuccess(true);
      setTimeout(() => setConnectionSuccess(false), 5000); // Hide after 5 seconds

      // Add a system message showing connection success
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I've successfully connected to your accounts at ${metadata.institution.name}. You can now ask questions about your actual financial data!`,
          timestamp: new Date().toISOString()
        }
      ]);

      // Fetch financial data after successful connection
      fetchFinancialData();
    } catch (err) {
      logger.error(`Plaid Success Handling Error for user ${user?.id}:`, err);
      setConnectionSuccess(false);
      alert(`Error processing bank connection: ${err.message}`);
    }
  };

  // Handle Plaid exit (user canceled or error)
  const handlePlaidExit = (err, metadata) => {
    if (err) {
      logger.error(`Plaid Exit Error for user ${user?.id}:`, {
        message: err.message,
        metadata: metadata
      });

      if (err.error_code) {
        switch (err.error_code) {
          case 'INVALID_LINK_TOKEN':
            alert('Invalid link token. Please try again later.');
            break;
          case 'INVALID_REQUEST':
            alert('There was a problem with the request. Please try again.');
            break;
          case 'INSTITUTION_ERROR':
            alert('There was a problem connecting to this institution. Please try again later.');
            break;
          default:
            alert(`Error: ${err.message || 'Unknown error'}`);
        }
      }
    } else {
      logger.info(`Plaid Link flow exited for user ${user?.id}`, metadata);
    }
  };

  // Add this transformation function to your Dashboard.js file

  /**
   * Transform direct data to match the structure expected by the AI
   * @param {Object} directData - The original direct data
   * @returns {Object} - Transformed data matching AI's expected structure
   */
  const transformDirectDataForAI = (directData) => {
    if (!directData) return null;

    // Create a deep copy to avoid modifying the original
    const originalData = JSON.parse(JSON.stringify(directData));
    const transformedData = {
      // Keep metadata
      institution: originalData.institution,
      lastUpdated: originalData.lastUpdated,
      userId: originalData.userId,

      // Transform accounts
      accounts: originalData.accounts.map(account => ({
        accountId: account.id,
        name: account.name,
        type: account.type,
        subType: account.subtype,
        // CRITICAL: Convert nested balances to flat properties
        balance: account.balances.current,
        availableBalance: account.balances.available,
        creditLimit: account.balances.limit,
        currency: account.balances.isoCurrencyCode,
        mask: account.mask,
        // Add additional metadata to help the AI
        metadata: {
          originalType: account.type,
          originalSubtype: account.subtype
        }
      })),

      // Transform transactions
      transactions: originalData.transactions.map(transaction => ({
        transactionId: transaction.id,
        accountId: transaction.account_id,
        // CRITICAL: Convert amount if needed - ensure expenses are negative
        amount: transaction.amount < 0 ? transaction.amount : -transaction.amount,
        // Flatten category array to string if needed
        category: Array.isArray(transaction.category) ? transaction.category[0] : transaction.category,
        date: transaction.date,
        description: transaction.name,
        // Derive transaction type based on amount
        type: transaction.amount < 0 ? 'expense' : 'income',
        pending: transaction.pending,
        paymentChannel: transaction.payment_channel,
        // Add any additional metadata that might help the AI
        metadata: {
          fullCategory: Array.isArray(transaction.category) ? transaction.category : [transaction.category]
        }
      }))
    };

    return transformedData;
  };

  // Stream insights with EventSource
  const streamInsights = async (inputQuery) => {
    if (!inputQuery.trim()) return;
    setLoading(true);

    try {
      // Add user message
      setChatMessages(prev => [...prev, {
        role: 'user',
        content: inputQuery,
        timestamp: new Date().toISOString()
      }]);

      // Set initial assistant message with loading state
      const tempMessageId = `msg_${Date.now()}`;
      setChatMessages(prev => [...prev, {
        id: tempMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date().toISOString()
      }]);

      // Clear input and scroll immediately
      setQuery('');
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      // Generate a request ID that includes the user ID for traceability
      const requestId = generateRequestId();
      latestRequestIdRef.current = requestId;

      // CRITICAL FIX: Ensure the correct data is sent based on the active mode
      let dataToSend = null;
      const isUsingPlaidData = integrationMode === 'plaid' && connected;

      if (isUsingPlaidData) {
        // In Plaid mode with connection, use Plaid data (which already has the correct structure)
        dataToSend = financialData ? JSON.parse(JSON.stringify(financialData)) : null;
        console.log("Using Plaid connected data for API request");
      } else if (integrationMode === 'direct') {
        // In Direct mode, transform the data to match the structure expected by the AI
        const directDataCopy = financialData ? JSON.parse(JSON.stringify(financialData)) : null;
        dataToSend = directDataCopy ? transformDirectDataForAI(directDataCopy) : null;

        console.log("Using transformed Direct data for API request", {
          accounts: dataToSend?.accounts?.map(a => ({
            name: a.name,
            balance: a.balance,
            type: a.type
          })),
          transactions: dataToSend?.transactions?.length
        });
      } else {
        // Not connected in Plaid mode or unknown mode - use no data
        dataToSend = null;
        console.log("No financial data available for API request");
      }

      // Update localStorage with current mode for API consistency
      localStorage.setItem('integrationMode', integrationMode);
      localStorage.setItem('plaidConnected', connected ? 'true' : 'false');

      // Create payload with explicit mode flags and only the appropriate data
      const payload = {
        query: inputQuery,
        requestId,
        // Set these flags explicitly based on the active mode
        useConnectedData: isUsingPlaidData,
        userId: user?.id,
        integrationMode,
        useDirectData: integrationMode === 'direct',
        // Only send the appropriate data source based on the active mode
        financialData: dataToSend,
        // Add an explicit mode marker that the backend can check
        dataSourceMode: integrationMode,
        // Add timestamp to help prevent cache issues
        timestamp: new Date().toISOString()
      };

      // Log the payload mode for debugging
      console.log(`API Payload - Mode: ${integrationMode}, Using real data: ${isUsingPlaidData}, Account count: ${dataToSend?.accounts?.length || 0}`);

      const response = await fetch('/api/insights/stream-prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to prepare streaming request');
      }

      // Create event source for streaming
      const eventSource = new EventSourcePolyfill(`/api/insights/stream?requestId=${requestId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      // Handle incoming chunks
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            // Handle error in stream
            setChatMessages(prev => prev.map(msg =>
              msg.id === tempMessageId
                ? { ...msg, content: data.message, isStreaming: false }
                : msg
            ));
            eventSource.close();
            return;
          }

          // Special handling for the real-data marker
          if (data.chunk === '<using-real-data>') {
            // IMPORTANT: Only set the real data flag if we're actually in Plaid mode and connected
            if (integrationMode === 'plaid' && connected) {
              setChatMessages(prev => prev.map(msg =>
                msg.id === tempMessageId
                  ? { ...msg, usingRealData: true }
                  : msg
              ));
            }
            return; // Skip this chunk
          }

          // Update message with new content
          setChatMessages(prev => prev.map(msg =>
            msg.id === tempMessageId
              ? { ...msg, content: (msg.content || '') + data.chunk }
              : msg
          ));

          // Auto-scroll
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

          // Close connection if complete
          if (data.isComplete) {
            eventSource.close();

            // Mark streaming as complete
            setChatMessages(prev => prev.map(msg =>
              msg.id === tempMessageId
                ? {
                  ...msg,
                  isStreaming: false,
                  // CRITICAL FIX: Set data source badge based on current mode, not on API response
                  usingRealData: integrationMode === 'plaid' && connected,
                  usingSimulatedData: integrationMode === 'direct'
                }
                : msg
            ));
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err, event.data);
        }
      };

      // Handle connection errors
      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
        eventSource.close();

        // Fallback to non-streaming approach if SSE fails
        fallbackToStandardRequest(inputQuery, requestId, tempMessageId);
      };
    } catch (error) {
      console.error('Error setting up streaming:', error);

      // Use standard API call as fallback
      fallbackToStandardRequest(inputQuery, generateRequestId(), `msg_${Date.now()}`);
    } finally {
      setLoading(false);
    }
  };

  // Fallback function for when streaming fails
  const fallbackToStandardRequest = async (inputQuery, requestId, tempMessageId) => {
    try {
      // CRITICAL FIX: Ensure proper data mode enforcement in fallback too
      const isUsingPlaidData = integrationMode === 'plaid' && connected;

      // Create data for the current mode
      let dataToSend = null;
      if (isUsingPlaidData) {
        dataToSend = financialData ? JSON.parse(JSON.stringify(financialData)) : null;
      } else if (integrationMode === 'direct') {
        dataToSend = directFinancialData ? JSON.parse(JSON.stringify(directFinancialData)) : null;
      }

      // Custom request options
      const customOptions = {
        integrationMode: integrationMode,
        useConnectedData: isUsingPlaidData,
        useDirectData: integrationMode === 'direct',
        financialData: dataToSend
      };

      // Use the updated generateInsights method with custom options
      const data = await insightsService.generateInsights(inputQuery, requestId, customOptions);

      // Extract text
      const insightText = extractInsightText(data);

      // Update message with full text
      setChatMessages(prev => {
        // Check if the message with tempMessageId already exists
        const messageExists = prev.some(msg => msg.id === tempMessageId);

        if (messageExists) {
          // Update existing message
          return prev.map(msg =>
            msg.id === tempMessageId
              ? {
                ...msg,
                content: insightText,
                isStreaming: false,
                // CRITICAL FIX: Set data source badge based on current mode, not on API response
                usingRealData: integrationMode === 'plaid' && connected,
                usingSimulatedData: integrationMode === 'direct'
              }
              : msg
          );
        } else {
          // Message doesn't exist, add a new one
          return [...prev, {
            id: tempMessageId,
            role: 'assistant',
            content: insightText,
            isStreaming: false,
            // CRITICAL FIX: Set data source badge based on current mode, not on API response
            usingRealData: integrationMode === 'plaid' && connected,
            usingSimulatedData: integrationMode === 'direct',
            timestamp: new Date().toISOString()
          }];
        }
      });
    } catch (error) {
      console.error('Fallback request error:', error);

      // Get error message
      const errorMessage = getErrorMessage(error);

      // Update or add error message
      setChatMessages(prev => {
        const messageExists = prev.some(msg => msg.id === tempMessageId);

        if (messageExists) {
          return prev.map(msg =>
            msg.id === tempMessageId
              ? { ...msg, content: errorMessage, isStreaming: false }
              : msg
          );
        } else {
          return [...prev, {
            id: tempMessageId,
            role: 'assistant',
            content: errorMessage,
            isStreaming: false,
            timestamp: new Date().toISOString()
          }];
        }
      });
    }
  };

  // Helper function to extract insight text
  const extractInsightText = (data) => {
    if (!data || !data.insights) {
      return "I'm unable to generate insights at the moment. Please try again later.";
    }

    if (typeof data.insights === 'string') {
      return data.insights;
    } else if (data.insights.insight) {
      return data.insights.insight;
    } else if (data.insights.text) {
      return data.insights.text;
    } else {
      return JSON.stringify(data.insights);
    }
  };

  // Helper function to get error message based on status code
  const getErrorMessage = (error) => {
    if (error.status === 403) {
      return error.message || "I cannot provide information about potentially harmful or illegal topics. Please ask about legitimate financial matters instead.";
    } else {
      return "I'm sorry, but I encountered an error. Please try again later.";
    }
  };

  // Handle key press in chat input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (query.trim()) {
      streamInsights(query);
    }
  };

  // Handle using a suggested prompt
  const handleSuggestedPrompt = (prompt) => {
    setQuery(prompt);

    // Focus input field after setting value
    document.getElementById('chat-input')?.focus();
  };

  // Handle improved logout
  const handleLogout = async () => {
    try {
      // First clear Plaid data and financial state
      setConnected(false);
      setInstitution('');
      setShowDataSidebar(false);
      setFinancialData(null);

      // Try to clear session data on server
      if (user?.id) {
        try {
          await api.post('/users/session/clear');
          logger.info(`Session data cleared on server for user ${user.id}`);
        } catch (clearError) {
          logger.error('Failed to clear session data on server:', clearError);
          // Continue with logout even if this fails
        }
      }

      // Finally, perform actual logout
      await logout();

      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // If error occurs, still try to logout
      logout();
    }
  };
  const renderPlaygroundSection = () => (
    <div className="playground-layout">
      {/* Playground Header */}
      <div className="playground-header">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center">
          <h2 className="text-white mb-3 mb-lg-0">Banking Intelligence Playground</h2>
          <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center">
            {/* Show Plaid connection button/status only when in Plaid mode */}
            {integrationMode === 'plaid' && (
              <div className="d-flex align-items-center me-md-3 mb-2 mb-md-0 w-100 w-md-auto">
                <Badge bg={connected ? "success" : "warning"} className="d-flex align-items-center">
                  <span className="status-indicator me-1"></span>
                  {connected ? `Connected to ${institution}` : "No Accounts Connected"}
                </Badge>
                {!connected && (
                  <PlaidLinkButton
                    onSuccess={(linkData) => {
                      setPlaidStatus('success');
                      handlePlaidSuccess(linkData);
                    }}
                    onExit={(err, metadata) => {
                      if (err) {
                        setPlaidStatus('error');
                        setPlaidError(err.message || 'Error connecting to bank');
                      } else {
                        setPlaidStatus('ready');
                      }
                      handlePlaidExit(err, metadata);
                    }}
                    buttonText="Connect Bank"
                    className="ms-2 btn-sm"
                  />
                )}
              </div>
            )}
            <PlaidApiStatus />
          </div>
        </div>
      </div>
      {/* Data Integration Mode Selector */}
      <div className="mx-4 mt-3">
        <div className="integration-selector-container">
          <div className="integration-selector-header d-flex justify-content-between align-items-center mb-2"
            onClick={() => setSelectorExpanded(!selectorExpanded)}
            style={{ cursor: 'pointer' }}>
            <h6 className="mb-0 text-white">
              <i className="bi bi-database me-2"></i>
              Data Source
            </h6>
            <Button variant="link" className="p-0 text-white">
              <i className={`bi bi-chevron-${selectorExpanded ? 'up' : 'down'}`}></i>
            </Button>
          </div>

          {selectorExpanded && (
            <DataIntegrationModeSelector
              currentMode={integrationMode}
              onSelectMode={handleIntegrationModeChange}
              plaidConnected={connected}
              institution={institution}
            />
          )}
        </div>
      </div>
      {/* Display Plaid error if present */}
      {plaidError && (
        <div className="text-danger mt-2 mx-4 small">
          <i className="bi bi-exclamation-triangle me-1"></i>
          {plaidError}
        </div>
      )}

      {/* Success message when accounts connected */}
      {connectionSuccess && (
        <Alert
          variant="success"
          className="mx-4 mt-2"
          onClose={() => setConnectionSuccess(false)}
          dismissible
        >
          <i className="bi bi-check-circle-fill me-2"></i>
          Successfully connected accounts from <strong>{institution}</strong>! You can now ask questions about your financial data.
        </Alert>
      )}

      {/* Chat Interface with Sidebar */}
      <div className="chat-container">
        <div className="chat-interface-wrapper">
          {/* Main chat area */}
          <div className={`chat-area ${showDataSidebar ? 'with-sidebar' : ''}`}>
            {/* Add new toolbar for clear buttons */}
            <div className="chat-actions-toolbar">
              <Button
                variant="outline-danger"
                size="sm"
                className="clear-chat-btn"
                onClick={handleClearChat}
              >
                <i className="bi bi-trash me-1"></i>
                Clear Chat
              </Button>
              <Button
                variant="outline-warning"
                size="sm"
                className="clear-viz-btn"
                onClick={handleClearVisualizations}
                disabled={chatMessages.length <= 1}
              >
                <i className="bi bi-graph-down me-1"></i>
                Clear Visualizations
              </Button>
            </div>

            {/* Chat messages rendering */}
            <div className="chat-messages">
              {/* Your existing chat messages rendering code */}
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.role === 'assistant' ? 'assistant-message' : 'user-message'}`}
                >
                  <div className="message-avatar">
                    {message.role === 'assistant' ? (
                      <img src="/images/logo.png" alt="AI Assistant" className="ai-avatar-image" />
                    ) : 'You'}
                  </div>
                  <div className="message-content">
                    {message.isStreaming ? (
                      // Show typing effect for streaming messages
                      <>
                        <pre className="message-text">{message.content}</pre>
                        <div className="typing-cursor"></div>
                      </>
                    ) : message.content && message.content.length > 200 && !message.fullyLoaded ? (
                      // Progressive loading for long messages
                      <>
                        <pre className="message-text">{message.content.substring(0, 200)}...</pre>
                        <div className="more-content">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                              setChatMessages(prev => prev.map((msg, i) =>
                                i === index ? { ...msg, fullyLoaded: true } : msg
                              ));
                            }}
                          >
                            Show more
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {message.usingRealData && (
                          <Badge bg="info" className="mb-2">Using Connected Bank Data</Badge>
                        )}
                        {message.usingSimulatedData && (
                          <Badge bg="warning" className="mb-2">Using Simulated Data</Badge>
                        )}
                        {/* If neither badge is set, but we're in direct mode and it's an assistant message, show simulated badge */}
                        {!message.usingRealData && !message.usingSimulatedData &&
                          integrationMode === 'direct' &&
                          !message.isSystemMessage &&
                          message.role === 'assistant' &&
                          !message.isStreaming && (
                            <Badge bg="warning" className="mb-2">Using Simulated Data</Badge>
                          )}
                        {/* If neither badge is set, but we're in plaid mode, connected, and it's an assistant message, show connected badge */}
                        {!message.usingRealData && !message.usingSimulatedData &&
                          integrationMode === 'plaid' &&
                          connected &&
                          !message.isSystemMessage &&
                          message.role === 'assistant' &&
                          !message.isStreaming && (
                            <Badge bg="info" className="mb-2">Using Connected Bank Data</Badge>
                          )}
                        <pre className="message-text">{message.content}</pre>
                      </>
                    )}
                    <div className="message-timestamp">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Add visualization button after the message if applicable */}
                    {message.role === 'assistant' && !message.isStreaming && (
                      <div className="message-actions">
                        {/* This will conditionally render the visualization button only for messages with financial concepts */}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Visualization integration component - pass the enabled prop */}
              <VisualFinanceIntegration
                chatMessages={chatMessages}
                financialData={financialData}
                enabled={visualizationsVisible}
              />

              <div ref={chatEndRef} />
            </div>

            {/* Suggested Prompts */}
            {chatMessages.length < 3 && (
              <div className="suggested-prompts">
                <p className="text-white mb-2">
                  {connected
                    ? "Try asking about your connected accounts:"
                    : "Try asking:"}
                </p>
                <div className="d-flex flex-wrap gap-2">
                  {(connected ? connectedPrompts : suggestedPrompts).map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline-success"
                      size="sm"
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="suggested-prompt-btn"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="chat-input-container">
              {/* Use Form.Group to better structure the input and button */}
              <Form className="w-100 d-flex align-items-stretch">
                <Form.Group className="flex-grow-1 mb-0 me-2 position-relative">
                  {/* Either use the InlineQueryHelper or fallback to a standard Form.Control */}
                  {InlineQueryHelper ? (
                    <InlineQueryHelper
                      query={query}
                      setQuery={setQuery}
                      handleSendMessage={handleSendMessage}
                    />
                  ) : (
                    <Form.Control
                      id="chat-input"
                      as="textarea"
                      rows={1}
                      placeholder="Ask about your financial data..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="chat-input text-black"
                    />
                  )}
                </Form.Group>

                <Button
                  variant="success"
                  className="send-button"
                  disabled={!query.trim() || loading}
                  onClick={handleSendMessage}
                >
                  <i className="bi bi-send"></i>
                </Button>
              </Form>
            </div>

            <div className="chat-footer">
              <p className="text-white small mb-0">
                CLAU may produce inaccurate information about people, places, or financial advice.
              </p>
            </div>
          </div>

          {/* Financial Data Sidebar */}
          {showDataSidebar && (
            <div className="financial-data-sidebar">
              {/* Mobile toggle header */}
              <div className="d-flex d-lg-none justify-content-between align-items-center mb-2 mobile-sidebar-header">
                <h5 className="text-white mb-0">Financial Data</h5>
                <Button
                  variant="outline-light"
                  size="sm"
                  className="mobile-sidebar-toggle-btn"
                  onClick={() => setShowDataSidebar(!showDataSidebar)}
                >
                  <i className="bi bi-chevron-up"></i>
                </Button>
              </div>

              {integrationMode === 'plaid' ? (
                <PlaidDataSidebar
                  userData={financialData}
                  isVisible={showDataSidebar}
                  isLoading={loadingFinancialData}
                  onRefresh={fetchFinancialData}
                  userId={user?.id} // Pass the user ID for validation
                />
              ) : (
                <DirectDataIntegration
                  isVisible={showDataSidebar}
                  onDataChange={handleDirectDataChange}
                  initialData={directFinancialData}
                  userId={user?.id}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render sections based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'playground':
        return renderPlaygroundSection();

      case 'api-keys':
        return <APIKeysManagement />;

      case 'documentation':
        return <Documentation />;

      case 'home':
      default:
        return (
          <Container fluid className="py-5 mobile-dashboard-home">
            <Row className="justify-content-center text-center mb-4 mb-lg-5">
              <Col md={10}>
                <h2 className="text-white mb-3">Welcome to Banking Intelligence API</h2>
                <p className="text-white mb-3">Add AI-powered financial insights to your banking application</p>
                <div className="mt-3 mobile-dashboard-actions">
                  <Button
                    variant="success"
                    size="lg"
                    className="me-0 me-md-3 mb-2 mb-md-0 mobile-dashboard-btn"
                    onClick={() => setActiveSection('playground')}
                  >
                    Try the Playground
                  </Button>
                  <Button
                    variant="outline-light"
                    size="lg"
                    className="mobile-dashboard-btn"
                    onClick={() => setActiveSection('documentation')}
                  >
                    Read Documentation
                  </Button>
                </div>
              </Col>
            </Row>

            <Row className="mb-4 mb-lg-5 justify-content-center">
              <Col md={10}>
                <Card className="bg-black text-white">
                  <Card.Body className="bg-black p-3 p-md-4">
                    <h3 className="text-success justify-content-center mb-3">Getting Started</h3>
                    <p>
                      The Banking Intelligence API lets you enhance your application with AI-powered financial insights.
                      Analyze transactions, provide budget recommendations, and help your users make better financial decisions.
                    </p>

                    <Row className="mt-4 text-center mobile-getting-started-row">
                      <Col md={4} sm={6} className="mb-3 mb-md-0">
                        <div className="mb-3">
                          <i className="bi bi-chat-dots text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Try the Playground</h5>
                        <p className="small">Test queries and see responses in real-time</p>
                      </Col>
                      <Col md={4} sm={6} className="mb-3 mb-md-0">
                        <div className="mb-3">
                          <i className="bi bi-key text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Get Your API Keys</h5>
                        <p className="small">Generate keys to integrate with your app</p>
                      </Col>
                      <Col md={4} sm={12}>
                        <div className="mb-3">
                          <i className="bi bi-book text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h5>Read the Docs</h5>
                        <p className="small">Explore API endpoints and implementation</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <h3 className="text-white text-center mb-3 mb-lg-4">Explore Our Features</h3>

            <Row className="g-3 g-lg-4 mobile-features-grid">
              <Col lg={4} md={6} sm={12}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-chat-text text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">Playground</h4>
                    </div>
                    <p>
                      Test our AI in an interactive chat interface. Ask financial questions and see how the API responds in real-time.
                    </p>
                    <Button
                      variant="outline-success"
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('playground')}
                    >
                      Open Playground
                    </Button>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4} md={6} sm={12}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-key-fill text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">API Keys</h4>
                    </div>
                    <p>
                      Manage your API keys and credentials for integrating the Banking Intelligence API with your applications and monitor your usage.
                    </p>
                    <Button
                      variant="outline-success"
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('api-keys')}
                    >
                      Manage API Keys
                    </Button>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4} md={12} sm={12}>
                <Card className="h-100 bg-black text-white border border-success feature-card">
                  <Card.Body className='bg-black'>
                    <div className="d-flex align-items-center mb-3">
                      <div className="feature-icon bg-success bg-opacity-25 me-3">
                        <i className="bi bi-book-half text-success" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h4 className="mb-0">Documentation</h4>
                    </div>
                    <p>
                      Comprehensive guides, API references, and code examples to help you integrate our financial AI into your app.
                    </p>
                    <Button
                      variant="outline-success"
                      className="mt-auto w-100"
                      onClick={() => setActiveSection('documentation')}
                    >
                      View Documentation
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Mobile Sidebar Toggle Button - only visible on mobile */}
      <div className="d-lg-none mobile-sidebar-toggle">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar navigation"
        >
          <i className={`bi bi-${sidebarOpen ? 'x' : 'list'}`}></i>
        </button>
      </div>

      {/* Sidebar with mobile toggle */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h4 className="text-success mb-0">
            <a href="/" className="logo-link">
              <img
                src="/images/logo.png"
                alt="AI Assistant"
                className="sidebar-image-clau"
              />
            </a>
          </h4>
          {user && (
            <div className="text-white small mt-2 user-info">
              <i className="bi bi-person-circle me-1"></i> {user.email}
              {/* Close button only visible on mobile */}
              <button
                className="d-lg-none close-sidebar-btn"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
          )}
        </div>

        <Nav className="sidebar-nav">
          <Nav.Link
            onClick={() => {
              setActiveSection('home');
              if (window.innerWidth < 992) setSidebarOpen(false);
            }}
            className={`sidebar-link ${activeSection === 'home' ? 'active' : ''}`}
          >
            <i className="bi bi-house-door me-2"></i>
            Home
          </Nav.Link>
          <Nav.Link
            onClick={() => {
              setActiveSection('documentation');
              if (window.innerWidth < 992) setSidebarOpen(false);
            }}
            className={`sidebar-link ${activeSection === 'documentation' ? 'active' : ''}`}
          >
            <i className="bi bi-book me-2"></i>
            Documentation
          </Nav.Link>
          <Nav.Link
            onClick={() => {
              setActiveSection('playground');
              if (window.innerWidth < 992) setSidebarOpen(false);
            }}
            className={`sidebar-link ${activeSection === 'playground' ? 'active' : ''}`}
          >
            <i className="bi bi-chat-text me-2"></i>
            Playground
          </Nav.Link>
          <Nav.Link
            onClick={() => {
              setActiveSection('api-keys');
              if (window.innerWidth < 992) setSidebarOpen(false);
            }}
            className={`sidebar-link ${activeSection === 'api-keys' ? 'active' : ''}`}
          >
            <i className="bi bi-key me-2"></i>
            API Keys
          </Nav.Link>
          <hr className="border-secondary my-2" />
          <Nav.Link
            onClick={handleLogout}
            className="sidebar-link text-danger mt-auto"
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Logout
          </Nav.Link>
        </Nav>
      </div>

      {/* Main content area with class to adjust when sidebar is collapsed on mobile */}
      <div className={`main-content ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;