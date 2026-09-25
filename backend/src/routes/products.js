import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getCategories,
  getProducts,
  getVendorProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
} from '../controllers/productController.js';

import upload from '../middleware/uploadMiddleware.js';

const router = Router();

// Public routes
router.get('/categories', getCategories);
router.get('/', getProducts);

// Vendor-only: must come before /:id to avoid route shadowing
router.get('/vendor/mine', protect, authorize('VENDOR'), getVendorProducts);

// Public single product
router.get('/:id', getProduct);

// Vendor-only mutations
router.post('/', protect, authorize('VENDOR'), upload.single('image'), createProduct);
router.put('/:id', protect, authorize('VENDOR'), upload.single('image'), updateProduct);
router.patch('/:id/stock', protect, authorize('VENDOR', 'ADMIN'), adjustProductStock);
router.delete('/:id', protect, authorize('VENDOR'), deleteProduct);

export default router;

