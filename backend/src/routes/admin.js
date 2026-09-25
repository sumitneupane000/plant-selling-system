import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getStats,
  getUsers,
  getVendors,
  verifyVendor,
  getAllProducts,
  deleteProductByAdmin,
  getAllOrders,
  getCategories,
  createCategory,
  deleteCategory,
  getCancelledOrders,
  approveCancellation,
  rejectCancellation,
  markRefundCompleted,
  markNotificationRead,
} from '../controllers/adminController.js';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(protect, authorize('ADMIN'));

router.get('/stats',           getStats);
router.get('/users',           getUsers);
router.get('/vendors',         getVendors);
router.patch('/vendors/:id/verify', verifyVendor);
router.get('/products',        getAllProducts);
router.delete('/products/:id', deleteProductByAdmin);
router.get('/orders',          getAllOrders);
router.get('/categories',      getCategories);
router.post('/categories',     createCategory);
router.delete('/categories/:id', deleteCategory);

// Cancellation & Refund Management
router.get('/cancelled-orders',                     getCancelledOrders);
router.post('/orders/:id/approve-cancellation',     approveCancellation);
router.post('/orders/:id/reject-cancellation',      rejectCancellation);
router.post('/orders/:id/mark-refund-completed',    markRefundCompleted);
router.patch('/notifications/:id/read',             markNotificationRead);

export default router;


