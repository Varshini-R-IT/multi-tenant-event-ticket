// In production (Vercel), VITE_API_URL = 'https://multi-tenant-event-ticket-api.onrender.com'
// In local dev, Vite proxy forwards '/api' → 'http://localhost:5000'
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

/**
 * Enhanced fetch wrapper with auth token and error normalization
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const activeUserId = localStorage.getItem('activeUserId');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeUserId) {
    headers['x-user-id'] = activeUserId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const cacheHeader = response.headers.get('X-Cache');

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = new Error(data && data.error ? data.error : `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return { data, cacheHeader, status: response.status };
}

export const api = {
  // Auth & Roles
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => apiRequest('/auth/me'),
  getDemoAccounts: () => apiRequest('/auth/demo-accounts'),

  // Events & Tiers
  getEvents: () => apiRequest('/events'),
  getEventById: (id) => apiRequest(`/events/${id}`),
  createEvent: (eventData) => apiRequest('/events', { method: 'POST', body: JSON.stringify(eventData) }),
  updateEvent: (id, eventData) => apiRequest(`/events/${id}`, { method: 'PUT', body: JSON.stringify(eventData) }),
  getOrganizerEvents: (tenantId) => apiRequest(`/events/manage/my-events${tenantId ? `?tenantId=${tenantId}` : ''}`),

  // Reservation & 10-Minute Hold Engine
  createHold: (tierId, quantity = 1) =>
    apiRequest('/reservations/hold', { method: 'POST', body: JSON.stringify({ tierId, quantity }) }),
  getHold: (id) => apiRequest(`/reservations/${id}`),
  releaseHold: (id) => apiRequest(`/reservations/${id}/release`, { method: 'DELETE' }),

  // Mock Payment Gateway Checkout
  processPayment: (payload) => apiRequest('/payments/charge', { method: 'POST', body: JSON.stringify(payload) }),

  // Orders & Digital Tickets
  getMyOrders: () => apiRequest('/orders/my-orders'),
  getMyTickets: () => apiRequest('/orders/my-tickets'),
  getOrderById: (id) => apiRequest(`/orders/${id}`),
  verifyTicket: (id) => apiRequest(`/orders/tickets/${id}/verify`),

  // Multi-Tenant Analytics
  getAnalytics: (tenantId, eventId) => {
    const query = new URLSearchParams();
    if (tenantId) query.set('tenantId', tenantId);
    if (eventId) query.set('eventId', eventId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/analytics/dashboard${queryString}`);
  },

  // Background Worker
  triggerCleanup: () => apiRequest('/worker/cleanup-holds', { method: 'POST' }),
  getHealth: () => apiRequest('/health')
};
