import axios from 'axios';
import { showToast } from '../components/common/toastService';

const LOCAL_API_BASE_URL = 'http://localhost:5000';
const ENV_API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  ''
).trim();
const ENV_API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/api';

const isBrowserLocalhost = () => (
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
);

const isLocalApiUrl = (url) => /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(url);

const getApiBaseUrl = () => {
  if (ENV_API_BASE_URL) {
    if (import.meta.env.PROD && isLocalApiUrl(ENV_API_BASE_URL)) {
      throw new Error(
        'Production frontend is configured with a localhost API URL. Set VITE_API_BASE_URL to the deployed backend URL in Netlify.'
      );
    }
    return ENV_API_BASE_URL;
  }

  if (import.meta.env.DEV || isBrowserLocalhost()) {
    return LOCAL_API_BASE_URL;
  }

  throw new Error(
    'Missing production API URL. Set VITE_API_BASE_URL or VITE_API_URL to the deployed backend URL.'
  );
};

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

const BASE_URL = normalizeUrl(getApiBaseUrl(), ENV_API_BASE_PATH);

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const customerActionPrefixes = [
  '/accounts',
  '/account-type-requests',
  '/beneficiaries',
  '/transactions',
  '/transfer-limits',
  '/overdrafts',
  '/loans',
  '/loan-applications',
  '/investments',
  '/notifications',
  '/users/profile',
  '/users/kyc',
  '/users/change-password',
];

const shouldToastCustomerAction = (config = {}) => {
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '');
  return method !== 'get' && customerActionPrefixes.some((prefix) => url.startsWith(prefix));
};

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
  (response) => {
    if (shouldToastCustomerAction(response.config) && response.data?.message) {
      showToast(response.data.message, 'success');
    }
    return response;
  },
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
    if (shouldToastCustomerAction(error.config)) {
      showToast(error.response?.data?.message || error.message || 'Action failed. Please try again.', 'error', { persist: true });
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
  submitKyc: (data) => api.post('/users/kyc/submit', data, { timeout: 60000 }),
  getMyKycDocument: (documentId, download = false) =>
    api.get(`/users/kyc/documents/${documentId}`, {
      params: download ? { download: true } : undefined,
      responseType: 'blob',
    }),
  getKycRequests: (params) => api.get('/users/kyc/requests', { params }),
  reviewKyc: (id, data) => api.put(`/users/kyc/${id}/review`, data),
  getProfileChangeRequests: (params) => api.get('/users/profile-change-requests', { params }),
  reviewProfileChangeRequest: (id, data) => api.put(`/users/profile-change-requests/${id}/review`, data),
  getKycDocument: (customerId, documentId, download = false) =>
    api.get(`/users/kyc/${customerId}/documents/${documentId}`, {
      params: download ? { download: true } : undefined,
      responseType: 'blob',
    }),
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

export const customerDashboardAPI = {
  getMain: () => api.get('/customer/dashboard'),
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
  getCustomerYears: () => api.get('/manager/customers/years'),
  downloadCustomerMonthlyReport: (params) => api.get('/manager/customers/monthly-report', { params, responseType: 'blob' }),
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

// ─── Loan API ───────────────────────────────────────────────────────────────
export const loanAPI = {
  // Customer endpoints
  apply: (data) => api.post('/loans/apply', data),
  getMyLoans: (params) => api.get('/loans/my-loans', { params }),
  getDetails: (id) => api.get(`/loans/${id}`),
  getEMIHistory: (id) => api.get(`/loans/${id}/emi-history`),
  payEMI: (id, emiId, accountId) => api.post(`/loans/${id}/emis/${emiId}/pay`, { accountId }),
  makePartPayment: (id, data) => api.post(`/loans/${id}/part-payment`, data),
  getFullRepaymentQuote: (id) => api.get(`/loans/${id}/full-repayment-quote`),
  foreclose: (id, data) => api.post(`/loans/${id}/foreclose`, data),
  closeFullLoan: (id, data) => api.post(`/loans/${id}/full-repayment`, data),
  respondInfo: (id, data) => api.post(`/loans/${id}/respond-info`, data),
  calculateEMI: (data) => api.post('/loans/calculate-emi', data),

  // Manager endpoints
  getManagerRequests: (params) => api.get('/loans/manager/requests', { params }),
  reviewLoan: (id, data) => api.put(`/loans/manager/${id}/review`, data),
  approveLoan: (id, data) => api.put(`/loans/manager/${id}/approve`, data),
  rejectLoan: (id, data) => api.put(`/loans/manager/${id}/reject`, data),
  requestInfo: (id, data) => api.put(`/loans/manager/${id}/request-info`, data),
  getMonitoringStats: () => api.get('/loans/manager/monitoring'),

  // Admin endpoints
  getAdminAnalytics: () => api.get('/loans/admin/analytics'),
  getAdminCharts: () => api.get('/loans/admin/charts'),
  getAdminLoanOverview: () => api.get('/loans/admin/overview'),
  getConfigs: () => api.get('/loans/admin/configs'),
  createConfig: (data) => api.post('/loans/admin/configs', data),
  updateConfig: (data) => (data?._id ? api.put(`/loans/admin/configs/${data._id}`, data) : api.put('/loans/admin/configs', data)),
  deleteConfig: (id) => api.delete(`/loans/admin/configs/${id}`),
  getAdminCustomerLoans: (params) => api.get('/admin/loans/customer-loans', { params }),
  downloadAdminCustomerLoansReport: (params) => api.get('/admin/loans/customer-loans/report', { params, responseType: 'blob' }),
  downloadAdminCustomerLoansMonthlyReport: (month) => api.get('/admin/loans/customer-loans/monthly-report', { params: { month }, responseType: 'blob' }),
  getAdminEMIRecords: (params) => api.get('/admin/loans/emis', { params }),
  downloadAdminEMIReport: (params) => api.get('/loans/admin/emis/report', { params, responseType: 'blob' }),
  downloadAdminEMIMonthlyReport: (month) => api.get('/admin/loans/emis/monthly-report', { params: { month }, responseType: 'blob' }),
  getDelinquentReport: () => api.get('/loans/admin/delinquent'),
};

export const loanApplicationAPI = {
  getBootstrap: () => api.get('/loan-applications/bootstrap'),
  saveDraft: (data) => api.put('/loan-applications/draft', data),
  submit: (data) => api.post('/loan-applications', data, { timeout: 60000 }),
  getMine: () => api.get('/loan-applications/mine'),
  getManagerApplications: (params) => api.get('/loan-applications/manager', { params }),
  getDetails: (id) => api.get(`/loan-applications/${id}`),
  getDocument: (applicationId, documentId, download = false) =>
    api.get(`/loan-applications/${applicationId}/documents/${documentId}`, {
      params: download ? { download: true } : undefined,
      responseType: 'blob',
    }),
  updateStatus: (id, data) => api.put(`/loan-applications/${id}/status`, data),
};

export const investmentAPI = {
  getBootstrap: () => api.get('/investments/bootstrap'),
  calculateFD: (data) => api.post('/investments/fd/calculate', data),
  calculateRD: (data) => api.post('/investments/rd/calculate', data),
  createFD: (data) => api.post('/investments/customer/fds', data),
  getMyFDs: () => api.get('/investments/customer/fds'),
  getFDWithdrawalPreview: (id) => api.get(`/investments/customer/fds/${id}/withdrawal-preview`),
  requestFDWithdrawal: (id, data) => api.post(`/investments/customer/fds/${id}/withdrawal`, data),
  updateFDRenewal: (id, data) => api.put(`/investments/customer/fds/${id}/renewal`, data),
  requestFDRenewal: (id) => api.post(`/investments/customer/fds/${id}/renewal-request`),
  createRD: (data) => api.post('/investments/customer/rds', data),
  getMyRDs: () => api.get('/investments/customer/rds'),
  getRDClosurePreview: (id) => api.get(`/investments/customer/rds/${id}/closure-preview`),
  requestRDClosure: (id, data) => api.post(`/investments/customer/rds/${id}/closure`, data),
  requestRDRenewal: (id) => api.post(`/investments/customer/rds/${id}/renewal-request`),
  getRDInstallments: (id) => api.get(`/investments/customer/rds/${id}/installments`),
  getManagerQueue: () => api.get('/investments/manager/queue'),
  getManagerMonitoring: () => api.get('/investments/manager/monitoring'),
  decideFD: (id, data) => api.put(`/investments/manager/fds/${id}/decision`, data),
  decideFDWithdrawal: (id, data) => api.put(`/investments/manager/fds/${id}/withdrawal-decision`, data),
  decideFDRenewal: (id, data) => api.put(`/investments/manager/fds/${id}/renewal-decision`, data),
  decideRD: (id, data) => api.put(`/investments/manager/rds/${id}/decision`, data),
  decideRDClosure: (id, data) => api.put(`/investments/manager/rds/${id}/closure-decision`, data),
  decideRDRenewal: (id, data) => api.put(`/investments/manager/rds/${id}/renewal-decision`, data),
  getAdminOverview: () => api.get('/investments/admin/overview'),
  getAdminClassifications: () => api.get('/investments/admin/classifications'),
  getAdminRule: (type) => api.get(`/investments/admin/rules/${type}`),
  saveRule: (data) => api.put('/investments/admin/rules', data),
  getAdminFDAccounts: (params) => api.get('/investments/admin/fd/accounts', { params }),
  getAdminRDAccounts: (params) => api.get('/investments/admin/rd/accounts', { params }),
  downloadMonthlyReport: (product, reportType, params) => api.get(`/investments/admin/${product}/reports/${reportType}`, { params, responseType: 'blob' }),
  downloadReport: (type) => api.get(`/investments/admin/reports/${type}`, { responseType: 'blob' }),
};

export default api;
