import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminOrders, callEdge } from '../../lib/api.js';
import { formatRWF, formatDate, statusBadge, shortToken, getParam, setParams, toast, initTheme } from '../../lib/utils.js';
import { pageUrl } from '../../lib/paths.js';
import { supabase } from '../../lib/supabase.js';

initTheme();
renderAdminShell('Orders', renderPage);

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'awaiting_payment_submission', label: 'Awaiting Payment' },
  { value: 'awaiting_payment_verification', label: 'Needs Verification' },
  { value: 'payment_verified', label: 'Verified' },
  { value: 'packed', label: 'Packed' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

let currentStatus = getParam('status') || '';
let currentPage = parseInt(getParam('page') || '1');
const PAGE_SIZE = 20;

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Orders</h1>
      </div>

      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-6);justify-content:space-between">
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          ${STATUSES.map(s => `
            <button class="btn btn-sm ${currentStatus === s.value ? 'btn-primary' : 'btn-secondary'} status-filter-btn" data-status="${s.value}">
              ${s.label}
            </button>
          `).join('')}
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-sm btn-secondary" id="export-csv-btn">Export CSV</button>
          <button class="btn btn-sm btn-secondary" id="export-pdf-btn">Export PDF</button>
        </div>
      </div>

      <div id="orders-table"></div>
      <div id="orders-pagination" style="margin-top:var(--space-6)"></div>
    </div>
  `;

  container.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStatus = btn.dataset.status;
      currentPage = 1;
      setParams({ status: currentStatus || null, page: null });
      container.querySelectorAll('.status-filter-btn').forEach(b => {
        b.classList.toggle('btn-primary', b.dataset.status === currentStatus);
        b.classList.toggle('btn-secondary', b.dataset.status !== currentStatus);
      });
      loadOrders(container);
    });
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => exportOrders('csv'));
  document.getElementById('export-pdf-btn')?.addEventListener('click', () => exportOrders('pdf'));

  loadOrders(container);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function fetchAllOrdersForExport() {
  let query = supabase
    .from('orders')
    .select(`
      public_token, status, payment_status, total_cents, created_at,
      customers(full_name, email, guest_name, guest_email, is_guest),
      payment_channels:payment_channel_id(name)
    `)
    .order('created_at', { ascending: false });
  if (currentStatus) query = query.eq('status', currentStatus);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function exportOrders(format) {
  const btn = document.getElementById(format === 'csv' ? 'export-csv-btn' : 'export-pdf-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    const orders = await fetchAllOrdersForExport();
    if (!orders.length) { toast.info('No orders to export.'); return; }

    const rows = orders.map(o => {
      const c = o.customers;
      const name = c?.is_guest ? (c?.guest_name || '') : (c?.full_name || '');
      const email = c?.is_guest ? (c?.guest_email || '') : (c?.email || '');
      return {
        order: `#${shortToken(o.public_token)}`,
        customer: name,
        email,
        date: formatDate(o.created_at),
        status: o.status.replace(/_/g, ' '),
        payment: o.payment_channels?.name || '—',
        total: (o.total_cents / 100).toLocaleString() + ' RWF',
      };
    });

    if (format === 'csv') {
      const headers = ['Order', 'Customer', 'Email', 'Date', 'Status', 'Payment', 'Total'];
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers.map(escape).join(','), ...rows.map(r => Object.values(r).map(escape).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cent-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('CENT — Orders Export', 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated ${new Date().toLocaleString()}${currentStatus ? ` — filtered: ${currentStatus.replace(/_/g, ' ')}` : ''}`, 14, 21);
      doc.autoTable({
        startY: 26,
        head: [['Order', 'Customer', 'Email', 'Date', 'Status', 'Payment', 'Total']],
        body: rows.map(r => Object.values(r)),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [20, 20, 20] },
      });
      doc.save(`cent-orders-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
    toast.success(`Exported ${orders.length} order${orders.length !== 1 ? 's' : ''}.`);
  } catch (err) {
    console.error('exportOrders:', err);
    toast.error('Export failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function loadOrders(container) {
  const tableEl = document.getElementById('orders-table');
  const pagEl = document.getElementById('orders-pagination');
  tableEl.innerHTML = '<div class="skeleton skeleton-rows"></div>';

  try {
    const offset = (currentPage - 1) * PAGE_SIZE;
    const { orders, total } = await getAdminOrders({ status: currentStatus || undefined, limit: PAGE_SIZE, offset });
    const hasMore = total > offset + PAGE_SIZE;
    const rows = orders;

    if (!rows.length) {
      tableEl.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h3>No orders found</h3>
            <p>${currentStatus ? 'No orders match this filter. Try a different status.' : 'Orders will appear here once customers start placing them.'}</p>
          </div>
        </div>
      `;
      pagEl.innerHTML = '';
      return;
    }

    tableEl.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Payment</th><th>Total</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(o => `
              <tr>
                <td data-label="Order"><span class="font-mono" style="font-size:var(--text-xs)">#${shortToken(o.public_token)}</span></td>
                <td data-label="Customer">
                  <div style="font-size:var(--text-sm)">${o.customers?.full_name || '—'}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted)">${o.customers?.email || ''}</div>
                </td>
                <td data-label="Date" style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(o.created_at)}</td>
                <td data-label="Status">${statusBadge(o.status)}</td>
                <td data-label="Payment" style="font-size:var(--text-xs);color:var(--text-muted)">${o.payment_channels?.name || '—'}</td>
                <td data-label="Total" style="font-weight:700;font-size:var(--text-sm)">${formatRWF(o.total_cents)}</td>
                <td data-label="Actions"><a href="${pageUrl('admin/order-detail/')}?token=${o.public_token}" class="btn btn-secondary btn-sm">View</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    pagEl.innerHTML = `
      <div style="display:flex;gap:var(--space-2);align-items:center">
        ${currentPage > 1 ? `<button class="btn btn-secondary btn-sm" id="prev-page">← Prev</button>` : ''}
        <span style="font-size:var(--text-sm);color:var(--text-muted)">Page ${currentPage}</span>
        ${hasMore ? `<button class="btn btn-secondary btn-sm" id="next-page">Next →</button>` : ''}
      </div>
    `;

    document.getElementById('prev-page')?.addEventListener('click', () => { currentPage--; setParams({ page: currentPage }); loadOrders(container); });
    document.getElementById('next-page')?.addEventListener('click', () => { currentPage++; setParams({ page: currentPage }); loadOrders(container); });
  } catch (err) {
    console.error('loadOrders:', err);
    tableEl.innerHTML = '<p style="color:var(--text-muted)">Could not load orders.</p>';
  }
}
