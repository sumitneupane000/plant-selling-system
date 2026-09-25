import api from './axiosInstance.js';

export const createOrder       = (items, extraPayload = {}) => api.post('/orders', { items, ...extraPayload });
export const getMyOrders       = ()           => api.get('/orders/mine');
export const getVendorOrders   = ()           => api.get('/orders/vendor');
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status });
export const cancelOrder             = (id, data) => api.post(`/orders/${id}/cancel`, data);
export const requestCancellation      = (id, formData) => api.post(`/orders/${id}/request-cancel`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getVendorCancelledOrders = ()         => api.get('/orders/cancelled/vendor');

// Decentralized Vendor Refund APIs
export const getVendorRefundRequests = () => api.get('/vendor/refunds');
export const vendorRequestEvidence    = (orderId, message) => api.post(`/vendor/refunds/${orderId}/request-evidence`, { message });
export const vendorRejectRefund      = (orderId, reason) => api.post(`/vendor/refunds/${orderId}/reject`, { reason });
export const vendorApproveRefund     = (orderId) => api.post(`/vendor/refunds/${orderId}/approve`);

// Customer Evidence & Appeal APIs
export const uploadCustomerEvidence  = (orderId, formData) => api.post(`/orders/${orderId}/upload-evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const appealToAdmin           = (orderId, explanation) => api.post(`/orders/${orderId}/appeal`, { explanation });


