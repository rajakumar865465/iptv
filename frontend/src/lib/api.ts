import axios from 'axios';

// In production the frontend talks directly to the backend.
// Set NEXT_PUBLIC_API_URL to http://<EC2-IP>:5000 (or your domain).
// In development with Next.js server running, leave it empty to use the /api rewrite proxy.
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/internal`
  : '/api/internal';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const loginAdmin = (email: string, password: string) =>
  api.post('/login', { email, password });

export const getDashboardStats = () =>
  api.get('/dashboard/stats').then((r) => r.data.data);

export const getUsers = () =>
  api.get('/users').then((r) => r.data.data);

export const getUser = (id: string) =>
  api.get(`/users/${id}`).then((r) => r.data.data);

export const updateUserStatus = (id: string, status: string) =>
  api.put(`/users/${id}/status`, { status }).then((r) => r.data.data);

export const getDevices = (params?: Record<string, string>) =>
  api.get('/devices', { params }).then((r) => r.data.data);

export const deleteDevice = (id: string) =>
  api.delete(`/devices/${id}`).then((r) => r.data.data);

export const getLicenses = () =>
  api.get('/licenses').then((r) => r.data.data);

export const createLicense = (data: Record<string, unknown>) =>
  api.post('/licenses', data).then((r) => r.data.data);

export const updateLicense = (id: string, data: Record<string, unknown>) =>
  api.put(`/licenses/${id}`, data).then((r) => r.data.data);

export const extendLicense = (id: string, days: number) =>
  api.post(`/licenses/${id}/extend`, { days }).then((r) => r.data.data);

export const suspendLicense = (id: string) =>
  api.post(`/licenses/${id}/suspend`).then((r) => r.data.data);

export const revokeLicense = (id: string) =>
  api.post(`/licenses/${id}/revoke`).then((r) => r.data.data);

export const getPlans = (params?: Record<string, unknown>) =>
  api.get('/plans', { params }).then((r) => r.data.data);

export const createPlan = (data: Record<string, unknown>) =>
  api.post('/plans', data).then((r) => r.data.data);

export const updatePlan = (id: string, data: Record<string, unknown>) =>
  api.put(`/plans/${id}`, data).then((r) => r.data.data);

export const deletePlan = (id: string) =>
  api.delete(`/plans/${id}`).then((r) => r.data.data);

export const getPayments = () =>
  api.get('/payments').then((r) => r.data.data);

export const updatePaymentStatus = (id: string, status: string) =>
  api.put(`/payments/${id}/status`, { status }).then((r) => r.data.data);

export const getChannels = (params?: Record<string, unknown>) =>
  api.get('/channels', { params }).then((r) => r.data.data);

export const createChannel = (data: Record<string, unknown>) =>
  api.post('/channels', data).then((r) => r.data.data);

export const updateChannel = (id: string, data: Record<string, unknown>) =>
  api.put(`/channels/${id}`, data).then((r) => r.data.data);

export const deleteChannel = (id: string) =>
  api.delete(`/channels/${id}`).then((r) => r.data.data);

export const getBrokenChannels = (params?: Record<string, unknown>) =>
  api.get('/channels/broken', { params }).then((r) => r.data.data);

export const fixBrokenChannel = (id: string) =>
  api.post(`/channels/broken/${id}/fix`).then((r) => r.data.data);

export const getDuplicateChannels = () =>
  api.get('/channels/duplicates').then((r) => r.data.data);

export const mergeDuplicates = (data: Record<string, unknown>) =>
  api.post('/channels/duplicates/merge', data).then((r) => r.data.data);

export const getChannelStreams = (id: string) =>
  api.get(`/channel-streams/${id}`).then((r) => r.data.data);

export const createChannelStream = (data: Record<string, unknown>) =>
  api.post('/channel-streams', data).then((r) => r.data.data);

export const updateChannelStream = (id: string, data: Record<string, unknown>) =>
  api.put(`/channel-streams/${id}`, data).then((r) => r.data.data);

export const deleteChannelStream = (id: string) =>
  api.delete(`/channel-streams/${id}`).then((r) => r.data.data);

export const diagnoseChannelStream = (id: string) =>
  api.post(`/channel-streams/${id}/diagnose`).then((r) => r.data.data);

export const getCategories = () =>
  api.get('/categories').then((r) => r.data.data);

export const createCategory = (data: Record<string, unknown>) =>
  api.post('/categories', data).then((r) => r.data.data);

export const updateCategory = (id: string, data: Record<string, unknown>) =>
  api.put(`/categories/${id}`, data).then((r) => r.data.data);

export const getLanguages = () =>
  api.get('/languages').then((r) => r.data.data);

export const getAppSettings = () =>
  api.get('/app-settings').then((r) => r.data.data);

export const updateAppSettings = (data: Record<string, unknown>) =>
  api.put('/app-settings', data).then((r) => r.data.data);

export const getNotifications = () =>
  api.get('/notifications').then((r) => r.data.data);

export const createNotification = (data: Record<string, unknown>) =>
  api.post('/notifications', data).then((r) => r.data.data);

export const updateNotification = (id: string, data: Record<string, unknown>) =>
  api.put(`/notifications/${id}`, data).then((r) => r.data.data);

export const deleteNotification = (id: string) =>
  api.delete(`/notifications/${id}`).then((r) => r.data.data);

export const getUserAnalytics = (days = 30) =>
  api.get('/analytics/users', { params: { days } }).then((r) => r.data.data);

export const getRevenueAnalytics = (days = 30) =>
  api.get('/analytics/revenue', { params: { days } }).then((r) => r.data.data);

export const getPlaybackAnalytics = () =>
  api.get('/analytics/playback').then((r) => r.data.data);

export const triggerScan = (data?: Record<string, unknown>) =>
  api.post('/scanner/trigger', data).then((r) => r.data.data);

export const getScanHistory = () =>
  api.get('/scanner').then((r) => r.data.data);

export const getSystemHealth = () =>
  api.get('/system/health').then((r) => r.data.data);

export const getApiErrors = (params?: Record<string, unknown>) =>
  api.get('/logs/api-errors', { params }).then((r) => r.data.data);

export const getAdminActions = (params?: Record<string, unknown>) =>
  api.get('/_logs/admin-actions', { params }).then((r) => r.data.data);

export const getAdminUsers = () =>
  api.get('/admin-users').then((r) => r.data.data);

export const createAdminUser = (data: Record<string, unknown>) =>
  api.post('/admin-users', data).then((r) => r.data.data);

export const updateAdminUser = (id: string, data: Record<string, unknown>) =>
  api.put(`/admin-users/${id}`, data).then((r) => r.data.data);

export const runMaintenance = (job: string) =>
  api.post(`/maintenance/${job}`).then((r) => r.data.data);

export const getMaintenanceStatus = () =>
  api.get('/maintenance/status').then((r) => r.data.data);
