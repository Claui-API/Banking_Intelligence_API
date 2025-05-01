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
      throw error;
    }
  },
  
  getUserMetrics: async (options = {}) => {
    try {
      // Build query parameters
      const params = {};
      if (options.enhanced) {
        params.enhanced = 'true';
      }
      
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/rag-metrics/users?${queryString}` : '/rag-metrics/users';
      
      const response = await api.get(url);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch RAG user metrics');
      }
      
      logger.info(`RAG user metrics retrieved successfully (enhanced: ${!!options.enhanced})`);
      
      return response.data.data;
    } catch (error) {
      logger.logError('RAG User Metrics Error', error);
      throw error;
    }
  }
};

export default ragMetricsService;