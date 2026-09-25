import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getVendorRefundRequests,
  requestMoreEvidence,
  rejectRefundRequest,
  approveRefundByVendor,
} from '../controllers/vendorRefundController.js';

const router = Router();

router.use(protect, authorize('VENDOR'));

router.get('/refunds', getVendorRefundRequests);
router.post('/refunds/:orderId/request-evidence', requestMoreEvidence);
router.post('/refunds/:orderId/reject', rejectRefundRequest);
router.post('/refunds/:orderId/approve', approveRefundByVendor);

export default router;
