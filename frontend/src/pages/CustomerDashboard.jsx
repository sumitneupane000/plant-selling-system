import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getProducts, getPublicCategories } from '../api/productAPI.js';
import { createOrder, getMyOrders, cancelOrder, requestCancellation } from '../api/orderAPI.js';

// ── Cancellation Modal Component ─────────────────────────────────────
const CancellationModal = ({ order, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCOD = order?.payment?.payment_method === 'CASH_ON_DELIVERY';
  const requiresEvidence = ['Damaged product', 'Wrong product received'].includes(reason);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 5) {
      setError('You can upload a maximum of 5 evidence files.');
      return;
    }
    setError('');
    setEvidenceFiles(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Please select a reason for cancellation.');
      return;
    }

    if (reason === 'Other' && !detail.trim()) {
      setError('Additional details are required when selecting "Other".');
      return;
    }

    if (requiresEvidence && evidenceFiles.length === 0) {
      setError(`Supporting evidence photo/file is required for "${reason}".`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isCOD) {
        await cancelOrder(order.id, { reason, detail });
      } else {
        const formData = new FormData();
        formData.append('reason', reason);
        formData.append('detail', detail);
        evidenceFiles.forEach((file) => formData.append('evidence', file));

        await requestCancellation(order.id, formData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process cancellation request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <h3 className="modal-title">
          {isCOD ? '🚫 Cancel Order' : '⏳ Request Order Cancellation'}
        </h3>

        {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>
          {isCOD ? (
            <>This will immediately cancel Order <strong style={{ color: '#86efac' }}>#{order?.id?.slice(0, 8).toUpperCase()}</strong> and restore item stock. No payment was collected.</>
          ) : (
            <>Submitting a cancellation/refund request for Order <strong style={{ color: '#86efac' }}>#{order?.id?.slice(0, 8).toUpperCase()}</strong>. Your request will be reviewed by the vendor.</>
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Reason for Cancellation *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">— Select Reason —</option>
              <option value="Changed my mind">Changed my mind</option>
              <option value="Ordered by mistake">Ordered by mistake</option>
              <option value="Found better price elsewhere">Found better price elsewhere</option>
              <option value="Delivery time too long">Delivery time too long</option>
              <option value="Damaged product">Damaged product (Evidence required)</option>
              <option value="Wrong product received">Wrong product received (Evidence required)</option>
              <option value="Missing item">Missing item</option>
              <option value="Product not as described">Product not as described</option>
              <option value="Product quality issue">Product quality issue</option>
              <option value="Other">Other (Explanation required)</option>
            </select>
          </div>

          <div className="form-field">
            <label>Additional Details {reason === 'Other' ? '*' : '(Optional)'}</label>
            <textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={reason === 'Other' ? 'Please provide specific details for your cancellation request…' : 'Tell us more about why you are cancelling…'}
              required={reason === 'Other'}
            />
          </div>

          {!isCOD && (
            <div className="form-field" style={{ marginTop: '12px' }}>
              <label>Supporting Evidence Photos/Files {requiresEvidence ? '*' : '(Optional)'}</label>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'block' }}>
                Upload up to 5 images or PDFs (max 5MB each). Required for damaged or wrong products.
              </span>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn--danger" onClick={onClose} disabled={loading}>
              Back
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Submitting…' : isCOD ? 'Confirm Cancellation' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


import { updateProfileAPI } from '../api/authAPI.js';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../api/cartAPI.js';
import api from '../api/axiosInstance.js';
import { initiateKhaltiPayment, initiateEsewaPayment, verifyEsewaPayment } from '../api/paymentAPI.js';
import { getPaymentLabel, isOnlinePayment } from '../utils/paymentUtils.js';
import { resolveImageUrl } from '../utils/imageUtils.js';
import '../styles/dashboard.css';

const TABS = ['Browse Plants', 'My Cart', 'My Orders', 'About Us', 'Customer Support', 'My Profile'];

const statusPillClass = (s) => {
  const map = {
    PENDING: 'status-pill--pending', PROCESSING: 'status-pill--processing',
    SHIPPED: 'status-pill--shipped', DELIVERED: 'status-pill--delivered',
    CANCELLED: 'status-pill--cancelled', CANCELLATION_REQUESTED: 'status-pill--cancellation-requested',
  };
  return `status-pill ${map[s] || 'status-pill--pending'}`;
};


const fmt = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Plant placeholder emoji by name keywords
const plantEmoji = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('cactus')) return '🌵';
  if (n.includes('rose')) return '🌹';
  if (n.includes('sunflower')) return '🌻';
  if (n.includes('tulip')) return '🌷';
  if (n.includes('herb') || n.includes('basil') || n.includes('mint')) return '🌿';
  if (n.includes('tree') || n.includes('oak')) return '🌳';
  if (n.includes('palm')) return '🌴';
  if (n.includes('bamboo')) return '🎋';
  if (n.includes('aloe')) return '🪴';
  return '🌱';
};

// ── eSewa QR (green branded) ─────────────────────────────────────
const EsewaQRSVG = () => (
  <svg width="120" height="120" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: '8px', background: '#fff', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
    <rect x="8" y="8" width="36" height="36" rx="4" fill="#1a5c2a"/>
    <rect x="14" y="14" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="18" y="18" width="16" height="16" fill="#16a34a"/>
    <rect x="96" y="8" width="36" height="36" rx="4" fill="#1a5c2a"/>
    <rect x="102" y="14" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="106" y="18" width="16" height="16" fill="#16a34a"/>
    <rect x="8" y="96" width="36" height="36" rx="4" fill="#1a5c2a"/>
    <rect x="14" y="102" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="18" y="106" width="16" height="16" fill="#16a34a"/>
    <rect x="52" y="10" width="8" height="8" fill="#1a5c2a"/>
    <rect x="68" y="10" width="16" height="8" fill="#16a34a"/>
    <rect x="52" y="26" width="16" height="8" fill="#1a5c2a"/>
    <rect x="76" y="26" width="8" height="8" fill="#16a34a"/>
    <rect x="10" y="52" width="8" height="16" fill="#16a34a"/>
    <rect x="26" y="52" width="16" height="8" fill="#1a5c2a"/>
    <rect x="52" y="52" width="36" height="36" rx="4" fill="#16a34a"/>
    <text x="70" y="76" fontSize="16" textAnchor="middle">eSewa</text>
    <rect x="96" y="52" width="8" height="16" fill="#1a5c2a"/>
    <rect x="112" y="52" width="16" height="8" fill="#16a34a"/>
    <rect x="10" y="76" width="16" height="8" fill="#1a5c2a"/>
    <rect x="96" y="76" width="16" height="8" fill="#16a34a"/>
    <rect x="52" y="96" width="16" height="8" fill="#1a5c2a"/>
    <rect x="76" y="96" width="8" height="16" fill="#16a34a"/>
    <rect x="96" y="96" width="16" height="16" fill="#16a34a"/>
  </svg>
);

// ── Khalti QR (purple branded) ───────────────────────────────────
const KhaltiQRSVG = () => (
  <svg width="120" height="120" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: '8px', background: '#fff', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
    <rect x="8" y="8" width="36" height="36" rx="4" fill="#3b1070"/>
    <rect x="14" y="14" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="18" y="18" width="16" height="16" fill="#7c3aed"/>
    <rect x="96" y="8" width="36" height="36" rx="4" fill="#3b1070"/>
    <rect x="102" y="14" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="106" y="18" width="16" height="16" fill="#7c3aed"/>
    <rect x="8" y="96" width="36" height="36" rx="4" fill="#3b1070"/>
    <rect x="14" y="102" width="24" height="24" rx="2" fill="#fff"/>
    <rect x="18" y="106" width="16" height="16" fill="#7c3aed"/>
    <rect x="52" y="10" width="8" height="8" fill="#3b1070"/>
    <rect x="68" y="10" width="16" height="8" fill="#7c3aed"/>
    <rect x="52" y="26" width="16" height="8" fill="#3b1070"/>
    <rect x="76" y="26" width="8" height="8" fill="#7c3aed"/>
    <rect x="10" y="52" width="8" height="16" fill="#7c3aed"/>
    <rect x="26" y="52" width="16" height="8" fill="#3b1070"/>
    <rect x="52" y="52" width="36" height="36" rx="4" fill="#7c3aed"/>
    <text x="70" y="76" fontSize="13" textAnchor="middle" fill="#fff">Khalti</text>
    <rect x="96" y="52" width="8" height="16" fill="#3b1070"/>
    <rect x="112" y="52" width="16" height="8" fill="#7c3aed"/>
    <rect x="10" y="76" width="16" height="8" fill="#3b1070"/>
    <rect x="96" y="76" width="16" height="8" fill="#7c3aed"/>
    <rect x="52" y="96" width="16" height="8" fill="#3b1070"/>
    <rect x="76" y="96" width="8" height="16" fill="#7c3aed"/>
    <rect x="96" y="96" width="16" height="16" fill="#7c3aed"/>
  </svg>
);

// ── Credit / Debit Card Form Component ─────────────────────────────────────
const CardPaymentForm = ({ amount, cardState, setCardState }) => {
  const detectBrand = (num) => {
    const clean = num.replace(/\s+/g, '');
    if (/^4/.test(clean)) return { name: 'Visa', icon: '💳 VISA' };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'Mastercard', icon: '💳 MasterCard' };
    if (/^3[47]/.test(clean)) return { name: 'Amex', icon: '💳 AMEX' };
    return { name: '', icon: '💳 Card' };
  };

  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardState((prev) => ({ ...prev, cardNumber: formatted }));
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) {
      val = `${val.slice(0, 2)} / ${val.slice(2)}`;
    }
    setCardState((prev) => ({ ...prev, expiry: val }));
  };

  const handleCvvChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardState((prev) => ({ ...prev, cvv: val }));
  };

  const brand = detectBrand(cardState.cardNumber);

  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(134,239,172,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#86efac' }}>
          {brand.icon} Secure Card Payment
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
          Demo / Test Mode
        </span>
      </div>

      {/* Card Number */}
      <div className="form-field" style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Card Number *</span>
          {brand.name && <span style={{ color: '#86efac', fontSize: '11px', fontWeight: 700 }}>{brand.name}</span>}
        </label>
        <input
          type="text"
          value={cardState.cardNumber}
          onChange={handleCardNumberChange}
          placeholder="1234 5678 9012 3456"
          maxLength={19}
        />
      </div>

      {/* Cardholder Name */}
      <div className="form-field" style={{ marginBottom: '12px' }}>
        <label>Cardholder Name *</label>
        <input
          type="text"
          value={cardState.cardName}
          onChange={(e) => setCardState((prev) => ({ ...prev, cardName: e.target.value.toUpperCase() }))}
          placeholder="JOHN DOE"
        />
      </div>

      {/* Expiry & CVV */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div className="form-field">
          <label>Expiry Date *</label>
          <input
            type="text"
            value={cardState.expiry}
            onChange={handleExpiryChange}
            placeholder="MM / YY"
            maxLength={7}
          />
        </div>
        <div className="form-field">
          <label>CVV *</label>
          <input
            type="password"
            value={cardState.cvv}
            onChange={handleCvvChange}
            placeholder="•••"
            maxLength={4}
          />
        </div>
      </div>

      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        🔒 <span>Secure Payment — Your payment information is encrypted and securely processed.</span>
      </div>
    </div>
  );
};

// ── Online Payment Details Component ─────────────────────────────────────
const OnlinePaymentSection = ({
  paymentMethod, onWebPayStart, vendorPhone = '+977 9841234567',
  amount, transactionId, setTransactionId, paymentConfirmed, setPaymentConfirmed,
  cardState, setCardState
}) => {
  const [copied, setCopied] = useState(false);
  const [webPayLoading, setWebPayLoading] = useState(false);
  const [webPayErr, setWebPayErr] = useState('');

  const isEsewa  = paymentMethod === 'ESEWA';
  const isKhalti = paymentMethod === 'KHALTI';
  const isCard   = paymentMethod === 'CARD';

  if (isCard) {
    return <CardPaymentForm amount={amount} cardState={cardState} setCardState={setCardState} />;
  }

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(vendorPhone.replace(/[^\d+]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodLabel = () => {
    if (isEsewa)  return 'eSewa';
    if (isKhalti) return 'Khalti';
    return 'Online Payment';
  };

  const accentColor  = isEsewa ? '#16a34a' : isKhalti ? '#7c3aed' : '#86efac';
  const accentBorder = isEsewa ? 'rgba(22,163,74,0.35)' : isKhalti ? 'rgba(124,58,237,0.35)' : 'rgba(134,239,172,0.25)';
  const accentBg     = isEsewa ? 'rgba(22,163,74,0.08)' : isKhalti ? 'rgba(124,58,237,0.08)' : 'rgba(22,163,74,0.08)';

  // eSewa: form-POST redirect to sandbox
  const handleEsewaWebPay = async () => {
    setWebPayLoading(true); setWebPayErr('');
    try {
      const pendingOrderId = await onWebPayStart();
      if (!pendingOrderId) {
        setWebPayLoading(false);
        return; // parent handles error display
      }
      const res = await initiateEsewaPayment(pendingOrderId);
      const { payment_url, form_data } = res.data.data;
      // Build and auto-submit form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payment_url;
      form.target = '_blank'; // Open in new tab
      Object.entries(form_data).forEach(([k, v]) => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = k; inp.value = v;
        form.appendChild(inp);
      });
      document.body.appendChild(form);
      form.submit();
      setWebPayLoading(false); // Reset loading since it opened in new tab
    } catch (e) {
      setWebPayErr(e.response?.data?.message || 'Failed to initiate eSewa payment.');
      setWebPayLoading(false);
    }
  };

  // Khalti: API initiate → redirect to payment_url
  const handleKhaltiWebPay = async () => {
    setWebPayLoading(true); setWebPayErr('');
    try {
      const pendingOrderId = await onWebPayStart();
      if (!pendingOrderId) {
        setWebPayLoading(false);
        return; // parent handles error display
      }
      const res = await initiateKhaltiPayment(pendingOrderId);
      const { payment_url } = res.data.data;
      window.open(payment_url, '_blank'); // Open in new tab
      setWebPayLoading(false);
    } catch (e) {
      setWebPayErr(e.response?.data?.message || 'Failed to initiate Khalti payment.');
      setWebPayLoading(false);
    }
  };

  return (
    <div style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: accentColor, fontSize: '14px', fontWeight: 700 }}>
          {isEsewa ? '🟢' : isKhalti ? '🟣' : '💳'} {getMethodLabel()} Payment
        </h4>
        <span style={{ fontSize: '10px', background: 'rgba(253,230,138,0.2)', color: '#fde68a', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
          🧪 SANDBOX / TEST
        </span>
      </div>

      {/* Tabs: QR | Web Pay */}
      {(isEsewa || isKhalti) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {/* QR section */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 600 }}>
              📷 QR — Manual Pay
            </div>
            {isEsewa  && <EsewaQRSVG />}
            {isKhalti && <KhaltiQRSVG />}
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
              Scan with {getMethodLabel()} app
            </div>
          </div>

          {/* Web Pay section */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              🌐 Web — Redirect Pay
            </div>
            <button
              type="button"
              onClick={isEsewa ? handleEsewaWebPay : handleKhaltiWebPay}
              disabled={webPayLoading}
              style={{
                background: isEsewa
                  ? 'linear-gradient(135deg,#16a34a,#15803d)'
                  : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontSize: '13px', fontWeight: 700, padding: '10px 16px',
                cursor: webPayLoading ? 'not-allowed' : 'pointer', opacity: webPayLoading ? 0.7 : 1,
                width: '100%', fontFamily: 'inherit',
              }}
            >
              {webPayLoading ? 'Redirecting…' : `Pay with ${getMethodLabel()} →`}
            </button>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.4 }}>
              {isEsewa
                ? 'Test ID: 9806800001\nPwd: Nepal@123'
                : 'Test: Khalti sandbox portal'}
            </div>
          </div>
        </div>
      )}

      {webPayErr && <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '10px' }}>⚠️ {webPayErr}</div>}

      {/* Phone number */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
          Or send to vendor mobile number:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#fff' }}>{vendorPhone}</span>
          <button type="button" onClick={handleCopyPhone}
            style={{ background: copied ? '#16a34a' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}>
            {copied ? 'Copied! ✓' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Manual transaction code */}
      <div className="form-field" style={{ marginBottom: '12px' }}>
        <label style={{ color: '#f0fdf4', fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Transaction Code (manual pay) *</span>
          {transactionId.trim() === '' && <span style={{ color: '#fca5a5', fontSize: '11px' }}>Required for manual</span>}
        </label>
        <input type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
          placeholder="Enter transaction reference code"
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px',
            border: transactionId.trim() === '' ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(134,239,172,0.4)' }} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#f0fdf4' }}>
        <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }} />
        <span style={{ fontWeight: 600 }}>I Have Completed the Payment</span>
      </label>
    </div>
  );
};



// ── Order Confirmation Modal Component ─────────────────────────────────────
const OrderConfirmationModal = ({ items, totalAmount, paymentMethod, cardDetails, customerName, onClose, onConfirm, loading }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 250 }} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', border: '1px solid rgba(134,239,172,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '36px' }}>📋</span>
          <h3 className="modal-title" style={{ margin: '8px 0 4px', fontSize: '20px' }}>Review & Confirm Order</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>Please verify your order details before final submission.</p>
        </div>

        {/* Items list */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', maxHeight: '160px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '8px' }}>
            Order Items ({items.length})
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#86efac', fontWeight: 700 }}>{item.quantity}x</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{item.product?.name || item.name}</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                रू{fmt((item.product?.price || item.price) * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Customer & Payment details */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Customer:</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{customerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Payment Method:</span>
            <span style={{ color: '#86efac', fontWeight: 600 }}>
              {paymentMethod === 'CASH_ON_DELIVERY' ? '💵 Cash on Delivery' : paymentMethod === 'CARD' ? '💳 Credit/Debit Card' : paymentMethod}
            </span>
          </div>
          {paymentMethod === 'CARD' && cardDetails?.cardNumber && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Card Number:</span>
              <span style={{ color: '#fff', fontFamily: 'monospace' }}>•••• •••• •••• {cardDetails.cardNumber.replace(/\s+/g, '').slice(-4)}</span>
            </div>
          )}
        </div>

        {/* Price Breakdown */}
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            <span>Subtotal:</span>
            <span>रू{fmt(totalAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            <span>Shipping / Delivery:</span>
            <span style={{ color: '#86efac' }}>FREE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>Total Amount Due:</span>
            <span style={{ fontWeight: 800, color: '#86efac', fontSize: '20px' }}>रू{fmt(totalAmount)}</span>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--danger" onClick={onClose} disabled={loading}>
            Back to Edit
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Submitting Order…' : '🔒 Final Order Confirmation'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Order Modal (Buy Now) ───────────────────────────────────────
const OrderModal = ({ product, user, onClose, onOrdered }) => {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY');
  const [transactionId, setTransactionId] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Credit Card Form State
  const [cardState, setCardState] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  const isCard = paymentMethod === 'CARD';
  const isCardValid = !isCard || (
    cardState.cardNumber.replace(/\s+/g, '').length === 16 &&
    cardState.cardName.trim().length > 0 &&
    cardState.expiry.trim().length >= 5 &&
    cardState.cvv.trim().length >= 3
  );

  const isOnlineManual = paymentMethod === 'ESEWA' || paymentMethod === 'KHALTI';
  const isPaymentValid = isCard ? isCardValid : (!isOnlineManual || (transactionId.trim().length > 0 && paymentConfirmed));
  const totalAmount = Number(product.price) * qty;

  const handleReviewOrder = () => {
    setErr('');
    if (isCard && !isCardValid) {
      setErr('Please fill out all Credit/Debit Card fields accurately (16-digit card number, name, expiry MM/YY, CVV).');
      return;
    }
    if (isOnlineManual && (!transactionId.trim() || !paymentConfirmed)) {
      setErr('Please complete the manual payment and enter your transaction code before placing the order.');
      return;
    }
    setShowConfirm(true);
  };

  const handleFinalOrderSubmit = async () => {
    setLoading(true); setErr('');
    try {
      const items = [{ product_id: product.id, quantity: qty }];
      let generatedTxId = transactionId.trim();
      if (isCard) {
        generatedTxId = `CARD-TEST-${Date.now()}-${cardState.cardNumber.slice(-4)}`;
      }

      const orderPayload = {
        payment_method: paymentMethod,
        ...(generatedTxId ? { transaction_id: generatedTxId } : {}),
      };

      await createOrder(items, orderPayload);
      onOrdered();
      onClose();
    } catch (e) {
      setShowConfirm(false);
      setErr(e.response?.data?.message || 'Failed to place order.');
    } finally { setLoading(false); }
  };

  const handleWebPayStart = async () => {
    setErr('');
    try {
      const items = [{ product_id: product.id, quantity: qty }];
      const orderPayload = { payment_method: paymentMethod };
      const res = await createOrder(items, orderPayload);
      onOrdered();
      return res.data.data.order.id;
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create order for payment.');
      return null;
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h3 className="modal-title">🛒 Buy Now</h3>
          <div style={{ textAlign: 'center', fontSize: 48, margin: '12px 0', height: '140px', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {product.product_images?.[0]
              ? <img
                  src={resolveImageUrl(product.product_images[0].image_url)}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '12px' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentText('afterend', plantEmoji(product.name)); }}
                />
              : plantEmoji(product.name)}
          </div>
          <p style={{ color: '#f0fdf4', fontWeight: 600, marginBottom: 4 }}>{product.name}</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>by {product.vendor?.store_name}</p>

          {err && <div className="error-msg">{err}</div>}

          <div className="form-field">
            <label>Quantity (max {product.stock})</label>
            <input type="number" min="1" max={product.stock} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value), product.stock)))} />
          </div>
          
          <div className="form-field">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setErr(''); }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff', width: '100%', marginBottom: '16px' }}>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
              <option value="CARD">Credit/Debit Card</option>
              <option value="ESEWA">eSewa Mobile Wallet</option>
              <option value="KHALTI">Khalti Digital Wallet</option>
            </select>
          </div>

          {/* Online / Card Payment Details Section */}
          {paymentMethod !== 'CASH_ON_DELIVERY' && (
            <OnlinePaymentSection
              paymentMethod={paymentMethod}
              onWebPayStart={handleWebPayStart}
              vendorPhone={product.vendor?.phone || product.vendor?.user?.phone || '+977 9841234567'}
              amount={totalAmount}
              transactionId={transactionId}
              setTransactionId={setTransactionId}
              paymentConfirmed={paymentConfirmed}
              setPaymentConfirmed={setPaymentConfirmed}
              cardState={cardState}
              setCardState={setCardState}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Total Amount</span>
            <span style={{ color: '#86efac', fontWeight: 700, fontSize: 20 }}>रू{fmt(totalAmount)}</span>
          </div>

          {!isPaymentValid && (
            <div style={{ fontSize: '12px', color: '#fde68a', background: 'rgba(253, 230, 138, 0.1)', border: '1px solid rgba(253, 230, 138, 0.2)', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px' }}>
              {isCard ? '⚠️ Please enter complete credit/debit card details to proceed.' : '⚠️ Please enter your transaction code and check "I Have Completed the Payment" to enable order placement.'}
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn--danger" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={handleReviewOrder} disabled={loading || product.stock === 0 || !isPaymentValid}>
              Proceed to Confirmation →
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <OrderConfirmationModal
          items={[{ product, quantity: qty }]}
          totalAmount={totalAmount}
          paymentMethod={paymentMethod}
          cardDetails={cardState}
          customerName={user?.name || 'Valued Customer'}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleFinalOrderSubmit}
          loading={loading}
        />
      )}
    </>
  );
};

// ── Checkout Modal (For Cart) ───────────────────────────────────────
const CheckoutModal = ({ cart, user, onClose, onOrdered, clearCart }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY');
  const [transactionId, setTransactionId] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Credit Card Form State
  const [cardState, setCardState] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  const total = cart.items.reduce((acc, item) => acc + (Number(item.product.price) * item.quantity), 0);
  
  const isCard = paymentMethod === 'CARD';
  const isCardValid = !isCard || (
    cardState.cardNumber.replace(/\s+/g, '').length === 16 &&
    cardState.cardName.trim().length > 0 &&
    cardState.expiry.trim().length >= 5 &&
    cardState.cvv.trim().length >= 3
  );

  const isOnlineManual = paymentMethod === 'ESEWA' || paymentMethod === 'KHALTI';
  const isPaymentValid = isCard ? isCardValid : (!isOnlineManual || (transactionId.trim().length > 0 && paymentConfirmed));

  const handleReviewCheckout = () => {
    setErr('');
    if (isCard && !isCardValid) {
      setErr('Please fill out all Credit/Debit Card fields accurately (16-digit card number, name, expiry MM/YY, CVV).');
      return;
    }
    if (isOnlineManual && (!transactionId.trim() || !paymentConfirmed)) {
      setErr('Please complete the manual payment and enter your transaction code before placing the order.');
      return;
    }
    setShowConfirm(true);
  };

  const handleFinalCheckoutSubmit = async () => {
    setLoading(true); setErr('');
    try {
      const items = cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity }));
      let generatedTxId = transactionId.trim();
      if (isCard) {
        generatedTxId = `CARD-TEST-${Date.now()}-${cardState.cardNumber.slice(-4)}`;
      }

      const orderPayload = {
        payment_method: paymentMethod,
        ...(generatedTxId ? { transaction_id: generatedTxId } : {}),
      };

      await createOrder(items, orderPayload);
      if (clearCart) await clearCart();
      onOrdered();
      onClose();
    } catch (e) {
      setShowConfirm(false);
      setErr(e.response?.data?.message || 'Failed to place order.');
    } finally { setLoading(false); }
  };

  const handleWebPayStart = async () => {
    setErr('');
    try {
      const items = cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity }));
      const orderPayload = { payment_method: paymentMethod };
      const res = await createOrder(items, orderPayload);
      if (clearCart) await clearCart();
      onOrdered();
      return res.data.data.order.id;
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create order for payment.');
      return null;
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h3 className="modal-title">💳 Checkout</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>You are about to purchase {cart.items.length} items.</p>

          {err && <div className="error-msg">{err}</div>}

          <div className="form-field">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setErr(''); }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff', width: '100%', marginBottom: '16px' }}>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
              <option value="CARD">Credit/Debit Card</option>
              <option value="ESEWA">eSewa Mobile Wallet</option>
              <option value="KHALTI">Khalti Digital Wallet</option>
            </select>
          </div>

          {/* Online Payment Details Section */}
          {paymentMethod !== 'CASH_ON_DELIVERY' && (
            <OnlinePaymentSection
              paymentMethod={paymentMethod}
              onWebPayStart={handleWebPayStart}
              vendorPhone={cart.items[0]?.product?.vendor?.user?.phone || '+977 9841234567'}
              amount={total}
              transactionId={transactionId}
              setTransactionId={setTransactionId}
              paymentConfirmed={paymentConfirmed}
              setPaymentConfirmed={setPaymentConfirmed}
              cardState={cardState}
              setCardState={setCardState}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Grand Total</span>
            <span style={{ color: '#86efac', fontWeight: 700, fontSize: 22 }}>रू{fmt(total)}</span>
          </div>

          {!isPaymentValid && (
            <div style={{ fontSize: '12px', color: '#fde68a', background: 'rgba(253, 230, 138, 0.1)', border: '1px solid rgba(253, 230, 138, 0.2)', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px' }}>
              {isCard ? '⚠️ Please enter complete credit/debit card details to proceed.' : '⚠️ Please enter your transaction code and check "I Have Completed the Payment" to enable order placement.'}
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn--danger" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={handleReviewCheckout} disabled={loading || cart.items.length === 0 || !isPaymentValid}>
              Proceed to Confirmation →
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <OrderConfirmationModal
          items={cart.items}
          totalAmount={total}
          paymentMethod={paymentMethod}
          cardDetails={cardState}
          customerName={user?.name || 'Valued Customer'}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleFinalCheckoutSubmit}
          loading={loading}
        />
      )}
    </>
  );
};


// ── Main Component ────────────────────────────────────────────
const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('Browse Plants');
  const [products, setProducts]     = useState([]);
  const [orders, setOrders]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart]             = useState({ items: [] });
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [orderModal, setOrderModal] = useState(null);
  const [cancellationOrderModal, setCancellationOrderModal] = useState(null);
  const [toast, setToast]           = useState('');


  // Profile form
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', currentPassword: '', newPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg]         = useState('');
  const [profileErr, setProfileErr]         = useState('');

  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  const handleRetryPayment = async (orderId, paymentMethod) => {
    try {
      if (paymentMethod === 'ESEWA') {
        const res = await initiateEsewaPayment(orderId);
        const { payment_url, form_data } = res.data.data;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payment_url;
        form.target = '_blank';
        Object.entries(form_data).forEach(([k, v]) => {
          const inp = document.createElement('input');
          inp.type = 'hidden'; inp.name = k; inp.value = v;
          form.appendChild(inp);
        });
        document.body.appendChild(form);
        form.submit();
      } else if (paymentMethod === 'KHALTI') {
        const res = await initiateKhaltiPayment(orderId);
        const { payment_url } = res.data.data;
        window.open(payment_url, '_blank');
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to initiate payment.');
    }
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getProducts({ search, category: catFilter || undefined });
      setProducts(r.data.data.products);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, catFilter]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try { const r = await getMyOrders(); setOrders(r.data.data.orders); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadCart = useCallback(async () => {
    try { const r = await getCart(); setCart(r.data.data.cart); }
    catch { /* ignore */ }
  }, []);

  useEffect(() => {
    getPublicCategories().then((r) => setCategories(r.data.data.categories)).catch(() => {});
    loadCart(); // Load cart initially to show count if needed
  }, [loadCart]);

  useEffect(() => {
    if (tab === 'Browse Plants') loadProducts();
    if (tab === 'My Orders')    loadOrders();
    if (tab === 'My Cart')      loadCart();
  }, [tab, loadProducts, loadOrders, loadCart]);

  // debounce search
  useEffect(() => {
    if (tab !== 'Browse Plants') return;
    const t = setTimeout(() => loadProducts(), 400);
    return () => clearTimeout(t);
  }, [search, catFilter]); // eslint-disable-line

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleAddToCart = async (product) => {
    if (product.stock === 0) return;
    try {
      const r = await addToCart(product.id, 1);
      setCart(r.data.data.cart);
      showToast(`Added ${product.name} to cart!`);
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add to cart.');
    }
  };

  const handleUpdateCartItem = async (itemId, quantity) => {
    if (quantity < 1) return;
    try {
      const r = await updateCartItem(itemId, quantity);
      setCart(r.data.data.cart);
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update item.');
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      const r = await removeFromCart(itemId);
      setCart(r.data.data.cart);
    } catch (e) {
      showToast('Failed to remove item.');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true); setProfileMsg(''); setProfileErr('');
    try {
      await updateProfileAPI({ name: profile.name, phone: profile.phone, currentPassword: profile.currentPassword || undefined, newPassword: profile.newPassword || undefined });
      setProfileMsg('Profile updated successfully! 🎉');
      setProfile((p) => ({ ...p, currentPassword: '', newPassword: '' }));
    } catch (e) {
      setProfileErr(e.response?.data?.message || 'Update failed.');
    } finally { setProfileLoading(false); }
  };

  const cartTotal = cart.items.reduce((acc, item) => acc + (Number(item.product.price) * item.quantity), 0);

  return (
    <div className="dashboard-page">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: 8, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>{toast}</div>}
      
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <span className="logo-icon">🌿</span>
          <span className="logo-text">PlantMarket</span>
        </div>
        <div className="header-right">
          <span className="badge badge--customer">🛒 CUSTOMER</span>
          <button id="logout-btn" className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <div className="welcome-avatar welcome-avatar--customer">{user?.name?.charAt(0)?.toUpperCase() || 'C'}</div>
          <div className="welcome-info">
            <h2 className="welcome-name">Welcome, {user?.name}!</h2>
            <p className="welcome-email">{user?.email}</p>
            <span className="badge badge--customer">🛒 CUSTOMER</span>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'Browse Plants' && '🌱 '}
              {t === 'My Cart' && `🛒 (${cart.items.length}) `}
              {t === 'My Orders' && '📦 '}
              {t === 'My Profile' && '👤 '}
              {t}
            </button>
          ))}
        </div>

        {/* ── Browse Plants ── */}
        {tab === 'Browse Plants' && (
          <>
            <div className="section-header" style={{ marginBottom: 20 }}>
              <div className="search-bar">
                <span>🔍</span>
                <input placeholder="Search plants…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f0fdf4', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit' }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {loading && <div className="loading-state"><div className="spinner" /></div>}

            {!loading && products.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🌵</div>
                <p className="empty-text">No plants found. Try a different search.</p>
              </div>
            )}

            {!loading && products.length > 0 && (
              <div className="product-grid">
                {products.map((p) => (
                  <div key={p.id} className="product-card">
                    <div className="product-card-img">
                      {p.product_images?.[0]
                        ? <img
                            src={resolveImageUrl(p.product_images[0].image_url)}
                            alt={p.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.insertAdjacentText('afterend', plantEmoji(p.name));
                            }}
                          />
                        : plantEmoji(p.name)}
                    </div>
                    <div className="product-card-body">
                      <div className="product-card-name">{p.name}</div>
                      <div className="product-card-vendor">{p.vendor?.store_name}</div>
                      <div className="product-card-footer" style={{ marginBottom: '12px' }}>
                        <span className="product-card-price">रू{fmt(p.price)}</span>
                        {p.stock === 0
                          ? <span className="status-pill status-pill--rejected" style={{ fontSize: 10 }}>Out of Stock</span>
                          : <span className="product-card-stock">{p.stock} left</span>
                        }
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn--primary" 
                          style={{ flex: 1, padding: '8px', fontSize: '14px', background: 'var(--color-primary-dark)' }} 
                          disabled={p.stock === 0}
                          onClick={() => setOrderModal(p)}
                        >
                          Buy Now
                        </button>
                        <button 
                          className="btn btn--primary" 
                          style={{ flex: 1, padding: '8px', fontSize: '14px' }} 
                          disabled={p.stock === 0}
                          onClick={() => handleAddToCart(p)}
                        >
                          Add to Cart 🛒
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Cart ── */}
        {tab === 'My Cart' && (
          <div style={{ maxWidth: 800 }}>
            {cart.items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <p className="empty-text">Your cart is empty.</p>
                <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setTab('Browse Plants')}>
                  🌱 Browse Plants
                </button>
              </div>
            ) : (
              <>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20 }}>
                  <h3 className="section-title" style={{ marginBottom: 20 }}>Shopping Cart</h3>
                  
                  {cart.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ width: 60, height: 60, background: 'rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginRight: 16, overflow: 'hidden' }}>
                        {item.product.product_images?.[0]
                          ? <img src={resolveImageUrl(item.product.product_images[0].image_url)} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : plantEmoji(item.product.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#f0fdf4' }}>{item.product.name}</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>by {item.product.vendor?.store_name}</div>
                        <div style={{ color: '#86efac', fontWeight: 600, marginTop: 4 }}>रू{fmt(item.product.price)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px' }}>
                          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 8px' }} onClick={() => handleUpdateCartItem(item.id, item.quantity - 1)}>-</button>
                          <span style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 8px' }} onClick={() => handleUpdateCartItem(item.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock}>+</button>
                        </div>
                        <button style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleRemoveFromCart(item.id)}>
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Subtotal ({cart.items.length} items)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#86efac' }}>रू{fmt(cartTotal)}</div>
                    </div>
                    <button className="btn btn--primary" style={{ padding: '12px 24px', fontSize: 16 }} onClick={() => setCheckoutModal(true)}>
                      Proceed to Checkout ➔
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── My Orders ── */}
        {tab === 'My Orders' && (
          <>
            {loading && <div className="loading-state"><div className="spinner" /></div>}

            {!loading && orders.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p className="empty-text">You haven't placed any orders yet.</p>
                <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setTab('Browse Plants')}>
                  🌱 Browse Plants
                </button>
              </div>
            )}

            {!loading && orders.map((o) => (
              <div key={o.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <div className="order-id">Order #{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="order-date">{new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  <span className={statusPillClass(o.status)}>{o.status}</span>
                </div>
                <div className="order-items-list">
                  {o.order_items.map((i) => (
                    <div key={i.id}>{plantEmoji(i.product?.name)} {i.product?.name} × {i.quantity} — रू{fmt(Number(i.price) * i.quantity)}</div>
                  ))}
                </div>
                <div className="order-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{o.order_items.length} item{o.order_items.length !== 1 ? 's' : ''}</span>
                      {o.payment && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                          {getPaymentLabel(o)}
                          {isOnlinePayment(o.payment?.payment_method) && o.payment.payment_status === 'COMPLETED' && (
                            <span style={{ color: '#86efac', marginLeft: 6, fontSize: 11 }}>✓ Paid</span>
                          )}
                          {isOnlinePayment(o.payment?.payment_method) && o.payment.payment_status === 'PENDING' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
                              <span style={{ color: '#fde68a', fontSize: 11 }}>⏳ Payment Pending</span>
                              <button
                                type="button"
                                onClick={() => handleRetryPayment(o.id, o.payment.payment_method)}
                                style={{
                                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                  border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px',
                                  fontWeight: 'bold', padding: '3px 8px', marginLeft: '12px', cursor: 'pointer',
                                }}
                              >
                                Pay Now ➔
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="order-total">Total: रू{fmt(o.total_amount)}</span>
                  </div>

                  {/* Refund status banner if applicable */}
                  {o.payment?.refund_status && (
                    <div style={{ fontSize: 12, padding: '6px 12px', borderRadius: '6px', background: o.payment.refund_status === 'REFUNDED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${o.payment.refund_status === 'REFUNDED' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, color: o.payment.refund_status === 'REFUNDED' ? '#6ee7b7' : '#fef08a' }}>
                      {o.payment.refund_status === 'REFUNDED' ? (
                        <>✅ Refund Completed {o.payment.refund_reference ? `(Ref: ${o.payment.refund_reference})` : ''}</>
                      ) : (
                        <>🔄 Refund Pending processing by admin</>
                      )}
                    </div>
                  )}

                  {/* Action buttons (Cancellation) */}
                  {['PENDING', 'PROCESSING'].includes(o.status) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        className="btn btn--danger"
                        style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={() => setCancellationOrderModal(o)}
                      >
                        {o.payment?.payment_method === 'CASH_ON_DELIVERY' ? '🚫 Cancel Order' : '⏳ Request Cancellation'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── About Us ── */}
        {tab === 'About Us' && (
          <div>
            <div className="about-hero">
              <h2 className="about-title">🌱 Welcome to PlantMarket</h2>
              <p className="about-subtitle">
                Nepal's premier multi-vendor e-commerce platform dedicated to connecting plant lovers with local nurseries and passionate plant growers across the nation.
              </p>
            </div>

            <div className="about-grid">
              <div className="about-card">
                <div className="about-card-icon">🌿</div>
                <h3 className="about-card-title">Our Mission</h3>
                <p className="about-card-text">
                  To bring nature into every home and workplace by empowering local plant vendors and offering customers healthy, beautifully cultivated flora delivered with care.
                </p>
              </div>

              <div className="about-card">
                <div className="about-card-icon">🏪</div>
                <h3 className="about-card-title">Empowering Local Vendors</h3>
                <p className="about-card-text">
                  We give independent nurseries and independent growers the digital tools to showcase their plants, manage inventory, and grow their businesses online.
                </p>
              </div>

              <div className="about-card">
                <div className="about-card-icon">💚</div>
                <h3 className="about-card-title">Quality Assurance</h3>
                <p className="about-card-text">
                  Every vendor on PlantMarket is verified to guarantee healthy plants, accurate listings, reliable packaging, and attentive customer service.
                </p>
              </div>
            </div>

            <div className="support-section">
              <h3 className="support-section-title">✨ Why Choose PlantMarket?</h3>
              <ul style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
                <li>Wide variety of indoor plants, succulents, flowering plants, and gardening supplies</li>
                <li>Direct support for local Nepalese green businesses and nurseries</li>
                <li>Secure online payments via eSewa and Khalti, or convenient Cash on Delivery</li>
                <li>Transparent order tracking and buyer protection policies</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Customer Support ── */}
        {tab === 'Customer Support' && (
          <div>
            <div className="about-hero" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
              <h2 className="about-title" style={{ color: '#c4b5fd' }}>🎧 Customer Support & Help Center</h2>
              <p className="about-subtitle">
                Have questions or need help with your order? Our support team is here to assist you every step of the way.
              </p>
            </div>

            <div className="about-grid">
              <div className="about-card">
                <div className="about-card-icon">📧</div>
                <h3 className="about-card-title">Email Support</h3>
                <p className="about-card-text">
                  Send us an email anytime and we will respond within 24 hours.<br />
                  <strong style={{ color: '#86efac', display: 'inline-block', marginTop: 8 }}>plantmarket000@gmail.com</strong>
                </p>
              </div>

              <div className="about-card">
                <div className="about-card-icon">📞</div>
                <h3 className="about-card-title">Phone Support</h3>
                <p className="about-card-text">
                  Speak directly with our support representatives.<br />
                  <strong style={{ color: '#86efac', display: 'inline-block', marginTop: 8 }}>+977 9841234567</strong><br />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Mon – Sat, 9:00 AM – 6:00 PM</span>
                </p>
              </div>

              <div className="about-card">
                <div className="about-card-icon">🔄</div>
                <h3 className="about-card-title">Cancellation & Refunds</h3>
                <p className="about-card-text">
                  COD orders can be cancelled directly before shipping. Prepaid orders require admin approval with full refunds returned to your original payment method.
                </p>
              </div>
            </div>

            <div className="support-section">
              <h3 className="support-section-title">❓ Frequently Asked Questions</h3>
              <div className="faq-item">
                <div className="faq-q">How do I cancel my order?</div>
                <div className="faq-a">Go to the "My Orders" tab. If your order is in PENDING or PROCESSING status, you will see a "Cancel Order" or "Request Cancellation" button. COD orders are cancelled instantly, while prepaid orders are reviewed by our team.</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">How long do refunds take for prepaid orders?</div>
                <div className="faq-a">Once your cancellation request is approved by an admin, the refund status will change to "Refund Pending". Funds are processed back to your eSewa/Khalti/Card account within 2–5 business days.</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">What payment methods do you accept?</div>
                <div className="faq-a">We accept Cash on Delivery (COD), eSewa Mobile Wallet, Khalti Digital Wallet, and Credit/Debit cards.</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">What if my plant arrives damaged?</div>
                <div className="faq-a">Please take a photo of the damaged plant upon arrival and email it along with your Order ID to plantmarket000@gmail.com within 24 hours for a free replacement or refund.</div>
              </div>
            </div>
          </div>
        )}

        {/* ── My Profile ── */}
        {tab === 'My Profile' && (
          <div style={{ maxWidth: 480 }}>
            <h3 className="section-title" style={{ marginBottom: 20 }}>👤 My Profile</h3>
            {profileMsg && <div className="info-banner info-banner--green" style={{ marginBottom: 16 }}><span>✅</span><p>{profileMsg}</p></div>}
            {profileErr && <div className="error-msg">{profileErr}</div>}
            <form onSubmit={handleProfileSave}>
              <div className="form-field">
                <label>Full Name</label>
                <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input value={user?.email} disabled style={{ opacity: 0.5 }} />
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+977 …" />
              </div>
              <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>Change password (leave blank to keep current)</p>
              <div className="form-field">
                <label>Current Password</label>
                <input type="password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} />
              </div>
              <div className="form-field">
                <label>New Password</label>
                <input type="password" value={profile.newPassword} onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })} />
              </div>
              <button type="submit" className="btn btn--primary" disabled={profileLoading}>
                {profileLoading ? 'Saving…' : '💾 Save Changes'}
              </button>
            </form>
          </div>
        )}
      </main>

      {checkoutModal && (
        <CheckoutModal
          cart={cart}
          user={user}
          onClose={() => setCheckoutModal(false)}
          onOrdered={() => { setCheckoutModal(false); setTab('My Orders'); loadOrders(); }}
        />
      )}

      {orderModal && (
        <OrderModal
          product={orderModal}
          user={user}
          onClose={() => setOrderModal(null)}
          onOrdered={() => { setOrderModal(null); setTab('My Orders'); }}
        />
      )}

      {cancellationOrderModal && (
        <CancellationModal
          order={cancellationOrderModal}
          onClose={() => setCancellationOrderModal(null)}
          onSuccess={() => {
            setCancellationOrderModal(null);
            loadOrders();
          }}
        />
      )}


    </div>
  );
};

export default CustomerDashboard;
