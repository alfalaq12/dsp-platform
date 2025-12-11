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
    if (error.response?.status === 401) {
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

// Jobs
export const getJobs = () => api.get('/jobs');
export const getJob = (id) => api.get(`/jobs/${id}`);
export const getJobLogs = (id) => api.get(`/jobs/${id}/logs`);
export const createJob = (data) => api.post('/jobs', data);
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data);
export const deleteJob = (id) => api.delete(`/jobs/${id}`);
export const runJob = (id) => api.post(`/jobs/${id}/run`);
export const toggleJob = (id) => api.post(`/jobs/${id}/toggle`);

// Settings
export const getSettings = () => api.get('/settings');
export const updateSetting = (key, value) => api.post('/settings', { key, value });
export const getTargetDBConfig = () => api.get('/settings/target-db');
export const updateTargetDBConfig = (config) => api.post('/settings/target-db', config);

// Audit Logs
export const getAuditLogs = (params) => api.get('/audit-logs', { params });

// Test Connections
export const testTargetDBConnection = (data) => api.post('/settings/target-db/test', data);
export const testNetworkConnection = (id) => api.post(`/networks/${id}/test`);

export default api;
