import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests and update last activity
api.interceptors.request.use((config) => {
  // Update last activity timestamp on every API request
  localStorage.setItem('lastActivity', Date.now().toString());
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if NOT on login page (to prevent redirect loop on failed login)
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (credentials) => api.post('/login', credentials);
export const logout = () => api.post('/logout');

// Schemas
export const getSchemas = () => api.get('/schemas');
export const createSchema = (data) => api.post('/schemas', data);
export const updateSchema = (id, data) => api.put(`/schemas/${id}`, data);
export const deleteSchema = (id) => api.delete(`/schemas/${id}`);

// Networks
export const getNetworks = () => api.get('/networks');
export const createNetwork = (data) => api.post('/networks', data);
export const updateNetwork = (id, data) => api.put(`/networks/${id}`, data);
export const deleteNetwork = (id) => api.delete(`/networks/${id}`);
export const cloneNetwork = (id, name) => api.post(`/networks/${id}/clone`, { name });

// Jobs
export const getJobs = (params) => api.get('/jobs', { params });
export const getJob = (id) => api.get(`/jobs/${id}`);
export const getJobLogs = (id) => api.get(`/jobs/${id}/logs`);
export const createJob = (data) => api.post('/jobs', data);
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data);
export const deleteJob = (id) => api.delete(`/jobs/${id}`);
export const runJob = (id) => api.post(`/jobs/${id}/run`);
export const toggleJob = (id) => api.post(`/jobs/${id}/toggle`);
export const getNotifications = () => api.get('/notifications');

// Settings
export const getSettings = () => api.get('/settings');
export const updateSetting = (key, value) => api.post('/settings', { key, value });
export const getTargetDBConfig = () => api.get('/settings/target-db');
export const updateTargetDBConfig = (config) => api.post('/settings/target-db', config);

// User Management
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Audit Logs
export const getAuditLogs = (params) => api.get('/audit-logs', { params });

// Test Connections
export const testTargetDBConnection = (data) => api.post('/settings/target-db/test', data);
export const testNetworkConnection = (id) => api.post(`/networks/${id}/test`);

// Agent Tokens
export const getAgentTokens = () => api.get('/agent-tokens');
export const createAgentToken = (data) => api.post('/agent-tokens', data);
export const revokeAgentToken = (id) => api.patch(`/agent-tokens/${id}/revoke`);
export const deleteAgentToken = (id) => api.delete(`/agent-tokens/${id}`);

// License
export const getLicenseMachineId = () => api.get('/license/machine-id');
export const getLicenseStatus = () => api.get('/license/status');
export const activateLicense = (activationCode) => api.post('/license/activate', { activation_code: activationCode });

// Schema Discovery
export const discoverTables = (networkId) => api.get(`/networks/${networkId}/tables`);
export const bulkCreateSchemas = (data) => api.post('/schemas/bulk', data);

export default api;
