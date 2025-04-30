// src/services/ragMetrics.service.js
import api from './api';
import logger from '../utils/logger';

export const ragMetricsService = {
  // Get system-wide RAG metrics
  getSystemMetrics: async () => {
    try {
      const response = await api.get('/rag-metrics/system');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch RAG system metrics');
      }
      
      logger.info('RAG system metrics retrieved successfully');
      
      return response.data.data;
    } catch (error) {
      logger.logError('RAG System Metrics Error', error);
      
      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view RAG system metrics.');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch RAG system metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up RAG metrics request');
      }
    }
  },
  
  // Get historical RAG metrics for charts
  getHistoricalMetrics: async (days = 7) => {
    try {
      const response = await api.get(`/rag-metrics/system/history?days=${days}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch historical RAG metrics');
      }
      
      logger.info('Historical RAG metrics retrieved successfully');
      
      return response.data.data;
    } catch (error) {
      logger.logError('Historical RAG Metrics Error', error);
      
      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view historical RAG metrics.');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch historical RAG metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up historical RAG metrics request');
      }
    }
  },
  
  // Get per-user RAG metrics
  getUserMetrics: async () => {
    try {
      const response = await api.get('/rag-metrics/users');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch RAG user metrics');
      }
      
      logger.info('RAG user metrics retrieved successfully');
      
      return response.data.data;
    } catch (error) {
      logger.logError('RAG User Metrics Error', error);
      
      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view RAG user metrics.');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch RAG user metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up RAG user metrics request');
      }
    }
  },
  
  // Get query type distribution metrics
  getQueryTypeMetrics: async () => {
    try {
      const response = await api.get('/rag-metrics/query-types');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch RAG query type metrics');
      }
      
      logger.info('RAG query type metrics retrieved successfully');
      
      return response.data.data;
    } catch (error) {
      logger.logError('RAG Query Type Metrics Error', error);
      
      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view RAG query type metrics.');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch RAG query type metrics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up RAG query type metrics request');
      }
    }
  }
};

export default ragMetricsService;