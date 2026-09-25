import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create Nodemailer Transporter using environment variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || user === 'your_email@gmail.com' || !pass || pass === 'your_app_password') {
    logger.warn('📧 SMTP credentials not configured in .env. Emails will be logged to console.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const transporter = createTransporter();
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@plantselling.com';

/**
 * Helper to send email or log to console if SMTP is unconfigured/fails
 */
const sendMail = async ({ to, subject, html }) => {
  try {
    if (!transporter) {
      console.log('\n=================== [SIMULATED EMAIL] ===================');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('---------------------------------------------------------');
      console.log(`Content: HTML Email (${html.length} chars)`);
      console.log('=========================================================\n');
      return true;
    }

    const info = await transporter.sendMail({
      from: `PlantMarket <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    logger.info(`📧 Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to send email to ${to}: ${error.message}`);
    // Log fallback content so developer can inspect it
    console.log(`[Email Fallback - ${subject} to ${to}]`);
    return false;
  }
};

/**
 * Send Order Confirmation Email when a customer places an order
 */
export const sendOrderConfirmationEmail = async ({ toEmail, customerName, order }) => {
  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  const totalFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(order.total_amount);

  const itemsListHtml = (order.order_items || []).map((item) => {
    const pName = item.product?.name || item.name || 'Plant Item';
    const priceFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price);
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;"><strong>${pName}</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">x${item.quantity}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a; font-weight: 600;">रू ${priceFmt}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #15803d, #166534); padding: 30px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px 24px; }
        .greeting { font-size: 16px; color: #374151; margin-bottom: 16px; }
        .order-badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .total-row { background: #f9fafb; font-weight: bold; }
        .total-row td { padding: 14px 0; border-top: 2px solid #16a34a; color: #15803d; font-size: 18px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🌱 PlantMarket</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Order Confirmation</p>
        </div>
        <div class="content">
          <p class="greeting">Hi <strong>${customerName || 'Customer'}</strong>,</p>
          <p style="color: #4b5563; line-height: 1.5;">Thank you for shopping with PlantMarket! We have received your order and our nursery vendors are preparing your items.</p>
          
          <div class="order-badge">Order ID: #${orderIdShort}</div>

          <table class="table">
            <thead>
              <tr style="text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase;">
                <th style="padding-bottom: 8px;">Product</th>
                <th style="padding-bottom: 8px; text-align: center;">Qty</th>
                <th style="padding-bottom: 8px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              <tr class="total-row">
                <td colspan="2">Total Amount</td>
                <td style="text-align: right;">रू ${totalFmt}</td>
              </tr>
            </tbody>
          </table>

          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">You can check your order updates anytime from your <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/customer/dashboard" style="color: #16a34a; text-decoration: none; font-weight: 600;">Customer Dashboard</a>.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PlantMarket. All rights reserved.<br>
          Bringing nature closer to your home.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendMail({
    to: toEmail,
    subject: `🌱 Order Confirmation #${orderIdShort} - PlantMarket`,
    html,
  });
};

/**
 * Send Order Status Update Email when vendor/admin changes order status
 */
export const sendOrderStatusUpdateEmail = async ({ toEmail, customerName, order, newStatus }) => {
  const orderIdShort = order.id.slice(0, 8).toUpperCase();

  const statusColors = {
    PENDING: { bg: '#fef3c7', text: '#b45309', emoji: '⏳', desc: 'Your order has been received and is waiting for processing.' },
    PROCESSING: { bg: '#dbeafe', text: '#1d4ed8', emoji: '⚙️', desc: 'Your order is currently being packed and prepared by our vendor.' },
    SHIPPED: { bg: '#e0e7ff', text: '#4338ca', emoji: '🚚', desc: 'Great news! Your plant package has been shipped and is on its way.' },
    DELIVERED: { bg: '#dcfce7', text: '#15803d', emoji: '🎉', desc: 'Your order has been delivered! We hope you enjoy your new plants.' },
    CANCELLED: { bg: '#fee2e2', text: '#b91c1c', emoji: '❌', desc: 'Your order has been cancelled.' },
  };

  const currentStatus = statusColors[newStatus] || { bg: '#f3f4f6', text: '#374151', emoji: '📦', desc: `Your order status is now ${newStatus}.` };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #15803d, #166534); padding: 30px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px 24px; text-align: center; }
        .status-box { background: ${currentStatus.bg}; color: ${currentStatus.text}; padding: 16px; border-radius: 12px; margin: 20px 0; font-size: 18px; font-weight: 700; }
        .status-desc { color: #4b5563; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
        .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🌱 PlantMarket</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Order Status Update</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; color: #374151; margin-bottom: 10px;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
          <p style="color: #6b7280; margin-top: 0;">Order #${orderIdShort}</p>

          <div class="status-box">
            ${currentStatus.emoji} Order Status: ${newStatus}
          </div>

          <p class="status-desc">${currentStatus.desc}</p>

          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/customer/dashboard" class="btn">View Order Details</a>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PlantMarket. All rights reserved.<br>
          Need help? Reply to this email or visit our support center.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendMail({
    to: toEmail,
    subject: `${currentStatus.emoji} Order #${orderIdShort} Status Updated to ${newStatus} - PlantMarket`,
    html,
  });
};

/**
 * Send Product Deletion Email to Vendor when Admin removes a product
 */
export const sendProductDeletionEmail = async ({ toEmail, vendorName, productName, reason, adminName, deletedAt }) => {
  const formattedDate = deletedAt
    ? new Date(deletedAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #b91c1c, #991b1b); padding: 30px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px 24px; }
        .greeting { font-size: 16px; color: #374151; margin-bottom: 16px; }
        .product-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .product-name { font-size: 18px; font-weight: 700; color: #991b1b; margin-bottom: 4px; }
        .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; color: #991b1b; padding: 16px; border-radius: 6px; margin: 20px 0; font-size: 14px; line-height: 1.6; }
        .meta-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
        .meta-table td { padding: 8px 12px; border: 1px solid #e5e7eb; color: #4b5563; }
        .meta-table td:first-child { background: #f9fafb; font-weight: 600; color: #374151; width: 40%; }
        .confirmed-box { background: #dcfce7; border-left: 4px solid #16a34a; color: #166534; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; font-weight: 600; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🌱 PlantMarket</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Product Removal Notice</p>
        </div>
        <div class="content">
          <p class="greeting">Dear <strong>${vendorName || 'Vendor'}</strong>,</p>
          <p style="color: #4b5563; line-height: 1.5;">
            We are writing to inform you that the following product has been <strong>permanently removed</strong> from the PlantMarket platform by a platform administrator.
          </p>

          <div class="product-box">
            <div class="product-name">🗑 "${productName}"</div>
            <div style="font-size: 12px; color: #b91c1c;">This product has been permanently deleted</div>
          </div>

          <div class="reason-box">
            <strong>Reason for Removal:</strong><br />
            "${reason}"
          </div>

          <table class="meta-table">
            <tr><td>Deleted By</td><td>${adminName || 'Platform Administrator'}</td></tr>
            <tr><td>Deletion Date &amp; Time</td><td>${formattedDate}</td></tr>
            <tr><td>Product Name</td><td>${productName}</td></tr>
          </table>

          <div class="confirmed-box">
            ✅ Confirmed: This product has been permanently deleted from the platform. Existing orders containing this product are preserved in order history.
          </div>

          <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
            If you believe this action was taken in error, or you have questions regarding this decision, please reach out to platform support. You may re-list a revised, policy-compliant product at any time.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PlantMarket Admin Team.<br>
          This is an automated notification from the platform administration.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendMail({
    to: toEmail,
    subject: `⚠️ Notice: Product "${productName}" Permanently Removed - PlantMarket`,
    html,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// CANCELLATION & REFUND EMAILS
// ────────────────────────────────────────────────────────────────────────────

const emailLayout = (headerBg, headerTitle, headerSubtitle, bodyHtml) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
      .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      .header { background: ${headerBg}; padding: 30px 20px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .header p  { margin: 5px 0 0 0; opacity: 0.9; }
      .content { padding: 30px 24px; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
      .info-box { border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>🌱 PlantMarket</h1>
        <p>${headerSubtitle}</p>
      </div>
      <div class="content">${bodyHtml}</div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} PlantMarket. All rights reserved.<br>
        Bringing nature closer to your home.
      </div>
    </div>
  </body>
  </html>
`;

const orderIdShort = (id) => id.slice(0, 8).toUpperCase();
const fmtAmt = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const dashboardUrl = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/customer/dashboard` : 'http://localhost:5173/customer/dashboard';

/**
 * Customer: COD order cancellation confirmation
 */
export const sendCODCancellationEmail = async ({ toEmail, customerName, order, reason }) => {
  const shortId = orderIdShort(order.id);
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">Your order has been successfully <strong>cancelled</strong>. Since you paid by Cash on Delivery, no refund processing is needed.</p>
    <div class="info-box" style="background:#fef3c7;border-left:4px solid #f59e0b;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Total:</strong> रू ${fmtAmt(order.total_amount)}<br>
      <strong>Reason:</strong> ${reason || '—'}
    </div>
    <p style="color:#6b7280;font-size:13px;">The stock for your cancelled items has been restored. You can browse and order again anytime.</p>
    <p style="margin-top:24px;text-align:center;"><a href="${dashboardUrl}" class="btn">View My Orders</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `✅ Order #${shortId} Cancelled — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#15803d,#166534)', 'Order Cancelled', 'COD Cancellation Confirmation', body),
  });
};

/**
 * Customer: prepaid cancellation request submitted
 */
export const sendCancellationRequestEmail = async ({ toEmail, customerName, order, reason }) => {
  const shortId = orderIdShort(order.id);
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">We have received your <strong>cancellation request</strong> for Order <strong>#${shortId}</strong>. Our team will review and respond within 1–2 business days.</p>
    <div class="info-box" style="background:#fef3c7;border-left:4px solid #f59e0b;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      <strong>Reason:</strong> ${reason || '—'}<br>
      <strong>Status:</strong> Under Review
    </div>
    <p style="color:#6b7280;font-size:13px;">Once approved, your refund will be processed and you'll receive another email. Please do not place a new order for the same item until this is resolved.</p>
    <p style="margin-top:24px;text-align:center;"><a href="${dashboardUrl}" class="btn">Track My Order</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `⏳ Cancellation Request Submitted — Order #${shortId} — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#d97706,#b45309)', 'Cancellation Requested', 'Your request is under review', body),
  });
};

/**
 * Customer: cancellation approved, refund pending
 */
export const sendCancellationApprovedEmail = async ({ toEmail, customerName, order }) => {
  const shortId = orderIdShort(order.id);
  const payMethod = order.payment?.payment_method || 'online payment';
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">Great news! Your cancellation request for Order <strong>#${shortId}</strong> has been <strong>approved</strong>.</p>
    <div class="info-box" style="background:#dcfce7;border-left:4px solid #16a34a;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Refund Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      <strong>Payment Method:</strong> ${payMethod}<br>
      <strong>Refund Status:</strong> 🔄 Refund Pending
    </div>
    <p style="color:#6b7280;font-size:13px;">Our admin team will process the refund to your original payment method within 3–5 business days. You will receive another confirmation once it is completed.</p>
    <p style="margin-top:24px;text-align:center;"><a href="${dashboardUrl}" class="btn">View My Orders</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `✅ Cancellation Approved — Refund Pending — Order #${shortId} — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#15803d,#166534)', 'Cancellation Approved', 'Refund is being processed', body),
  });
};

/**
 * Customer: cancellation rejected
 */
export const sendCancellationRejectedEmail = async ({ toEmail, customerName, order, adminNote }) => {
  const shortId = orderIdShort(order.id);
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">We regret to inform you that your cancellation request for Order <strong>#${shortId}</strong> could not be approved at this time.</p>
    <div class="info-box" style="background:#fee2e2;border-left:4px solid #ef4444;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      ${adminNote ? `<strong>Admin Note:</strong> ${adminNote}` : ''}
    </div>
    <p style="color:#6b7280;font-size:13px;">Your order will continue as normal. If you have any questions, please contact our support team at <strong>${process.env.SUPPORT_EMAIL || 'plantmarket000@gmail.com'}</strong>.</p>
    <p style="margin-top:24px;text-align:center;"><a href="${dashboardUrl}" class="btn">View My Orders</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `❌ Cancellation Request Not Approved — Order #${shortId} — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#b91c1c,#991b1b)', 'Cancellation Not Approved', 'Your order will proceed as planned', body),
  });
};

/**
 * Customer: refund has been completed
 */
export const sendRefundCompletedEmail = async ({ toEmail, customerName, order, refundRef }) => {
  const shortId = orderIdShort(order.id);
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${customerName || 'Customer'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">Your refund for Order <strong>#${shortId}</strong> has been <strong>processed successfully</strong>!</p>
    <div class="info-box" style="background:#dcfce7;border-left:4px solid #16a34a;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Refund Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      ${refundRef ? `<strong>Reference:</strong> ${refundRef}` : ''}
      <br><strong>Status:</strong> ✅ Refunded
    </div>
    <p style="color:#6b7280;font-size:13px;">The refund should appear in your account within 2–5 business days depending on your bank. Thank you for shopping with PlantMarket!</p>
    <p style="margin-top:24px;text-align:center;"><a href="${dashboardUrl}" class="btn">Browse Plants Again</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `💚 Refund Completed — Order #${shortId} — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#15803d,#166534)', 'Refund Completed', 'Your money is on its way', body),
  });
};

/**
 * Vendor: notification that an order from their store was cancelled
 */
export const sendVendorCancellationEmail = async ({ toEmail, vendorName, order }) => {
  const shortId = orderIdShort(order.id);
  const customerName = order.user?.name || 'A customer';
  const body = `
    <p style="font-size:16px;color:#374151;">Hi <strong>${vendorName || 'Vendor'}</strong>,</p>
    <p style="color:#4b5563;line-height:1.5;">We are informing you that Order <strong>#${shortId}</strong> from <strong>${customerName}</strong> has been <strong>cancelled</strong>. The stock for the affected items has been restored to your inventory.</p>
    <div class="info-box" style="background:#fef3c7;border-left:4px solid #f59e0b;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Customer:</strong> ${customerName}<br>
      <strong>Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      <strong>Cancellation Reason:</strong> ${order.cancellation_reason || '—'}
    </div>
    <p style="color:#6b7280;font-size:13px;">No further action is required from you. The inventory has already been updated automatically.</p>
  `;
  return sendMail({
    to: toEmail,
    subject: `📦 Order #${shortId} Cancelled — PlantMarket Vendor Notice`,
    html: emailLayout('linear-gradient(135deg,#d97706,#b45309)', 'Order Cancellation Notice', 'An order from your store was cancelled', body),
  });
};

/**
 * Admin: a customer has submitted a prepaid cancellation request
 */
export const sendAdminCancellationRequestEmail = async ({ toEmail, order, customer, vendor }) => {
  const shortId = orderIdShort(order.id);
  const adminDashUrl = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/admin/dashboard` : 'http://localhost:5173/admin/dashboard';
  const body = `
    <p style="font-size:16px;color:#374151;">A customer has submitted a <strong>cancellation request</strong> requiring admin review.</p>
    <div class="info-box" style="background:#fef3c7;border-left:4px solid #f59e0b;">
      <strong>Order:</strong> #${shortId}<br>
      <strong>Customer:</strong> ${customer?.name || '—'} (${customer?.email || '—'})<br>
      <strong>Vendor:</strong> ${vendor?.store_name || '—'}<br>
      <strong>Amount:</strong> रू ${fmtAmt(order.total_amount)}<br>
      <strong>Payment Method:</strong> ${order.payment?.payment_method || '—'}<br>
      <strong>Reason:</strong> ${order.cancellation_reason || '—'}<br>
      ${order.cancellation_detail ? `<strong>Detail:</strong> ${order.cancellation_detail}` : ''}
    </div>
    <p style="color:#6b7280;font-size:13px;">Please log in to the admin dashboard to approve or reject this request.</p>
    <p style="margin-top:24px;text-align:center;"><a href="${adminDashUrl}" class="btn">Go to Admin Dashboard</a></p>
  `;
  return sendMail({
    to: toEmail,
    subject: `⚠️ Cancellation Request — Order #${shortId} Needs Review — PlantMarket`,
    html: emailLayout('linear-gradient(135deg,#a855f7,#7c3aed)', 'Action Required', 'Cancellation request awaiting approval', body),
  });
};


