import api from './axiosInstance.js';

export const getPublicCategories = ()      => api.get('/products/categories');
export const getProducts      = (params) => api.get('/products', { params });
export const getProduct       = (id)     => api.get(`/products/${id}`);
export const getVendorProducts = ()      => api.get('/products/vendor/mine');
export const createProduct    = (data)   => api.post('/products', data);
export const updateProduct    = (id, data) => api.put(`/products/${id}`, data);
export const adjustProductStock = (id, data) => api.patch(`/products/${id}/stock`, data);
export const deleteProduct    = (id)     => api.delete(`/products/${id}`);

