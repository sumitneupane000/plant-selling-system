import prisma from '../config/db.js';
import logger from '../utils/logger.js';

const VENDOR_REFUND_LIMIT = Number(process.env.VENDOR_MAX_REFUND_LIMIT || 5000);

/**
 * Vendor retrieves refund requests for orders containing their products.
 * GET /api/v1/vendor/refunds
 */
export const getVendorRefundRequests = async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    const orders = await prisma.order.findMany({
      where: {
        order_items: { some: { product: { vendor_id: vendor.id } } },
        OR: [
          { status: 'CANCELLATION_REQUESTED' },
          { status: 'EVIDENCE_REQUESTED' },
          { status: 'ADMIN_REVIEW' },
          { status: 'CANCELLED' },
          { cancellation_status: { in: ['REQUESTED', 'VENDOR_REVIEW', 'EVIDENCE_REQUESTED', 'ADMIN_REVIEW', 'APPROVED', 'REJECTED'] } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        order_items: {
          where: { product: { vendor_id: vendor.id } },
          include: { product: { select: { id: true, name: true, price: true, product_images: true } } },
        },
        payment: true,
        audit_logs: { orderBy: { created_at: 'desc' } },
      },
      orderBy: { updated_at: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { orders, vendorRefundLimit: VENDOR_REFUND_LIMIT },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor requests more evidence from customer.
 * POST /api/v1/vendor/refunds/:orderId/request-evidence
 */
export const requestMoreEvidence = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message explaining required evidence is mandatory.' });
    }

    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        order_items: { some: { product: { vendor_id: vendor.id } } },
      },
      include: { payment: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'EVIDENCE_REQUESTED',
          cancellation_status: 'EVIDENCE_REQUESTED',
          vendor_note: message.trim(),
        },
        include: { payment: true, user: { select: { name: true, email: true } } },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { refund_status: 'EVIDENCE_REQUESTED' },
        });
      }

      await tx.refundAuditLog.create({
        data: {
          order_id: orderId,
          actor_id: req.user.id,
          actor_role: 'VENDOR',
          action: 'REQUESTED_MORE_EVIDENCE',
          previous_status: order.status,
          new_status: 'EVIDENCE_REQUESTED',
          reason_note: message.trim(),
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Evidence request sent to customer.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor rejects cancellation/refund request.
 * POST /api/v1/vendor/refunds/:orderId/reject
 */
export const rejectRefundRequest = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        order_items: { some: { product: { vendor_id: vendor.id } } },
      },
      include: { payment: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING', // Revert order back to active processing
          cancellation_status: 'REJECTED',
          vendor_note: reason.trim(),
        },
        include: { payment: true, user: { select: { name: true, email: true } } },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { refund_status: 'REJECTED' },
        });
      }

      await tx.refundAuditLog.create({
        data: {
          order_id: orderId,
          actor_id: req.user.id,
          actor_role: 'VENDOR',
          action: 'REJECTED_REFUND',
          previous_status: order.status,
          new_status: 'REJECTED',
          reason_note: reason.trim(),
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Refund request rejected.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor approves refund.
 * POST /api/v1/vendor/refunds/:orderId/approve
 */
export const approveRefundByVendor = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { user_id: req.user.id },
      include: { user: { select: { name: true } } },
    });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        order_items: { some: { product: { vendor_id: vendor.id } } },
      },
      include: {
        payment: true,
        order_items: { include: { product: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    if (order.status === 'CANCELLED' && order.payment?.refund_status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'This order has already been cancelled and refunded.' });
    }

    const refundAmount = Number(order.total_amount);

    // Rule check: High-value refund threshold (> VENDOR_REFUND_LIMIT) -> Route to Admin Review
    if (refundAmount > VENDOR_REFUND_LIMIT) {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'ADMIN_REVIEW',
            cancellation_status: 'ADMIN_REVIEW',
            vendor_note: `Approved by Vendor (${vendor.store_name}). Escalated to Admin because total amount (NPR ${refundAmount}) exceeds vendor direct limit (NPR ${VENDOR_REFUND_LIMIT}).`,
          },
          include: { payment: true },
        });

        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { refund_status: 'ADMIN_REVIEW' },
          });
        }

        await tx.refundAuditLog.create({
          data: {
            order_id: orderId,
            actor_id: req.user.id,
            actor_role: 'VENDOR',
            action: 'ESCALATED_HIGH_VALUE_REFUND',
            previous_status: order.status,
            new_status: 'ADMIN_REVIEW',
            reason_note: `Amount रू ${refundAmount} > limit रू ${VENDOR_REFUND_LIMIT}`,
          },
        });

        await tx.adminNotification.create({
          data: {
            type: 'HIGH_VALUE_REFUND_REQUIRED',
            title: '⚠️ High-Value Refund Requires Admin Approval',
            message: `Vendor ${vendor.store_name} approved order #${orderId.slice(0, 8).toUpperCase()} for रू ${refundAmount}, which exceeds vendor limit (रू ${VENDOR_REFUND_LIMIT}).`,
            order_id: orderId,
            vendor_id: vendor.id,
          },
        });

        return updated;
      });

      return res.status(200).json({
        success: true,
        message: `Refund amount (NPR ${refundAmount}) exceeds direct limit (NPR ${VENDOR_REFUND_LIMIT}). Request escalated to Admin for review.`,
        data: { order: updatedOrder, routedToAdmin: true },
      });
    }

    // Normal direct refund <= VENDOR_REFUND_LIMIT
    const refCode = `REF-${order.payment?.payment_method || 'PAY'}-${Date.now().toString().slice(-6)}`;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancellation_status: 'APPROVED',
          cancelled_at: new Date(),
          cancelled_by: 'VENDOR',
        },
        include: { payment: true, user: { select: { name: true, email: true } } },
      });

      // 2. Update payment status safely & atomically
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

      // 3. Increment stock exactly once (idempotently check)
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
          order_id: orderId,
          actor_id: req.user.id,
          actor_role: 'VENDOR',
          action: 'APPROVED_AND_REFUNDED',
          previous_status: order.status,
          new_status: 'REFUNDED',
          reason_note: `Approved by Vendor (${vendor.store_name}). Ref: ${refCode}`,
        },
      });

      // 5. Admin Notification
      await tx.adminNotification.create({
        data: {
          type: 'VENDOR_REFUND_PROCESSED',
          title: '🔔 Vendor Refund Processed',
          message: `Vendor ${vendor.store_name} approved and refunded order #${orderId.slice(0, 8).toUpperCase()} (रू ${refundAmount}) for customer ${order.user?.name || 'Customer'}.`,
          order_id: orderId,
          vendor_id: vendor.id,
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Refund approved and completed successfully.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer uploads requested additional evidence.
 * POST /api/v1/orders/:id/upload-evidence
 */
export const uploadCustomerEvidence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const files = req.files || [];

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });

    const newEvUrls = files.map((f) => `/uploads/${f.filename}`);

    let existingEv = [];
    try {
      if (order.cancellation_evidence) {
        existingEv = JSON.parse(order.cancellation_evidence);
      }
    } catch { existingEv = []; }

    const combinedEv = [...existingEv, ...newEvUrls];

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          cancellation_evidence: JSON.stringify(combinedEv),
          status: 'CANCELLATION_REQUESTED',
          cancellation_status: 'VENDOR_REVIEW',
        },
        include: { payment: true },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { refund_status: 'VENDOR_REVIEW' },
        });
      }

      await tx.refundAuditLog.create({
        data: {
          order_id: id,
          actor_id: req.user.id,
          actor_role: 'CUSTOMER',
          action: 'UPLOADED_ADDITIONAL_EVIDENCE',
          previous_status: order.status,
          new_status: 'VENDOR_REVIEW',
          reason_note: `Uploaded ${files.length} evidence file(s)`,
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Evidence uploaded successfully and submitted for Vendor review.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer appeals vendor rejection to Admin.
 * POST /api/v1/orders/:id/appeal
 */
export const appealToAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { explanation } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'ADMIN_REVIEW',
          cancellation_status: 'ADMIN_REVIEW',
          is_appealed: true,
          appealed_at: new Date(),
          cancellation_detail: explanation ? `${order.cancellation_detail || ''}\n[APPEAL]: ${explanation.trim()}`.trim() : order.cancellation_detail,
        },
        include: { payment: true },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { refund_status: 'ADMIN_REVIEW' },
        });
      }

      await tx.refundAuditLog.create({
        data: {
          order_id: id,
          actor_id: req.user.id,
          actor_role: 'CUSTOMER',
          action: 'APPEALED_TO_ADMIN',
          previous_status: order.status,
          new_status: 'ADMIN_REVIEW',
          reason_note: explanation ? explanation.trim() : 'Customer appealed rejection to Admin',
        },
      });

      await tx.adminNotification.create({
        data: {
          type: 'REFUND_APPEALED',
          title: '⚖️ Customer Refund Appeal Submitted',
          message: `Customer appealed vendor rejection for Order #${id.slice(0, 8).toUpperCase()}. Admin review required.`,
          order_id: id,
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Appeal submitted to Admin for final review.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};
