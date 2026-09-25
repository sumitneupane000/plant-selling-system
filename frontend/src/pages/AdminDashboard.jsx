import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getAdminStats, getAdminUsers, getAdminVendors, verifyVendor,
  getAdminProducts, deleteAdminProduct, getAdminOrders, getAdminCategories,
  createAdminCategory, deleteAdminCategory,
  getAdminCancelledOrders, approveCancellation, rejectCancellation, markRefundCompleted,
} from '../api/adminAPI.js';
import { getPaymentLabel, isOnlinePayment } from '../utils/paymentUtils.js';
import '../styles/dashboard.css';

const TABS = ['Overview', 'Users', 'Vendors', 'Products', 'Orders', 'Cancelled Orders', 'Categories'];

const statusPillClass = (s) => {
  const map = {
    PENDING: 'status-pill--pending', APPROVED: 'status-pill--approved',
    REJECTED: 'status-pill--rejected', PROCESSING: 'status-pill--processing',
    SHIPPED: 'status-pill--shipped', DELIVERED: 'status-pill--delivered',
    CANCELLED: 'status-pill--cancelled', CANCELLATION_REQUESTED: 'status-pill--cancellation-requested',
  };
  return `status-pill ${map[s] || 'status-pill--pending'}`;
};


const fmt = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ── Category modal ──────────────────────────────────────────
const CategoryModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await createAdminCategory(form);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create category.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">➕ New Category</h3>
        {err && <div className="error-msg">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--danger" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Admin Product Deletion Modal (2-step) ─────────────────────────────────
const DeleteProductModal = ({ product, onClose, onDeleted }) => {
  const [step, setStep] = useState(1); // 1 = enter reason, 2 = final confirm
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr('Please provide a reason for deleting this product.');
      return;
    }
    setErr('');
    setStep(2);
  };

  const handleConfirmDelete = async () => {
    if (loading) return; // prevent duplicate
    setLoading(true); setErr('');
    try {
      await deleteAdminProduct(product.id, reason.trim());
      onDeleted(product.id);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to delete product.');
      setStep(1); // go back if error
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={!loading ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>

        {/* ── Step 1: Enter Reason ── */}
        {step === 1 && (
          <>
            <h3 className="modal-title" style={{ color: '#fca5a5' }}>🗑 Delete Product</h3>
            <p style={{ color: '#f0fdf4', marginBottom: '12px', fontSize: '14px' }}>
              You are about to delete <strong>"{product.name}"</strong> by{' '}
              <em>{product.vendor?.store_name || 'Vendor'}</em>.
            </p>

            {err && <div className="error-msg">{err}</div>}

            <form onSubmit={handleProceedToConfirm}>
              <div className="form-field">
                <label style={{ color: '#fca5a5', fontWeight: 600 }}>Reason for Deletion *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Policy violation, incorrect information, or illegal listing..."
                  rows={4}
                  required
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid rgba(252, 165, 165, 0.4)',
                    background: 'rgba(0,0,0,0.4)', color: '#fff',
                    marginTop: '4px', fontFamily: 'inherit', fontSize: '13px',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', display: 'block' }}>
                  ℹ️ An email with this reason will be sent to the vendor's inbox.
                </span>
              </div>
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn" onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Cancel</button>
                <button type="submit" className="btn btn--danger" disabled={!reason.trim()}>
                  Next: Confirm →
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 2: Final Confirmation ── */}
        {step === 2 && (
          <>
            <h3 className="modal-title" style={{ color: '#fca5a5' }}>⚠️ Final Confirmation</h3>
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '10px', padding: '16px', marginBottom: '16px',
            }}>
              <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '15px', margin: '0 0 8px' }}>
                Are you sure you want to permanently delete this product?
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 8px' }}>
                <strong style={{ color: '#fff' }}>"{product.name}"</strong> will be removed from the platform immediately. This action cannot be undone.
              </p>
              <div style={{
                background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px 12px',
                borderLeft: '3px solid rgba(252,165,165,0.6)', marginTop: '10px',
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Deletion reason:</span>
                <p style={{ color: '#fde68a', fontSize: '13px', margin: '4px 0 0', fontStyle: 'italic' }}>"{reason}"</p>
              </div>
            </div>

            {err && <div className="error-msg">{err}</div>}

            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setStep(1)}
                disabled={loading}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? 'Deleting…' : '🗑 Yes, Permanently Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('Overview');
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [vendors, setVendors]   = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders]          = useState([]);
  const [cancelledOrders, setCancelledOrders] = useState([]);
  const [categories, setCategories]  = useState([]);
  const [loading, setLoading]        = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [deleteProductModal, setDeleteProductModal] = useState(null);
  const [rejectModalOrder, setRejectModalOrder] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [refundModalOrder, setRefundModalOrder] = useState(null);
  const [refundRefInput, setRefundRefInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [verifying, setVerifying]    = useState({});
  const [search, setSearch]        = useState('');

  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  const handleProductDeleted = (deletedId) => {
    setProducts((ps) => ps.filter((p) => p.id !== deletedId));
    setStats((st) => st ? { ...st, products: Math.max(0, st.products - 1) } : null);
  };

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      if (t === 'Overview')         { const r = await getAdminStats();           setStats(r.data.data); }
      if (t === 'Users')            { const r = await getAdminUsers();           setUsers(r.data.data.users); }
      if (t === 'Vendors')          { const r = await getAdminVendors();         setVendors(r.data.data.vendors); }
      if (t === 'Products')         { const r = await getAdminProducts();        setProducts(r.data.data.products); }
      if (t === 'Orders')           { const r = await getAdminOrders();          setOrders(r.data.data.orders); }
      if (t === 'Cancelled Orders') { const r = await getAdminCancelledOrders(); setCancelledOrders(r.data.data.orders); }
      if (t === 'Categories')       { const r = await getAdminCategories();      setCategories(r.data.data.categories); }
    } catch { /* errors shown inline */ }
    finally { setLoading(false); }
  }, []);

  const [approveModalOrder, setApproveModalOrder] = useState(null);

  const handleApproveCancellation = async () => {
    if (!approveModalOrder) return;
    setActionLoading(true);
    try {
      await approveCancellation(approveModalOrder.id);
      setApproveModalOrder(null);
      load('Cancelled Orders');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve cancellation.');
    } finally {
      setActionLoading(false);
    }
  };


  const handleRejectCancellation = async () => {
    if (!rejectModalOrder) return;
    setActionLoading(true);
    try {
      await rejectCancellation(rejectModalOrder.id, rejectNote);
      setRejectModalOrder(null);
      setRejectNote('');
      load('Cancelled Orders');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject cancellation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkRefundCompleted = async () => {
    if (!refundModalOrder) return;
    setActionLoading(true);
    try {
      await markRefundCompleted(refundModalOrder.id, refundRefInput);
      setRefundModalOrder(null);
      setRefundRefInput('');
      load('Cancelled Orders');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark refund completed.');
    } finally {
      setActionLoading(false);
    }
  };


  useEffect(() => { load(tab); }, [tab, load]);

  const handleVerify = async (vendorId, status) => {
    setVerifying((v) => ({ ...v, [vendorId]: true }));
    try {
      await verifyVendor(vendorId, status);
      setVendors((vs) => vs.map((v) => v.id === vendorId ? { ...v, verification_status: status } : v));
    } catch { /* ignore */ }
    finally { setVerifying((v) => ({ ...v, [vendorId]: false })); }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    await deleteAdminCategory(id);
    setCategories((cs) => cs.filter((c) => c.id !== id));
  };

  const filtered = (arr, keys) => arr.filter((item) =>
    keys.some((k) => String(item[k] ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <span className="logo-icon">🌿</span>
          <span className="logo-text">PlantMarket</span>
        </div>
        <div className="header-right">
          <span className="badge badge--admin">⚙ ADMIN</span>
          <button id="logout-btn" className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Welcome */}
        <div className="welcome-card">
          <div className="welcome-avatar welcome-avatar--admin">{user?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
          <div className="welcome-info">
            <h2 className="welcome-name">Welcome, Platform Administrator!</h2>
            <p className="welcome-email">{user?.email}</p>
            <span className="badge badge--admin">⚙ ADMIN</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setSearch(''); }}>
              {t === 'Overview' && '📊 '}
              {t === 'Users' && '👥 '}
              {t === 'Vendors' && '🏪 '}
              {t === 'Products' && '🌱 '}
              {t === 'Orders' && '📦 '}
              {t === 'Cancelled Orders' && '🚫 '}
              {t === 'Categories' && '🏷 '}
              {t}
            </button>
          ))}
        </div>

        {loading && <div className="loading-state"><div className="spinner" /><p>Loading…</p></div>}

        {/* ── Overview ── */}
        {!loading && tab === 'Overview' && (
          stats ? (
            <div className="stat-grid">
              <div className="stat-card stat-card--green">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.users}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card stat-card--blue">
                <div className="stat-icon">🏪</div>
                <div className="stat-value">{stats.vendors}</div>
                <div className="stat-label">Total Vendors</div>
              </div>
              <div className="stat-card stat-card--warning">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{stats.pendingVendors}</div>
                <div className="stat-label">Pending Approval</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🌱</div>
                <div className="stat-value">{stats.products}</div>
                <div className="stat-label">Products Listed</div>
              </div>
              <div className="stat-card stat-card--purple">
                <div className="stat-icon">📦</div>
                <div className="stat-value">{stats.orders}</div>
                <div className="stat-label">Total Orders</div>
              </div>
              <div className="stat-card stat-card--warning">
                <div className="stat-icon">🚫</div>
                <div className="stat-value">{stats.cancelledOrders ?? 0}</div>
                <div className="stat-label">Cancelled / Requests</div>
              </div>
              <div className="stat-card stat-card--warning">
                <div className="stat-icon">🔄</div>
                <div className="stat-value">{stats.refundPending ?? 0}</div>
                <div className="stat-label">Refunds Pending</div>
              </div>
              <div className="stat-card stat-card--green">
                <div className="stat-icon">💰</div>
                <div className="stat-value">रू{fmt(stats.revenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p className="empty-text">Failed to load platform statistics.</p>
              <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => load('Overview')}>
                🔄 Retry
              </button>
            </div>
          )
        )}


        {/* ── Users ── */}
        {!loading && tab === 'Users' && (
          <>
            <div className="section-header">
              <h3 className="section-title">All Users ({users.length})</h3>
              <div className="search-bar">
                <span>🔍</span>
                <input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {filtered(users, ['name', 'email', 'role']).map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge--${u.role.toLowerCase()}`}>{u.role}</span></td>
                      <td>{u.phone || '—'}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filtered(users, ['name', 'email', 'role']).length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Vendors ── */}
        {!loading && tab === 'Vendors' && (
          <>
            <div className="section-header">
              <h3 className="section-title">All Vendors ({vendors.length})</h3>
              <div className="search-bar">
                <span>🔍</span>
                <input placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Store</th><th>Owner</th><th>Email</th><th>Products</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered(vendors, ['store_name']).filter((v) =>
                    v.store_name?.toLowerCase().includes(search.toLowerCase()) ||
                    v.user?.name?.toLowerCase().includes(search.toLowerCase())
                  ).map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.store_name}</strong></td>
                      <td>{v.user?.name}</td>
                      <td>{v.user?.email}</td>
                      <td>{v._count?.products ?? 0}</td>
                      <td><span className={statusPillClass(v.verification_status)}>{v.verification_status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {v.verification_status !== 'APPROVED' && (
                            <button className="btn btn--approve" disabled={verifying[v.id]} onClick={() => handleVerify(v.id, 'APPROVED')}>Approve</button>
                          )}
                          {v.verification_status !== 'REJECTED' && (
                            <button className="btn btn--reject" disabled={verifying[v.id]} onClick={() => handleVerify(v.id, 'REJECTED')}>Reject</button>
                          )}
                          {v.verification_status !== 'PENDING' && (
                            <button className="btn btn--edit" disabled={verifying[v.id]} onClick={() => handleVerify(v.id, 'PENDING')}>Reset</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>No vendors yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Products ── */}
        {!loading && tab === 'Products' && (
          <>
            <div className="section-header">
              <h3 className="section-title">All Products ({products.length})</h3>
              <div className="search-bar">
                <span>🔍</span>
                <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Product</th><th>Vendor</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {products.filter((p) =>
                    p.name?.toLowerCase().includes(search.toLowerCase()) ||
                    p.vendor?.store_name?.toLowerCase().includes(search.toLowerCase())
                  ).map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.vendor?.store_name || '—'}</td>
                      <td>{p.category?.name || '—'}</td>
                      <td style={{ color: '#86efac' }}>रू{fmt(p.price)}</td>
                      <td>
                        <span style={{ color: p.stock === 0 ? '#fca5a5' : p.stock < 5 ? '#fde68a' : 'inherit' }}>
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn--danger"
                          style={{ fontSize: '12px', padding: '5px 12px' }}
                          onClick={() => setDeleteProductModal(p)}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>No products yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Orders ── */}
        {!loading && tab === 'Orders' && (
          <>
            <div className="section-header">
              <h3 className="section-title">All Orders ({orders.length})</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{o.id.slice(0, 8)}…</td>
                      <td><strong>{o.user?.name}</strong><br /><span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{o.user?.email}</span></td>
                      <td>{o.order_items?.map((i) => i.product?.name).join(', ')}</td>
                      <td style={{ color: '#86efac', fontWeight: 600 }}>रू{fmt(o.total_amount)}</td>
                      <td style={{ fontSize: 13 }}>
                        {isOnlinePayment(o.payment?.payment_method) ? (
                          <span style={{ color: '#a78bfa' }}>{getPaymentLabel(o)}</span>
                        ) : (
                          <span style={{ color: o.status === 'DELIVERED' ? '#86efac' : 'rgba(255,255,255,0.7)' }}>
                            {getPaymentLabel(o)}
                          </span>
                        )}
                      </td>
                      <td><span className={statusPillClass(o.status)}>{o.status}</span></td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>No orders yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Cancelled Orders ── */}
        {!loading && tab === 'Cancelled Orders' && (
          <>
            <div className="section-header">
              <h3 className="section-title">Cancelled & Refund Requests ({cancelledOrders.length})</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Reason</th>
                    <th>Total</th>
                    <th>Payment / Refund</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledOrders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{o.id.slice(0, 8)}…</td>
                      <td>
                        <strong>{o.user?.name}</strong><br />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{o.user?.email}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#fde68a' }}>{o.cancellation_reason || '—'}</strong>
                        {o.cancellation_detail && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{o.cancellation_detail}</div>
                        )}
                        {(() => {
                          let evs = [];
                          try { if (o.cancellation_evidence) evs = JSON.parse(o.cancellation_evidence); } catch { evs = []; }
                          return evs.length > 0 ? (
                            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {evs.map((e, idx) => (
                                <a key={idx} href={`http://localhost:5000${e}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'underline' }}>
                                  📎 Evidence #{idx + 1}
                                </a>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        {o.audit_logs?.length > 0 && (
                          <details style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                            <summary style={{ cursor: 'pointer', color: '#a78bfa' }}>📜 Audit History ({o.audit_logs.length})</summary>
                            <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 4 }}>
                              {o.audit_logs.map((log) => (
                                <div key={log.id} style={{ marginBottom: 4, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 2 }}>
                                  <strong>[{log.actor_role}]</strong> {log.action}: {log.from_state} ➔ {log.to_state} ({new Date(log.created_at).toLocaleTimeString()})
                                  {log.note && <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>"{log.note}"</div>}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>
                      <td style={{ color: '#86efac', fontWeight: 600 }}>रू{fmt(o.total_amount)}</td>
                      <td>
                        <div style={{ fontSize: '12px' }}>
                          <strong>{getPaymentLabel(o)}</strong>
                          {o.payment?.refund_status && (
                            <div style={{ marginTop: 4 }}>
                              <span className={`status-pill ${o.payment.refund_status === 'REFUNDED' ? 'status-pill--refunded' : 'status-pill--refund-pending'}`}>
                                {o.payment.refund_status}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={statusPillClass(o.status)}>{o.status}</span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(o.status === 'CANCELLATION_REQUESTED' || o.cancellation_status === 'REQUESTED') && (
                            <>
                              <button
                                className="btn btn--approve"
                                disabled={actionLoading}
                                onClick={() => setApproveModalOrder(o)}
                              >
                                ✓ Approve
                              </button>

                              <button
                                className="btn btn--reject"
                                disabled={actionLoading}
                                onClick={() => setRejectModalOrder(o)}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}

                          {o.payment?.refund_status === 'REFUND_PENDING' && (
                            <button
                              className="btn btn--primary btn--sm"
                              disabled={actionLoading}
                              onClick={() => { setRefundModalOrder(o); setRefundRefInput(`REF-${Date.now().toString().slice(-6)}`); }}
                            >
                              💸 Mark Refunded
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cancelledOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>
                        No cancelled orders or cancellation requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Categories ── */}
        {!loading && tab === 'Categories' && (
          <>
            <div className="section-header">
              <h3 className="section-title">Categories ({categories.length})</h3>
              <button className="btn btn--purple" onClick={() => setShowCatModal(true)}>➕ Add Category</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Description</th><th>Products</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.description || '—'}</td>
                      <td>{c._count?.products ?? 0}</td>
                      <td>
                        <button className="btn btn--danger" onClick={() => handleDeleteCategory(c.id)} disabled={c._count?.products > 0}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px' }}>No categories yet. Add one to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {showCatModal && (
          <CategoryModal onClose={() => setShowCatModal(false)} onCreated={() => load('Categories')} />
        )}

        {deleteProductModal && (
          <DeleteProductModal
            product={deleteProductModal}
            onClose={() => setDeleteProductModal(null)}
            onDeleted={handleProductDeleted}
          />
        )}

        {approveModalOrder && (
          <div className="modal-overlay" onClick={() => setApproveModalOrder(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', border: '1px solid rgba(134,239,172,0.3)' }}>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '36px' }}>🌱</span>
                <h3 className="modal-title" style={{ margin: '8px 0 4px', fontSize: '20px' }}>Approve Cancellation Request?</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px', textAlign: 'center' }}>
                Approve this cancellation request? The order will be marked <strong style={{ color: '#fca5a5' }}>CANCELLED</strong>, stock will be <strong style={{ color: '#86efac' }}>restored</strong>, and refund marked as <strong style={{ color: '#fde68a' }}>PENDING</strong>.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Order ID:</span>
                  <span style={{ color: '#fff', fontFamily: 'monospace' }}>#{approveModalOrder.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Customer:</span>
                  <span style={{ color: '#fff' }}>{approveModalOrder.user?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Total Amount:</span>
                  <span style={{ color: '#86efac', fontWeight: 700 }}>रू {fmt(approveModalOrder.total_amount)}</span>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn--danger" onClick={() => setApproveModalOrder(null)} disabled={actionLoading}>
                  Back
                </button>
                <button className="btn btn--primary" onClick={handleApproveCancellation} disabled={actionLoading}>
                  {actionLoading ? 'Approving…' : '✅ Approve Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {rejectModalOrder && (

          <div className="modal-overlay" onClick={() => setRejectModalOrder(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <h3 className="modal-title">✕ Reject Cancellation Request</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '14px' }}>
                Order #{rejectModalOrder.id.slice(0, 8).toUpperCase()} will revert to PROCESSING. You can provide an optional note to the customer.
              </p>
              <div className="form-field">
                <label>Rejection Reason / Note (Optional)</label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Item has already been packaged and dispatched…"
                />
              </div>
              <div className="form-actions">
                <button className="btn btn--danger" onClick={() => setRejectModalOrder(null)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleRejectCancellation} disabled={actionLoading}>
                  {actionLoading ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {refundModalOrder && (
          <div className="modal-overlay" onClick={() => setRefundModalOrder(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <h3 className="modal-title">💸 Complete Refund</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '14px' }}>
                Enter the bank / wallet refund transaction reference for Order #{refundModalOrder.id.slice(0, 8).toUpperCase()} (Amount: रू {fmt(refundModalOrder.total_amount)}).
              </p>
              <div className="form-field">
                <label>Refund Reference ID / Txn Code *</label>
                <input
                  value={refundRefInput}
                  onChange={(e) => setRefundRefInput(e.target.value)}
                  placeholder="e.g. ESEWA-REF-998823"
                  required
                />
              </div>
              <div className="form-actions">
                <button className="btn btn--danger" onClick={() => setRefundModalOrder(null)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleMarkRefundCompleted} disabled={actionLoading || !refundRefInput}>
                  {actionLoading ? 'Saving…' : 'Mark as Refunded'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;

