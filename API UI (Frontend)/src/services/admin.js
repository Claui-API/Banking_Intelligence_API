// src/services/admin.js
import api from './api';
import logger from '../utils/logger';

export const adminService = {
  // List all clients with pagination and filtering
  listClients: async (page = 1, limit = 10, status = null) => {
    try {
      let url = `/admin/clients?page=${page}&limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }
      
      const response = await api.get(url);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch clients');
      }
      
      logger.info('Clients retrieved successfully', {
        totalClients: response.data.data.pagination.total,
        page,
        status
      });
      
      return response.data.data;
    } catch (error) {
      logger.logError('List Clients Error', error);
      
      if (error.response) {
        // Check for permission errors
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view client data.');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch clients';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client list request');
      }
    }
  },
  
  // Get client details
  getClient: async (clientId) => {
    try {
      const response = await api.get(`/admin/clients/${clientId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch client details');
      }
      
      logger.info('Client details retrieved successfully', {
        clientId,
        status: response.data.data.status
      });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Get Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to view this client');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch client details';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client details request');
      }
    }
  },
  
  // Approve a client
  approveClient: async (clientId) => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/approve`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to approve client');
      }
      
      logger.info('Client approved successfully', { clientId });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Approve Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to approve clients');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to approve client';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client approval request');
      }
    }
  },
  
  // Suspend a client
  suspendClient: async (clientId, reason) => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/suspend`, { reason });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to suspend client');
      }
      
      logger.info('Client suspended successfully', { clientId, reason });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Suspend Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to suspend clients');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to suspend client';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client suspension request');
      }
    }
  },
  
  // Revoke a client
  revokeClient: async (clientId, reason) => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/revoke`, { reason });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to revoke client');
      }
      
      logger.info('Client revoked successfully', { clientId, reason });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Revoke Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to revoke clients');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to revoke client';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client revocation request');
      }
    }
  },
  
  // Update client quota
  updateClientQuota: async (clientId, usageQuota) => {
    try {
      const response = await api.put(`/admin/clients/${clientId}/quota`, { usageQuota });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update client quota');
      }
      
      logger.info('Client quota updated successfully', { clientId, usageQuota });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Update Client Quota Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to update client quota');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to update client quota';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client quota update request');
      }
    }
  },
  
  // Reset client usage
  resetClientUsage: async (clientId) => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/reset-usage`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reset client usage');
      }
      
      logger.info('Client usage reset successfully', { clientId });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Reset Client Usage Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to reset client usage');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to reset client usage';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client usage reset request');
      }
    }
  },
  
  // Get system statistics
  getSystemStats: async () => {
    try {
      const response = await api.get('/admin/stats');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch system statistics');
      }
      
      logger.info('System statistics retrieved successfully');
      
      return response.data.data;
    } catch (error) {
      logger.logError('Get System Stats Error', error);
      
      if (error.response) {
        if (error.response.status === 403) {
          throw new Error('You do not have permission to view system statistics');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to fetch system statistics';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up system statistics request');
      }
    }
  },

  // Reinstate a client (after suspension or revocation)
  reinstateClient: async (clientId) => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/reinstate`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reinstate client');
      }
      
      logger.info('Client reinstated successfully', { clientId });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Reinstate Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to reinstate clients');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to reinstate client';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client reinstatement request');
      }
    }
  },

  // Delete a client from the database
  deleteClient: async (clientId) => {
    try {
      const response = await api.delete(`/admin/clients/${clientId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete client');
      }
      
      logger.info('Client deleted successfully', { clientId });
      
      return response.data.data;
    } catch (error) {
      logger.logError('Delete Client Error', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Client not found');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to delete clients');
        } else if (error.response.status === 400) {
          throw new Error(error.response.data?.message || 'Client must be revoked before deletion');
        }
        
        const errorMessage = error.response.data?.message || 'Failed to delete client';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up client deletion request');
      }
    }
  }
};

export default adminService;