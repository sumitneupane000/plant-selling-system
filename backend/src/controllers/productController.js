import prisma from '../config/db.js';
import cloudinary from '../config/cloudinary.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Directory to store uploaded images locally
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const isCloudinaryConfigured = () => {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  return name && name !== 'your_cloud_name';
};

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'plantmarket/products' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * Saves a file buffer locally and returns the full absolute URL so the
 * frontend (running on a different port) can load the image correctly.
 * Falls back to localhost:5000 when SERVER_URL is not set.
 */
const saveFileLocally = (fileBuffer, originalname) => {
  const ext = path.extname(originalname || '.jpg') || '.jpg';
  const filename = `product_${Date.now()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, fileBuffer);
  const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${filename}`;
};

/**
 * Uploads an image — uses Cloudinary if configured, otherwise saves locally.
 */
const uploadImage = async (fileBuffer, originalname) => {
  if (isCloudinaryConfigured()) {
    return await uploadToCloudinary(fileBuffer);
  }
  return saveFileLocally(fileBuffer, originalname);
};

/**
 * GET /api/v1/products/categories
 * Public list of all categories. No auth required.
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/products
 * Public product catalog with search, category filter, and pagination.
 */
export const getProducts = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category_id = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          vendor: { select: { store_name: true } },
          category: { select: { id: true, name: true } },
          product_images: { select: { image_url: true }, take: 1 },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: { products, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/products/vendor/mine
 * Vendor's own product list. Must come before /:id to avoid route conflict.
 */
export const getVendorProducts = async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
        error: { code: 'VENDOR_NOT_FOUND' },
      });
    }

    const products = await prisma.product.findMany({
      where: { vendor_id: vendor.id },
      include: {
        category: { select: { id: true, name: true } },
        product_images: { select: { image_url: true }, take: 1 },
        _count: { select: { order_items: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { products, vendor } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/products/:id
 * Single product with full details.
 */
export const getProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: { select: { store_name: true } },
        category: { select: { id: true, name: true } },
        product_images: true,
        reviews: {
          include: { user: { select: { name: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!product) {
      const err = new Error('Product not found.');
      err.statusCode = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }

    res.status(200).json({ success: true, data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/products
 * Vendor creates a new product listing.
 */
export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category_id, image_url } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({
        success: false,
        message: 'name, price, and category_id are required.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
        error: { code: 'VENDOR_NOT_FOUND' },
      });
    }

    if (vendor.verification_status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account must be APPROVED before listing products.',
        error: { code: 'VENDOR_NOT_APPROVED' },
      });
    }

    let finalImageUrl = null;
    if (req.file) {
      finalImageUrl = await uploadImage(req.file.buffer, req.file.originalname);
    } else if (image_url) {
      finalImageUrl = image_url.trim();
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
        vendor_id: vendor.id,
        category_id,
        ...(finalImageUrl ? { product_images: { create: { image_url: finalImageUrl } } } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        product_images: true,
      },
    });

    res.status(201).json({ success: true, message: 'Product created.', data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/products/:id
 * Vendor updates their own product.
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category_id, image_url } = req.body;

    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      const err = new Error('Product not found.');
      err.statusCode = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }

    if (!vendor || existing.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own products.',
        error: { code: 'FORBIDDEN' },
      });
    }

    let finalImageUrl = null;
    if (req.file) {
      finalImageUrl = await uploadImage(req.file.buffer, req.file.originalname);
    } else if (image_url) {
      finalImageUrl = image_url.trim();
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (category_id) updateData.category_id = category_id;

    if (finalImageUrl) {
      await prisma.productImage.deleteMany({ where: { product_id: req.params.id } });
      await prisma.productImage.create({ data: { product_id: req.params.id, image_url: finalImageUrl } });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        product_images: true,
      },
    });

    res.status(200).json({ success: true, message: 'Product updated.', data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/products/:id
 * Vendor deletes their own product.
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      const err = new Error('Product not found.');
      err.statusCode = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }

    if (!vendor || existing.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own products.',
        error: { code: 'FORBIDDEN' },
      });
    }

    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/products/:id/stock
 * Vendor modifies stock for their product atomically with confirmation validation.
 */
export const adjustProductStock = async (req, res, next) => {
  try {
    const { action, quantity } = req.body;
    const { id } = req.params;

    const qty = parseInt(quantity, 10);
    if (!action || !['ADD', 'REMOVE'].includes(action) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Action must be ADD or REMOVE and quantity must be a positive integer.',
        error: { code: 'INVALID_STOCK_ADJUSTMENT' },
      });
    }

    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
        error: { code: 'VENDOR_NOT_FOUND' },
      });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      });
    }

    // Ownership check (Allow ADMIN or owning VENDOR)
    if (req.user.role !== 'ADMIN' && product.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update stock for your own products.',
        error: { code: 'FORBIDDEN' },
      });
    }

    const previousStock = product.stock;
    const stockChange = action === 'ADD' ? qty : -qty;
    const newStock = previousStock + stockChange;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Current stock is ${previousStock}, cannot remove ${qty}.`,
        error: { code: 'INSUFFICIENT_STOCK' },
      });
    }

    // Atomic transaction update
    const updatedProduct = await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id } });
      const targetStock = p.stock + stockChange;
      if (targetStock < 0) {
        throw new Error(`Insufficient stock. Current stock is ${p.stock}`);
      }
      return await tx.product.update({
        where: { id },
        data: { stock: targetStock },
        include: {
          category: { select: { id: true, name: true } },
          product_images: true,
        },
      });
    });

    res.status(200).json({
      success: true,
      message: `Stock updated successfully. ${product.name} stock changed from ${previousStock} to ${updatedProduct.stock}.`,
      data: {
        product: updatedProduct,
        previousStock,
        newStock: updatedProduct.stock,
        action,
        quantity: qty,
      },
    });
  } catch (error) {
    if (error.message.startsWith('Insufficient stock')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: { code: 'INSUFFICIENT_STOCK' },
      });
    }
    next(error);
  }
};

