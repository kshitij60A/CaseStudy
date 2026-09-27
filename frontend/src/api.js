// =========================================
// Industrial ERP - API Service Layer
// All API calls go through this file.
// Base URL points to our Express backend.
// =========================================

const API_BASE = 'http://localhost:5000/api';

// ---- Token helpers ----
export const getToken = () => localStorage.getItem('erp_token');
export const saveToken = (token) => localStorage.setItem('erp_token', token);
export const clearToken = () => localStorage.removeItem('erp_token');

export const getUser = () => {
  const u = localStorage.getItem('erp_user');
  return u ? JSON.parse(u) : null;
};
export const saveUser = (user) => localStorage.setItem('erp_user', JSON.stringify(user));
export const clearUser = () => localStorage.removeItem('erp_user');

// ---- Base fetch wrapper ----
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// ============ AUTH ============
export const authAPI = {
  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => apiFetch('/auth/me'),
};

// ============ DASHBOARD ============
export const dashboardAPI = {
  getStats: () => apiFetch('/dashboard'),
};

// ============ CUSTOMERS ============
export const customerAPI = {
  list: () => apiFetch('/customers'),
  create: (data) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),
};

// ============ PRODUCTS ============
export const productAPI = {
  list: () => apiFetch('/products'),
  create: (data) => apiFetch('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateInventory: (id, physicalQuantity) =>
    apiFetch(`/products/${id}/inventory`, {
      method: 'PUT',
      body: JSON.stringify({ physicalQuantity }),
    }),
};

// ============ ENQUIRIES ============
export const enquiryAPI = {
  list: () => apiFetch('/enquiries'),
  getById: (id) => apiFetch(`/enquiries/${id}`),
  create: (data) => apiFetch('/enquiries', { method: 'POST', body: JSON.stringify(data) }),
};

// ============ QUOTATIONS ============
export const quotationAPI = {
  list: () => apiFetch('/quotations'),
  create: (data) => apiFetch('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    apiFetch(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  convertToOrder: (id) => apiFetch(`/quotations/${id}/convert`, { method: 'POST' }),
};

// ============ SALES ORDERS ============
export const salesOrderAPI = {
  list: () => apiFetch('/sales-orders'),
  getById: (id) => apiFetch(`/sales-orders/${id}`),
  updateStatus: (id, status) =>
    apiFetch(`/sales-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ============ DISPATCHES ============
export const dispatchAPI = {
  list: () => apiFetch('/dispatches'),
  create: (data) => apiFetch('/dispatches', { method: 'POST', body: JSON.stringify(data) }),
};
