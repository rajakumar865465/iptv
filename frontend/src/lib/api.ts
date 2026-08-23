import axios from 'axios';

// In production the frontend talks directly to the backend.
// Set NEXT_PUBLIC_API_URL to http://44.206.18.189
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
    // Provide actionable message for network errors (backend unreachable)
    if (!err.response) {
      const url = err.config?.baseURL ? `${err.config.baseURL}${err.config.url}` : err.config?.url || '';
      err.message = `Cannot reach backend server. Check that the backend is running and NEXT_PUBLIC_API_URL is correct. (${url})`;
    }
    return Promise.reject(err);
  }
);

export default api;

export function getErrorMessage(err: any, fallback: string) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
// The backend paginates these endpoints (max 200/page) but the admin pages
// filter/paginate client-side over the full dataset, so walk every page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllPages<T = any>(path: string, params?: Record<string, unknown>): Promise<T[]> {
  const limit = 200;
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const r = await api.get(path, { params: { ...params, page, limit } });
    const payload = r.data.data;
    const rows: T[] = Array.isArray(payload) ? payload : payload?.data ?? [];
    all.push(...rows);
    const hasMore = !Array.isArray(payload) && payload?.pagination?.hasMore === true && rows.length > 0;
    if (!hasMore) return all;
  }
}

export const loginAdmin = (email: string, password: string) =>
  api.post('/login', { email, password });

export const getDashboardStats = () =>
  api.get('/dashboard/stats').then((r) => r.data.data);

export const getUsers = (params?: Record<string, string>) =>
  fetchAllPages('/users', params);

export const getUser = (id: string) =>
  api.get(`/users/${id}`).then((r) => r.data.data);

export const updateUserStatus = (id: string, status: string) =>
  api.put(`/users/${id}/status`, { status }).then((r) => r.data.data);

export const getDevices = (params?: Record<string, string>) =>
  api.get('/devices', { params }).then((r) => r.data.data);

export const deleteDevice = (id: string) =>
  api.delete(`/devices/${id}`).then((r) => r.data.data);

export const getLicenses = () =>
  fetchAllPages('/licenses');

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
  fetchAllPages('/payments');

export const updatePaymentStatus = (id: string, status: string) =>
  api.put(`/payments/${id}/status`, { status }).then((r) => r.data.data);

// --- Manual UPI Orders (verification queue) ---
// Keyed on the human-readable order_id (NIVA-...), which is what the customer
// quotes over WhatsApp.
export const getOrders = (params?: Record<string, unknown>) =>
  api.get('/orders', { params }).then((r) => r.data.data);

export const getOrderSummary = () =>
  api.get('/orders/summary').then((r) => r.data.data);

export const getOrderDetail = (orderId: string) =>
  api.get(`/orders/${encodeURIComponent(orderId)}`).then((r) => r.data.data);

/** The only call that activates a subscription. Requires bank/UPI verification first. */
export const approveOrder = (orderId: string) =>
  api.post(`/orders/${encodeURIComponent(orderId)}/approve`).then((r) => r.data.data);

export const rejectOrder = (orderId: string, reason: string) =>
  api.post(`/orders/${encodeURIComponent(orderId)}/reject`, { reason }).then((r) => r.data.data);

// --- Payment mode switch (manual UPI ⇄ Razorpay) ---
export const getPaymentSettings = () =>
  api.get('/payment-settings').then((r) => r.data.data);

export const updatePaymentSettings = (data: Record<string, unknown>) =>
  api.put('/payment-settings', data).then((r) => r.data.data);

export const getChannels = (params?: Record<string, unknown>) =>
  api.get('/channels', { params }).then((r) => r.data.data || r.data);

export const hideChannel = (id: string, reason: string, prevent_reimport: boolean) =>
  api.post(`/channels/${id}/hide`, { reason, prevent_reimport }).then((r) => r.data.data);

export const removeChannel = (id: string, reason: string, prevent_reimport: boolean) =>
  api.post(`/channels/${id}/remove`, { reason, prevent_reimport }).then((r) => r.data.data);

export const restoreChannel = (id: string, restore_in_app: boolean = true) =>
  api.post(`/channels/${id}/restore`, { restore_in_app }).then((r) => r.data.data);

export const restoreAllHiddenChannels = () =>
  api.post('/channels/restore-all-hidden', {}).then((r) => r.data.data);

export const getHiddenChannels = () =>
  api.get('/channels-hidden').then((r) => r.data.data);

export const getRemovedChannels = () =>
  api.get('/channels-removed').then((r) => r.data.data);

export const getReportedChannels = (status?: string) =>
  api.get('/channels/reports', { params: { status } }).then((r) => r.data.data);

export const updateReportStatus = (id: string, status: string) =>
  api.put(`/channels/reports/${id}/status`, { status }).then((r) => r.data.data);

export const startImportJob = (source_url?: string, options?: any) =>
  api.post('/import/iptv-org', { source_url, options }).then((r) => r.data.data);

export const getImportJobs = () =>
  api.get('/import/jobs').then((r) => r.data.data);

// --- M3U Channel Importer & Stream Health Scanner (staged import) ---
export const fetchM3uPreview = (url: string) =>
  api.post('/channel-import/fetch', { url }).then((r) => r.data.data);

export const parseM3uSession = (payload: {
  source_type: 'url' | 'text';
  source_url?: string;
  content?: string;
  source_label?: string;
  language?: string;
  country?: string;
  source_name?: string;
}) => api.post('/channel-import/parse', payload).then((r) => r.data.data);

export const startImportSessionScan = (sessionId: number | string) =>
  api.post(`/channel-import/${sessionId}/scan`).then((r) => r.data.data);

export const getImportSession = (sessionId: number | string) =>
  api.get(`/channel-import/${sessionId}`).then((r) => r.data.data);

export const getImportSessionItems = (
  sessionId: number | string,
  params?: Record<string, unknown>
) => api.get(`/channel-import/${sessionId}/items`, { params }).then((r) => r.data.data);

export const importSelectedChannels = (sessionId: number | string, itemIds: number[]) =>
  api.post(`/channel-import/${sessionId}/import`, { itemIds }).then((r) => r.data.data);

export const cancelImportSession = (sessionId: number | string) =>
  api.post(`/channel-import/${sessionId}/cancel`).then((r) => r.data.data);

export const listImportSessions = () =>
  api.get('/channel-import').then((r) => r.data.data);

export const createChannel = (data: Record<string, unknown>) =>
  api.post('/channels', data).then((r) => r.data.data);

export const updateChannel = (id: string, data: Record<string, unknown>) =>
  api.put(`/channels/${id}`, data).then((r) => r.data.data);

export const deleteChannel = (id: string) =>
  api.delete(`/channels/${id}`).then((r) => r.data.data);

export const bulkDeleteChannels = (ids: string[]) =>
  api.post(`/channels/bulk-delete`, { ids }).then((r) => r.data.data);

export const getBrokenChannels = (params?: Record<string, unknown>) =>
  api.get('/channels/broken', { params }).then((r) => r.data.data);

export const fixBrokenChannel = (id: string) =>
  api.post(`/channels/broken/${id}/fix`).then((r) => r.data.data);

export const verifyBrokenChannel = (id: string, data: Record<string, unknown>) =>
  api.post(`/channels/broken/${id}/verify`, data).then((r) => r.data.data);

export const bulkActionBrokenChannels = (data: Record<string, unknown>) =>
  api.post('/channels/broken/bulk-action', data).then((r) => r.data.data);

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

export const deleteCategory = (id: string) =>
  api.delete(`/categories/${id}`).then((r) => r.data.data);

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
  api.get('/logs/admin-actions', { params }).then((r) => r.data.data);

export const getSystemLogs = (params?: Record<string, unknown>) =>
  api.get('/logs/system', { params }).then((r) => r.data);

export const getAdminUsers = () =>
  api.get('/admin-users').then((r) => r.data.data);

export const createAdminUser = (data: Record<string, unknown>) =>
  api.post('/admin-users', data).then((r) => r.data.data);

export const updateAdminUser = (id: string, data: Record<string, unknown>) =>
  api.put(`/admin-users/${id}`, data).then((r) => r.data.data);


export const getMaintenanceStatus = () =>
  api.get('/maintenance/status').then((r) => r.data.data);

// App releases
export const getAppReleases = () =>
  api.get('/app-releases').then((r) => r.data.data);

export const createAppRelease = (data: Record<string, unknown>) =>
  api.post('/app-releases', data).then((r) => r.data.data);

export const updateAppRelease = (id: string, data: Record<string, unknown>) =>
  api.put(`/app-releases/${id}`, data).then((r) => r.data.data);

export const deleteAppRelease = (id: string) =>
  api.delete(`/app-releases/${id}`).then((r) => r.data.data);

export const uploadAppReleaseApk = (file: File, onProgress?: (percent: number) => void) => {
  const formData = new FormData();
  formData.append('apk', file);
  return api.post('/app-releases/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  }).then((r) => r.data.data);
};



// Website settings
export const getWebsiteSettings = () =>
  api.get('/website-settings').then((r) => r.data.data);

export const updateWebsiteSettings = (data: Record<string, unknown>) =>
  api.put('/website-settings', data).then((r) => r.data.data);

// Stream Health
export const getStreamHealth = (params?: Record<string, string>) =>
  api.get('/stream-health', { params }).then((r) => r.data.data);

export const markStreamStatus = (channelId: number, action: string, note?: string) =>
  api.post(`/stream-health/${channelId}/mark`, { action, note }).then((r) => r.data.data);

export const recheckStream = (channelId: number) =>
  api.post(`/stream-health/${channelId}/recheck`).then((r) => r.data.data);

// Smooth Playback / Delayed Live Buffer
export const getSmoothPlaybackHealth = () =>
  api.get('/smooth-playback/health').then((r) => r.data.data);

export const getSmoothPlaybackChannels = (params?: Record<string, string>) =>
  api.get('/smooth-playback/channels', { params }).then((r) => r.data.data);

export const updateSmoothPlaybackChannel = (id: number, data: Record<string, unknown>) =>
  api.put(`/smooth-playback/channels/${id}`, data).then((r) => r.data.data);

export const disableAllSmoothPlaybackChannels = () =>
  api.post(`/smooth-playback/channels/disable-all`).then((r) => r.data.data);

export const restartSmoothPlaybackRecorder = (id: number) =>
  api.post(`/smooth-playback/channels/${id}/restart`).then((r) => r.data.data);

export const clearSmoothPlaybackStaleBuffer = (id: number) =>
  api.post(`/smooth-playback/channels/${id}/clear-stale`).then((r) => r.data.data);

export const testSmoothPlaybackSegment = (id: number) =>
  api.post(`/smooth-playback/channels/${id}/test-segment`).then((r) => r.data.data);

export const promoteSmoothPlaybackBackup = (id: number) =>
  api.post(`/smooth-playback/channels/${id}/promote-backup`).then((r) => r.data.data);

export const resetSmoothPlaybackCounters = (id: number) =>
  api.post(`/smooth-playback/channels/${id}/reset-counters`).then((r) => r.data.data);

// User Feedback
export const getFeedback = (params?: Record<string, string>) =>
  api.get('/feedback', { params }).then((r) => r.data.data);

export const updateFeedback = (id: number, data: { status?: string; admin_note?: string }) =>
  api.patch(`/feedback/${id}`, data).then((r) => r.data.data);
