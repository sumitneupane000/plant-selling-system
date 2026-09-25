import api from './axiosInstance.js';

export const getAdminStats    = ()        => api.get('/admin/stats');
export const getAdminUsers    = ()        => api.get('/admin/users');
export const getAdminVendors  = ()        => api.get('/admin/vendors');
export const verifyVendor     = (id, status) => api.patch(`/admin/vendors/${id}/verify`, { status });
export const getAdminProducts  = ()        => api.get('/admin/products');
export const deleteAdminProduct = (id, reason) => api.delete(`/admin/products/${id}`, { data: { reason } });
export const getAdminOrders    = ()        => api.get('/admin/orders');
export const getAdminCategories  = ()     => api.get('/admin/categories');
export const createAdminCategory = (data) => api.post('/admin/categories', data);
export const deleteAdminCategory = (id)  => api.delete(`/admin/categories/${id}`);

export const getAdminCancelledOrders = ()         => api.get('/admin/cancelled-orders');
export const approveCancellation     = (id)       => api.post(`/admin/orders/${id}/approve-cancellation`);
export const rejectCancellation      = (id, note) => api.post(`/admin/orders/${id}/reject-cancellation`, { note });
export const markRefundCompleted     = (id, ref)  => api.post(`/admin/orders/${id}/mark-refund-completed`, { refund_reference: ref });
export const markNotificationRead    = (id)       => api.patch(`/admin/notifications/${id}/read`);


