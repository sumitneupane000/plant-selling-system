import prisma from '../config/db.js';
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../utils/email.js';
import logger from '../utils/logger.js';

/**
 * POST /api/v1/orders
 * Customer places an order from a list of product items.
 */
export const createOrder = async (req, res, next) => {
  try {
    const { items } = req.body;
    // items: [{ product_id, quantity }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const productIds = items.map((i) => i.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      });
    }

    // Validate stock availability
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}.`,
          error: { code: 'INSUFFICIENT_STOCK' },
        });
      }
    }

    // Build order items and compute total
    let total_amount = 0;
    const orderItemsData = items.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      const price = Number(product.price);
      total_amount += price * item.quantity;
      return { product_id: item.product_id, quantity: item.quantity, price };
    });

    // Create order and decrement stock atomically with stock re-verification
    const order = await prisma.$transaction(async (tx) => {
      // Re-verify latest stock in transaction
      for (const item of items) {
        const dbProduct = await tx.product.findUnique({ where: { id: item.product_id } });
        if (!dbProduct || dbProduct.stock < item.quantity) {
          throw new Error(`Some items are no longer available in the requested quantity. Please review your cart.`);
        }
      }

      const orderData = {
        user_id: req.user.id,
        total_amount,
        order_items: { create: orderItemsData },
      };

      if (req.body.payment_method) {
        const isManualPay = !!req.body.transaction_id;
        orderData.payment = {
          create: {
            payment_method: req.body.payment_method,
            payment_status: isManualPay ? 'COMPLETED' : 'PENDING',
            transaction_id: req.body.transaction_id || `PENDING-${Date.now()}`
          }
        };
      }

      const newOrder = await tx.order.create({
        data: orderData,
        include: {
          order_items: {
            include: { product: { select: { name: true, price: true } } },
          },
          payment: true,
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newOrder;
    });


    // Send order confirmation email asynchronously
    (async () => {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user && user.email) {
          await sendOrderConfirmationEmail({
            toEmail: user.email,
            customerName: user.name,
            order,
          });
        }
      } catch (emailErr) {
        logger.error(`Failed to send order confirmation email: ${emailErr.message}`);
      }
    })();

    res.status(201).json({ success: true, message: 'Order placed successfully.', data: { order } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/orders/mine
 * Customer views their own order history.
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { user_id: req.user.id },
      include: {
        order_items: {
          include: {
            product: {
              select: {
                name: true,
                product_images: { select: { image_url: true }, take: 1 },
              },
            },
          },
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
 * GET /api/v1/orders/vendor
 * Vendor views orders that contain their products.
 */
export const getVendorOrders = async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
        error: { code: 'VENDOR_NOT_FOUND' },
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        order_items: { some: { product: { vendor_id: vendor.id } } },
      },
      include: {
        user: { select: { name: true, email: true } },
        order_items: {
          where: { product: { vendor_id: vendor.id } },
          include: { product: { select: { name: true, price: true } } },
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
 * PUT /api/v1/orders/:id/status
 * Admin or vendor updates an order's status.
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'CANCELLATION_REQUESTED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        user: { select: { name: true, email: true } },
        payment: true,
      },
    });

    // Send order status update email asynchronously
    if (order.user?.email) {
      (async () => {
        try {
          await sendOrderStatusUpdateEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order,
            newStatus: status,
          });
        } catch (emailErr) {
          logger.error(`Failed to send order status update email: ${emailErr.message}`);
        }
      })();
    }

    res.status(200).json({ success: true, message: 'Order status updated.', data: { order } });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Order not found.', error: { code: 'NOT_FOUND' } });
    }
    next(error);
  }
};

/**
 * POST /api/v1/orders/:id/cancel
 * Customer directly cancels a Cash on Delivery order (if status is PENDING or PROCESSING).
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, detail } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A cancellation reason is required.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        order_items: { include: { product: true } },
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

    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this order.',
        error: { code: 'FORBIDDEN' },
      });
    }

    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in its current state (${order.status}).`,
        error: { code: 'INVALID_STATE' },
      });
    }

    if (order.payment?.payment_method !== 'CASH_ON_DELIVERY') {
      return res.status(400).json({
        success: false,
        message: 'Direct cancellation is only available for Cash on Delivery orders. For prepaid orders, please submit a cancellation request.',
        error: { code: 'METHOD_NOT_ALLOWED' },
      });
    }

    // Cancel order and restore stock in transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellation_reason: reason.trim(),
          cancellation_detail: detail ? detail.trim() : null,
          cancelled_at: new Date(),
          cancelled_by: 'CUSTOMER',
          cancellation_status: 'APPROVED',
        },
        include: {
          order_items: { include: { product: true } },
          payment: true,
          user: { select: { name: true, email: true } },
        },
      });

      for (const item of order.order_items) {
        if (item.product_id) {
          await tx.product.update({
            where: { id: item.product_id },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return updated;
    });

    // Asynchronously send emails
    (async () => {
      try {
        const { sendCODCancellationEmail, sendVendorCancellationEmail } = await import('../utils/email.js');
        if (order.user?.email) {
          await sendCODCancellationEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order: updatedOrder,
            reason: reason.trim(),
          });
        }

        // Notify vendor(s)
        const vendorIds = [...new Set(order.order_items.map(i => i.product?.vendor_id).filter(Boolean))];
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
        logger.error(`Error sending cancellation emails: ${err.message}`);
      }
    })();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/orders/:id/request-cancel
 * Customer requests cancellation for a prepaid order (PENDING/PROCESSING status, COMPLETED payment).
 */
export const requestCancellation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, detail } = req.body;
    const files = req.files || [];

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A cancellation reason is required.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (reason.trim() === 'Other' && (!detail || !detail.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Additional Details are required when selecting "Other" as the reason.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const evidenceRequiredReasons = ['Damaged product', 'Wrong product received'];
    if (evidenceRequiredReasons.includes(reason.trim()) && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: `At least one supporting evidence file is required for "${reason.trim()}".`,
        error: { code: 'EVIDENCE_REQUIRED' },
      });
    }

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

    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to request cancellation for this order.',
        error: { code: 'FORBIDDEN' },
      });
    }

    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cancellation cannot be requested for order in status: ${order.status}.`,
        error: { code: 'INVALID_STATE' },
      });
    }

    if (order.cancellation_status === 'REQUESTED' || order.status === 'CANCELLATION_REQUESTED') {
      return res.status(400).json({
        success: false,
        message: 'Cancellation has already been requested for this order.',
        error: { code: 'DUPLICATE_REQUEST' },
      });
    }

    const evidenceUrls = files.map((f) => `/uploads/${f.filename}`);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLATION_REQUESTED',
          cancellation_reason: reason.trim(),
          cancellation_detail: detail ? detail.trim() : null,
          cancellation_evidence: evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : null,
          cancellation_requested_at: new Date(),
          cancellation_status: 'VENDOR_REVIEW',
        },
        include: { payment: true, user: { select: { name: true, email: true } } },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { refund_status: 'VENDOR_REVIEW', refund_requested_at: new Date() },
        });
      }

      await tx.refundAuditLog.create({
        data: {
          order_id: id,
          actor_id: req.user.id,
          actor_role: 'CUSTOMER',
          action: 'REQUESTED_CANCELLATION',
          previous_status: order.status,
          new_status: 'VENDOR_REVIEW',
          reason_note: `${reason.trim()}${detail ? `: ${detail.trim()}` : ''}`,
        },
      });

      return updated;
    });

    // Send emails asynchronously
    (async () => {
      try {
        const { sendCancellationRequestEmail } = await import('../utils/email.js');
        if (order.user?.email) {
          await sendCancellationRequestEmail({
            toEmail: order.user.email,
            customerName: order.user.name,
            order: updatedOrder,
            reason: reason.trim(),
          });
        }
      } catch (err) {
        logger.error(`Error sending cancellation request emails: ${err.message}`);
      }
    })();

    res.status(200).json({
      success: true,
      message: 'Cancellation request submitted successfully and routed to Vendor for review.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/v1/orders/cancelled/vendor
 * Vendor views cancelled orders containing their products.
 */
export const getVendorCancelledOrders = async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
        error: { code: 'VENDOR_NOT_FOUND' },
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        order_items: { some: { product: { vendor_id: vendor.id } } },
        OR: [
          { status: 'CANCELLED' },
          { status: 'CANCELLATION_REQUESTED' },
          { cancellation_status: { in: ['REQUESTED', 'APPROVED', 'REJECTED'] } },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        order_items: {
          where: { product: { vendor_id: vendor.id } },
          include: { product: { select: { name: true, price: true } } },
        },
        payment: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
};

