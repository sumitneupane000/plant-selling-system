import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createOrder,
  getMyOrders,
  getVendorOrders,
  updateOrderStatus,
  cancelOrder,
  requestCancellation,
  getVendorCancelledOrders,
} from '../controllers/orderController.js';
import { uploadCustomerEvidence, appealToAdmin } from '../controllers/vendorRefundController.js';
import { uploadEvidenceMiddleware } from '../middleware/evidenceMiddleware.js';

const router = Router();

// Customer/Any role: place an order
router.post('/', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), createOrder);

// Customer/Any role: own order history
router.get('/mine', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), getMyOrders);

// Vendor: orders containing their products
router.get('/vendor', protect, authorize('VENDOR'), getVendorOrders);

// Vendor: cancelled orders containing their products
router.get('/cancelled/vendor', protect, authorize('VENDOR'), getVendorCancelledOrders);

// Customer: direct cancellation for COD orders
router.post('/:id/cancel', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), cancelOrder);

// Customer: request cancellation for prepaid orders with evidence upload
router.post('/:id/request-cancel', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), uploadEvidenceMiddleware, requestCancellation);

// Customer: upload additional requested evidence
router.post('/:id/upload-evidence', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), uploadEvidenceMiddleware, uploadCustomerEvidence);

// Customer: appeal vendor rejection to Admin
router.post('/:id/appeal', protect, authorize('CUSTOMER', 'VENDOR', 'ADMIN'), appealToAdmin);

// Admin or Vendor: update order status
router.put('/:id/status', protect, authorize('ADMIN', 'VENDOR'), updateOrderStatus);

export default router;


