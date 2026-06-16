import axios from 'axios';

const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ENV_API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/api';

const normalizeUrl = (baseUrl, basePath) => {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  let normalizedPath = (basePath || '').trim();
  if (normalizedPath && !normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  if (normalizedBase.endsWith('/api') && normalizedPath === '/api') {
    return normalizedBase;
  }

  if (normalizedPath === '' || normalizedPath === '/') {
    return normalizedBase;
  }

  return `${normalizedBase}${normalizedPath}`;
};

const BASE_URL = normalizeUrl(ENV_API_BASE_URL, ENV_API_BASE_PATH);

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Request Interceptor: Attach JWT Token ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('paynest_token') || sessionStorage.getItem('paynest_temp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Handle 401 globally ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isPublicAuth =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password');

      if (!isPublicAuth) {
        localStorage.removeItem('paynest_token');
        localStorage.removeItem('paynest_user');
        sessionStorage.removeItem('paynest_temp_token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  validateToken: (token) => api.get(`/auth/validate-token/${token}`),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
  activateAccount: (data) => api.post('/auth/activate-account', data, { timeout: 30000 }),
  getMe: () => api.get('/auth/me'),
};

// ─── User API ─────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/change-password', data),
};

// ─── Account API ──────────────────────────────────────────────────────────────
export const accountAPI = {
  getAll: () => api.get('/accounts'),
  getById: (id) => api.get(`/accounts/${id}`),
  create: (data) => api.post('/accounts', data),
  getBeneficiaries: () => api.get('/beneficiaries'),
  getBeneficiaryById: (id) => api.get(`/beneficiaries/${id}`),
  lookupAccountNumber: (accountNumber) => api.get(`/beneficiaries/lookup/${encodeURIComponent(accountNumber)}`),
  lookupBeneficiaryNickname: (nickname) => api.get(`/beneficiaries/lookup-nickname/${encodeURIComponent(nickname)}`),
  addBeneficiary: (data) => api.post('/beneficiaries', data),
  updateBeneficiary: (id, data) => api.put(`/beneficiaries/${id}`, data),
  deleteBeneficiary: (id) => api.delete(`/beneficiaries/${id}`),
};

export const accountTypeRequestAPI = {
  submitRequest: (data) => api.post('/account-type-requests/request', data),
  getMyRequests: () => api.get('/account-type-requests/my-requests'),
  getPendingRequests: (params) => api.get('/account-type-requests/pending', { params }),
  approveRequest: (id, data) => api.put(`/account-type-requests/${id}/approve`, data),
  rejectRequest: (id, data) => api.put(`/account-type-requests/${id}/reject`, data),
};

// ─── Beneficiary API (standalone for backward compat) ─────────────────────────
export const beneficiaryAPI = {
  getAll: () => api.get('/beneficiaries'),
  getById: (id) => api.get(`/beneficiaries/${id}`),
  add: (data) => api.post('/beneficiaries', data),
  update: (id, data) => api.put(`/beneficiaries/${id}`, data),
  delete: (id) => api.delete(`/beneficiaries/${id}`),
};

// ─── Transaction API ──────────────────────────────────────────────────────────
export const transactionAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  exportMonthly: (params) => api.get('/transactions/export', { params, responseType: 'blob' }),
  getAdminAll: (params) => api.get('/transactions/admin', { params }),
  getAnalytics: () => api.get('/transactions/analytics'),
  transfer: (data) => api.post('/transactions/transfer', data),
  transferToBeneficiary: (data) => api.post('/transactions/transfer-to-beneficiary', data),
  transferByCustomerId: (data) => api.post('/transactions/transfer-by-customerid', data),
  selfTransfer: (data) => api.post('/transactions/self-transfer', data),
};


// ─── Transfer API (alias for backward compat with FundTransfer.jsx) ───────────
export const transferAPI = {
  ownAccount: (data) => api.post('/transactions/transfer', data),
  toBeneficiary: (data) => api.post('/transactions/transfer-to-beneficiary', data),
};

// ─── Notification API ─────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// ─── Admin User API ───────────────────────────────────────────────────────────
export const adminUserAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  updateUserStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
  // Signup approval workflow
  getPendingRegistrations: (params) => api.get('/admin/users/pending-registrations', { params }),
  approveRegistration: (id) => api.post(`/admin/users/${id}/approve-registration`),
  rejectRegistration: (id, data) => api.post(`/admin/users/${id}/reject-registration`, data),
};

// ─── Admin API ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getStats: (params) => api.get('/admin/stats', { params }),
  getDashboardStats: (params) => api.get('/admin/stats', { params }),
  getAnalytics: () => api.get('/admin/analytics'),
  getTransactions: (params) => api.get('/admin/transactions', { params }),
  sendNotification: (data) => api.post('/admin/notifications/send', data),
  getAccounts: (params) => api.get('/admin/accounts', { params }),
  // Overdraft management
  getOverdraftSummary: (params) => api.get('/admin/overdrafts/summary', { params }),
  getOverdraftMonthlyUsage: (params) => api.get('/admin/overdrafts/monthly-usage', { params }),
  getOverdraftAccounts: (params) => api.get('/admin/overdrafts/accounts', { params }),
  getCustomers: (params) => api.get('/admin/customers', { params }),
  // Business Rules
  getBusinessRules: () => api.get('/admin/business-rules'),
  createBusinessRule: (data) => api.post('/admin/business-rules', data),
  updateBusinessRule: (id, data) => api.put(`/admin/business-rules/${id}`, data),
  deleteBusinessRule: (id) => api.delete(`/admin/business-rules/${id}`),
  // Audit Logs
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
};

// ─── Classification API ───────────────────────────────────────────────────────
export const classificationAPI = {
  getRequests: (params) => api.get('/classification-requests', { params }),
  approveRequest: (id, data) => api.patch(`/classification-requests/${id}/approve`, data),
  rejectRequest: (id, data) => api.patch(`/classification-requests/${id}/reject`, data),
  getDefinitions: () => api.get('/classifications'),
  createDefinition: (data) => api.post('/classifications', data),
  updateDefinition: (id, data) => api.put(`/classifications/${id}`, data),
  deleteDefinition: (id) => api.delete(`/classifications/${id}`),
  getCustomers: (params) => api.get('/classification-requests/customers', { params }),
  updateCustomerClassification: (id, data) =>
    api.put(`/classifications/customers/${id}/classification`, data).catch((err) => {
      const isMissingNewRoute =
        err.response?.status === 404 &&
        typeof err.response?.data?.message === 'string' &&
        err.response.data.message.includes('Route PUT /api/classifications/customers/');

      if (isMissingNewRoute) {
        return api.put(`/classification-requests/customers/${id}/classification`, data);
      }

      throw err;
    }),
};

// Overdraft (customer)
export const overdraftAPI = {
  getMyDetails:              (params)    => api.get('/overdrafts/my-details', { params }),
  getMyHistory:              (params)    => api.get('/overdrafts/my-history', { params }),
  getMyChart:                ()          => api.get('/overdrafts/my-chart'),
  resolveReceiver:           (params)    => api.get('/overdrafts/receiver', { params }),
  repay:                     (data)      => api.post('/overdrafts/repay', data),
  use:                       (data)      => api.post('/overdrafts/use', data),
};

// ─── Manager API ──────────────────────────────────────────────────────────────
export const managerAPI = {
  getDashboard: () => api.get('/manager/dashboard'),
  // Overdraft
  getOverdraftAccounts:        (params)       => api.get('/manager/overdrafts/accounts', { params }),
  // Customers
  getCustomers: (params) => api.get('/manager/customers', { params }),
  getMessageCustomers: (params) =>
    api.get('/manager/message-customers', { params }).catch((err) => {
      const isMissingRoute =
        err.response?.status === 404 &&
        typeof err.response?.data?.message === 'string' &&
        err.response.data.message.includes('Route GET /api/manager/message-customers');

      if (isMissingRoute) {
        return api.get('/manager/customers', { params });
      }

      throw err;
    }),
  sendCustomerMessage: (data) => api.post('/manager/notifications/send-message', data),
  // Transactions
  getTransactions: (params) => api.get('/transactions/manager', { params }),
};

// ─── Transfer Limit API ──────────────────────────────────────────────────────
export const transferLimitAPI = {
  submitRequest: (data) => api.post('/transfer-limits/request', data),
  getMyRequests: () => api.get('/transfer-limits/my-requests'),
  getPendingRequests: () => api.get('/transfer-limits/pending'),
  approveRequest: (id, data) => api.put(`/transfer-limits/${id}/approve`, data),
  rejectRequest: (id, data) => api.put(`/transfer-limits/${id}/reject`, data),
};

export default api;
