import prisma from '../config/db.js';
import { sendProductDeletionEmail } from '../utils/email.js';
import logger from '../utils/logger.js';

/**
 * GET /api/v1/admin/stats
 * Platform-wide statistics summary.
 */
export const getStats = async (req, res, next) => {
  try {
    const [userCount, vendorCount, productCount, orderCount, revenue, pendingVendors, cancelledCount, refundPendingCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.vendor.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { total_amount: true } }),
        prisma.vendor.count({ where: { verification_status: 'PENDING' } }),
        prisma.order.count({ where: { OR: [{ status: 'CANCELLED' }, { status: 'CANCELLATION_REQUESTED' }] } }),
        prisma.payment.count({ where: { refund_status: 'REFUND_PENDING' } }),
      ]);

    res.status(200).json({
      success: true,
      message: 'Platform stats retrieved.',
      data: {
        users: userCount,
        vendors: vendorCount,
        products: productCount,
        orders: orderCount,
        revenue: Number(revenue._sum.total_amount || 0),
        pendingVendors,
        cancelledOrders: cancelledCount,
        refundPending: refundPendingCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/cancelled-orders
 * List all cancelled, requested, evidence-requested, admin-review or refunded orders across platform.
 */
export const getCancelledOrders = async (req, res, next) => {
  try {
    const [orders, notifications] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            { status: 'CANCELLED' },
            { status: 'CANCELLATION_REQUESTED' },
            { status: 'EVIDENCE_REQUESTED' },
            { status: 'ADMIN_REVIEW' },
            { cancellation_status: { in: ['REQUESTED', 'VENDOR_REVIEW', 'EVIDENCE_REQUESTED', 'ADMIN_REVIEW', 'APPROVED', 'REJECTED'] } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          order_items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                  vendor: { select: { id: true, store_name: true, user: { select: { name: true, email: true } } } },
                },
              },
            },
          },
          payment: true,
          audit_logs: { orderBy: { created_at: 'desc' } },
        },
        orderBy: { updated_at: 'desc' },
      }),
      prisma.adminNotification.findMany({
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
    ]);

    res.status(200).json({ success: true, data: { orders, notifications } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/notifications/:id/read
 * Mark notification as read
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    });
    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};


/**
 * POST /api/v1/admin/orders/:id/approve-cancellation
 * Admin approves prepaid cancellation request -> marks order CANCELLED, sets refund_status REFUND_PENDING, restores stock.
 */
export const approveCancellation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        order_items: { include: { product: { include: { vendor: { include: { user: true } } } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
        error: { code: 'NOT_FOUND' },
      });
    }

    const refCode = `REF-ADMIN-${Date.now().toString().slice(-6)}`;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellation_status: 'APPROVED',
          cancelled_at: new Date(),
          cancelled_by: 'ADMIN',
        },
        include: {
          payment: true,
          user: { select: { name: true, email: true } },
        },
      });

      // 2. Update payment refund status
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            refund_status: 'REFUNDED',
            refund_processed_at: new Date(),
            refund_amount: order.total_amount,
            refund_reference: refCode,
            refund_processed_by: req.user.id,
          },
        });
      }

      // 3. Restore stock idempotently
      if (order.status !== 'CANCELLED') {
        for (const item of order.order_items) {
          if (item.product_id) {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }

      // 4. Audit Log
      await tx.refundAuditLog.create({
        data: {
          order_id: id,
          actor_id: req.user.id,
          actor_role: 'ADMIN',
          action: 'APPROVED_AND_REFUNDED_BY_ADMIN',
          previous_status: order.status,
          new_status: 'REFUNDED',
          reason_note: `Approved & Refunded by Admin. Ref: ${refCode}`,
        },
      });

      return updated;
    });


    // Send emails asynchronously
    (async () => {
      try {
        const { sendCancellationApprovedEmail, sendVendorCancellationEmail } = await import('../utils/email.js');
        if (order.user?.email) {
          await sendCancellationApprovedEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order: updatedOrder,
          });
        }

        const vendorIds = [...new Set(order.order_items.map((i) => i.product?.vendor_id).filter(Boolean))];
        for (const vId of vendorIds) {
          const vendor = await prisma.vendor.findUnique({
            where: { id: vId },
            include: { user: { select: { email: true, name: true } } },
          });
          if (vendor?.user?.email) {
            await sendVendorCancellationEmail({
              toEmail: vendor.user.email,
              vendorName: vendor.user.name || vendor.store_name,
              order: updatedOrder,
            });
          }
        }
      } catch (err) {
        logger.error(`Failed to send approve cancellation emails: ${err.message}`);
      }
    })();

    res.status(200).json({
      success: true,
      message: 'Cancellation approved. Order marked as CANCELLED and refund marked as REFUND_PENDING.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/orders/:id/reject-cancellation
 * Admin rejects cancellation request -> reverts order status to PROCESSING/PENDING.
 */
export const rejectCancellation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (order.status !== 'CANCELLATION_REQUESTED' && order.cancellation_status !== 'REQUESTED') {
      return res.status(400).json({
        success: false,
        message: `Order is not pending cancellation review.`,
        error: { code: 'INVALID_STATE' },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        cancellation_status: 'REJECTED',
      },
      include: {
        payment: true,
        user: { select: { name: true, email: true } },
      },
    });

    // Send email asynchronously
    (async () => {
      try {
        const { sendCancellationRejectedEmail } = await import('../utils/email.js');
        if (order.user?.email) {
          await sendCancellationRejectedEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order: updatedOrder,
            adminNote: note ? note.trim() : undefined,
          });
        }
      } catch (err) {
        logger.error(`Failed to send cancellation rejected email: ${err.message}`);
      }
    })();

    res.status(200).json({
      success: true,
      message: 'Cancellation request rejected. Order status reverted to PROCESSING.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/orders/:id/mark-refund-completed
 * Admin marks a pending refund as completed with a refund reference ID.
 */
export const markRefundCompleted = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refund_reference } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (!order.payment) {
      return res.status(400).json({
        success: false,
        message: 'Order has no payment record.',
        error: { code: 'NO_PAYMENT' },
      });
    }

    if (order.payment.refund_status !== 'REFUND_PENDING') {
      return res.status(400).json({
        success: false,
        message: `Order refund status is not REFUND_PENDING (current: ${order.payment.refund_status || 'NONE'}).`,
        error: { code: 'INVALID_STATE' },
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        refund_status: 'REFUNDED',
        refund_processed_at: new Date(),
        refund_reference: refund_reference ? refund_reference.trim() : `REF-${Date.now()}`,
        refund_processed_by: req.user.id,
      },
    });

    // Send email asynchronously
    (async () => {
      try {
        const { sendRefundCompletedEmail } = await import('../utils/email.js');
        if (order.user?.email) {
          await sendRefundCompletedEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order,
            refundRef: updatedPayment.refund_reference,
          });
        }
      } catch (err) {
        logger.error(`Failed to send refund completed email: ${err.message}`);
      }
    })();

    res.status(200).json({
      success: true,
      message: 'Refund marked as COMPLETED.',
      data: { payment: updatedPayment },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/v1/admin/users
 * List all users with roles.
 */
export const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/vendors
 * List all vendors with owner info and product counts.
 */
export const getVendors = async (req, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { products: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { vendors } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/vendors/:id/verify
 * Approve or reject a vendor.
 */
export const verifyVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['APPROVED', 'REJECTED', 'PENDING'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be APPROVED, REJECTED, or PENDING.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { verification_status: status },
      include: { user: { select: { name: true, email: true } } },
    });

    res.status(200).json({
      success: true,
      message: `Vendor ${status.toLowerCase()} successfully.`,
      data: { vendor },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Vendor not found.', error: { code: 'NOT_FOUND' } });
    }
    next(error);
  }
};

/**
 * GET /api/v1/admin/products
 * List all products across all vendors.
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        vendor: { select: { store_name: true } },
        category: { select: { name: true } },
        product_images: { select: { image_url: true }, take: 1 },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/orders
 * List all orders platform-wide.
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { name: true, email: true } },
        order_items: {
          include: { product: { select: { name: true } } },
        },
        payment: true,
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/categories
 * List all product categories.
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/categories
 * Create a new product category.
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Category name must be at least 2 characters.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const category = await prisma.category.create({
      data: { name: name.trim(), description: description?.trim() || null },
    });

    res.status(201).json({ success: true, message: 'Category created.', data: { category } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A category with that name already exists.',
        error: { code: 'DUPLICATE_CATEGORY' },
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/categories/:id
 * Delete a category.
 */
export const deleteCategory = async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Category not found.', error: { code: 'NOT_FOUND' } });
    }
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/products/:id
 * Delete a product by Admin with a specified deletion reason, notifying the vendor.
 */
export const deleteProductByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A deletion reason is required to remove a product.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete product images and product
    await prisma.productImage.deleteMany({ where: { product_id: id } });
    await prisma.product.delete({ where: { id } });

    // Send email to vendor asynchronously
    const vendorEmail = product.vendor?.user?.email;
    const vendorName = product.vendor?.user?.name || product.vendor?.store_name;
    if (vendorEmail) {
      (async () => {
        try {
          await sendProductDeletionEmail({
            toEmail: vendorEmail,
            vendorName,
            productName: product.name,
            reason: reason.trim(),
            adminName: req.user.name,
            deletedAt: new Date().toISOString(),
          });
        } catch (emailErr) {
          logger.error(`Failed to send product deletion email: ${emailErr.message}`);
        }
      })();
    }

    res.status(200).json({
      success: true,
      message: `Product "${product.name}" deleted and vendor notified.`,
    });
  } catch (error) {
    next(error);
  }
};

