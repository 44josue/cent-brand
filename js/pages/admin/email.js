import { renderAdminShell } from '../../components/admin-shell.js';
import { supabase } from '../../lib/supabase.js';
import { toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Email', renderPage);

const TEMPLATES = {
  custom: {
    label: 'Custom',
    subject: '',
    body: '',
  },
  promotion: {
    label: 'Promotion',
    subject: '🔥 Exclusive Deal — Don\'t Miss Out',
    body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden">
  <div style="background:#111;padding:32px;text-align:center;border-bottom:1px solid #222">
    <h1 style="font-size:28px;font-weight:900;letter-spacing:0.15em;margin:0;color:#fff">CENT</h1>
  </div>
  <div style="padding:40px 32px">
    <h2 style="font-size:22px;font-weight:700;margin:0 0 16px">🔥 Limited Time Offer</h2>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Hey,</p>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">We're running an exclusive deal just for you. Use the promo code below at checkout:</p>
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
      <span style="font-size:28px;font-weight:900;letter-spacing:0.2em;color:#fff">SAVE20</span>
      <p style="color:#aaa;font-size:13px;margin:8px 0 0">20% off your entire order • Expires soon</p>
    </div>
    <a href="https://cent.rw/products/" style="display:inline-block;background:#fff;color:#000;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px">Shop Now →</a>
  </div>
  <div style="padding:24px 32px;border-top:1px solid #222;text-align:center;font-size:12px;color:#555">
    <p>CENT Streetwear · Kigali, Rwanda</p>
    <p><a href="https://cent.rw" style="color:#777">cent.rw</a></p>
  </div>
</div>`,
  },
  newsletter: {
    label: 'Newsletter',
    subject: 'CENT Dispatch — What\'s New This Month',
    body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden">
  <div style="background:#111;padding:32px;text-align:center;border-bottom:1px solid #222">
    <h1 style="font-size:28px;font-weight:900;letter-spacing:0.15em;margin:0;color:#fff">CENT</h1>
    <p style="color:#666;font-size:12px;margin:8px 0 0;text-transform:uppercase;letter-spacing:0.1em">Monthly Dispatch</p>
  </div>
  <div style="padding:40px 32px">
    <h2 style="font-size:22px;font-weight:700;margin:0 0 24px">What's New at CENT</h2>
    <p style="color:#aaa;line-height:1.7;margin:0 0 16px">Hey,</p>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Here's what's been happening this month — new drops, community moments, and what's coming next.</p>

    <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:#fff">🆕 New Arrivals</h3>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Write about new products here...</p>

    <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:#fff">📣 Community</h3>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Write about community news here...</p>

    <a href="https://cent.rw/products/" style="display:inline-block;background:#fff;color:#000;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px">Browse Collection →</a>
  </div>
  <div style="padding:24px 32px;border-top:1px solid #222;text-align:center;font-size:12px;color:#555">
    <p>CENT Streetwear · Kigali, Rwanda</p>
    <p><a href="https://cent.rw" style="color:#777">cent.rw</a></p>
  </div>
</div>`,
  },
  order_update: {
    label: 'Order Update',
    subject: 'Your CENT Order Has Been Updated',
    body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden">
  <div style="background:#111;padding:32px;text-align:center;border-bottom:1px solid #222">
    <h1 style="font-size:28px;font-weight:900;letter-spacing:0.15em;margin:0;color:#fff">CENT</h1>
  </div>
  <div style="padding:40px 32px">
    <h2 style="font-size:22px;font-weight:700;margin:0 0 16px">Order Update</h2>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Hi [Customer Name],</p>
    <p style="color:#aaa;line-height:1.7;margin:0 0 24px">Your order #[ORDER CODE] has been updated. Here are the details:</p>
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0;color:#aaa">Status: <strong style="color:#fff">[NEW STATUS]</strong></p>
      <p style="margin:8px 0 0;color:#aaa">Notes: [Any additional notes]</p>
    </div>
    <a href="https://cent.rw/order-tracking/" style="display:inline-block;background:#fff;color:#000;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px">Track Your Order →</a>
  </div>
  <div style="padding:24px 32px;border-top:1px solid #222;text-align:center;font-size:12px;color:#555">
    <p>CENT Streetwear · Kigali, Rwanda</p>
  </div>
</div>`,
  },
};

async function renderPage(container) {
  const [{ data: profiles }, { data: guests }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    supabase.from('customers').select('id, guest_name, guest_email').eq('is_guest', true).order('guest_name'),
  ]);

  const allCustomers = [
    ...(profiles || []).map(p => ({ id: p.id, name: p.full_name || p.email, email: p.email, type: 'registered' })),
    ...(guests || []).filter(g => g.guest_email).map(g => ({ id: g.id, name: g.guest_name || g.guest_email, email: g.guest_email, type: 'guest' })),
  ];

  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Email</h1>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-8);align-items:start">
        <!-- Compose -->
        <div style="display:flex;flex-direction:column;gap:var(--space-5)">

          <!-- Template picker -->
          <div>
            <label style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:var(--space-2)">Template</label>
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap" id="template-tabs">
              ${Object.entries(TEMPLATES).map(([key, t], i) => `
                <button class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-secondary'}" data-tpl="${key}">${t.label}</button>
              `).join('')}
            </div>
          </div>

          <!-- Subject -->
          <div class="input-group">
            <label class="input-label">Subject *</label>
            <input type="text" class="input" id="email-subject" placeholder="Your subject line here">
          </div>

          <!-- Preview text -->
          <div class="input-group">
            <label class="input-label">Preview Text <span style="color:var(--text-muted);font-weight:400">(shown in inbox)</span></label>
            <input type="text" class="input" id="email-preview-text" placeholder="Short teaser shown in inbox...">
          </div>

          <!-- Body -->
          <div class="input-group">
            <label class="input-label" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2)">
              <span>Body *</span>
              <div style="display:flex;gap:var(--space-2)">
                <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
                  <button class="btn btn-sm" id="mode-plain-btn" style="border-radius:0;border:none;background:var(--accent);color:var(--text-inverse)">Plain text</button>
                  <button class="btn btn-sm" id="mode-html-btn" style="border-radius:0;border:none;background:transparent;color:var(--text-muted)">HTML</button>
                </div>
                <button class="btn btn-sm btn-secondary" id="preview-html-btn">Preview</button>
              </div>
            </label>
            <textarea class="input" id="email-body" rows="14" style="font-family:var(--font-mono);font-size:var(--text-sm)" placeholder="Write your message here in plain text..."></textarea>
            <span style="font-size:var(--text-xs);color:var(--text-muted)" id="body-mode-hint">Plain text mode — your text will be sent as-is.</span>
          </div>

          <!-- Attachments -->
          <div>
            <label style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:var(--space-2)">Attachments</label>
            <div id="drop-zone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:var(--space-6);text-align:center;cursor:pointer;transition:border-color var(--transition)">
              <p style="color:var(--text-muted);font-size:var(--text-sm);margin:0">Drag & drop files here or <label for="file-input" style="color:var(--accent);cursor:pointer;text-decoration:underline">browse</label></p>
              <input type="file" id="file-input" multiple style="display:none">
            </div>
            <div id="attachment-list" style="margin-top:var(--space-2);display:flex;flex-direction:column;gap:var(--space-1)"></div>
          </div>
        </div>

        <!-- Recipients + Send -->
        <div style="display:flex;flex-direction:column;gap:var(--space-5)">

          <!-- Recipients mode -->
          <div>
            <label style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:var(--space-2)">Send To</label>
            <div style="display:flex;gap:var(--space-2)" id="recipient-mode-tabs">
              <button class="btn btn-sm btn-primary" data-mode="all">All Customers</button>
              <button class="btn btn-sm btn-secondary" data-mode="select">Select</button>
              <button class="btn btn-sm btn-secondary" data-mode="manual">Manual</button>
            </div>
          </div>

          <!-- All mode info -->
          <div id="mode-all">
            <div class="card" style="padding:var(--space-4);font-size:var(--text-sm);color:var(--text-muted)">
              Will send to <strong style="color:var(--text-primary)">${allCustomers.length} customers</strong> (${(profiles || []).length} registered + ${(guests || []).filter(g => g.guest_email).length} guests).
            </div>
          </div>

          <!-- Select mode -->
          <div id="mode-select" class="hidden">
            <input type="search" class="input input-sm" id="customer-filter" placeholder="Filter by name or email..." style="margin-bottom:var(--space-2)">
            <div style="border:1px solid var(--border);border-radius:var(--radius);max-height:320px;overflow-y:auto">
              <div style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:var(--space-2)">
                <input type="checkbox" id="select-all-customers">
                <label for="select-all-customers" style="font-size:var(--text-xs);color:var(--text-muted);cursor:pointer">Select all</label>
                <span id="selected-count" style="font-size:var(--text-xs);color:var(--text-muted);margin-left:auto">0 selected</span>
              </div>
              <div id="customer-list">
                ${allCustomers.map(c => `
                  <label class="customer-row" data-email="${c.email}" data-name="${c.name.toLowerCase()}" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border);cursor:pointer;font-size:var(--text-sm)">
                    <input type="checkbox" class="customer-check" value="${c.email}">
                    <span style="flex:1">${c.name}</span>
                    <span style="font-size:var(--text-xs);color:var(--text-muted)">${c.email}</span>
                    <span class="badge ${c.type === 'guest' ? 'badge-default' : 'badge-info'}" style="font-size:10px">${c.type === 'guest' ? 'Guest' : 'Account'}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Manual mode -->
          <div id="mode-manual" class="hidden">
            <div class="input-group">
              <label class="input-label">Email Addresses</label>
              <textarea class="input" id="manual-emails" rows="6" placeholder="One email per line, or comma-separated:&#10;alice@example.com&#10;bob@example.com, carol@example.com"></textarea>
              <span style="font-size:var(--text-xs);color:var(--text-muted)">One per line or comma-separated</span>
            </div>
          </div>

          <!-- Send button -->
          <div style="border-top:1px solid var(--border);padding-top:var(--space-5)">
            <div id="send-summary" style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-3)">Ready to send to all customers.</div>
            <button class="btn btn-primary btn-lg" id="send-btn" style="width:100%">Send Email</button>
          </div>

          <!-- Email log -->
          <div style="margin-top:var(--space-2)">
            <h3 style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3)">Recent Sends</h3>
            <div id="email-log">
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- HTML preview modal -->
      <div class="modal-overlay hidden" id="preview-modal">
        <div class="modal" style="max-width:700px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>HTML Preview</h3>
            <button class="modal-close" id="preview-modal-close">✕</button>
          </div>
          <iframe id="preview-frame" style="flex:1;min-height:500px;border:none;background:#fff" title="Email preview"></iframe>
        </div>
      </div>
    </div>
  `;

  const attachments = [];
  let recipientMode = 'all';
  let bodyMode = 'plain'; // 'plain' or 'html'

  // Plain / HTML body toggle
  document.getElementById('mode-plain-btn')?.addEventListener('click', () => {
    bodyMode = 'plain';
    document.getElementById('mode-plain-btn').style.background = 'var(--accent)';
    document.getElementById('mode-plain-btn').style.color = 'var(--text-inverse)';
    document.getElementById('mode-html-btn').style.background = 'transparent';
    document.getElementById('mode-html-btn').style.color = 'var(--text-muted)';
    document.getElementById('email-body').style.fontFamily = 'var(--font-sans)';
    document.getElementById('email-body').placeholder = 'Write your message here in plain text...';
    document.getElementById('body-mode-hint').textContent = 'Plain text mode — your text will be sent as-is inside a branded CENT template.';
  });

  document.getElementById('mode-html-btn')?.addEventListener('click', () => {
    bodyMode = 'html';
    document.getElementById('mode-html-btn').style.background = 'var(--accent)';
    document.getElementById('mode-html-btn').style.color = 'var(--text-inverse)';
    document.getElementById('mode-plain-btn').style.background = 'transparent';
    document.getElementById('mode-plain-btn').style.color = 'var(--text-muted)';
    document.getElementById('email-body').style.fontFamily = 'var(--font-mono)';
    document.getElementById('email-body').placeholder = '<p>Your email content here...</p>';
    document.getElementById('body-mode-hint').textContent = 'HTML mode — paste or write full HTML email markup.';
  });

  // Template tabs
  document.getElementById('template-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tpl]');
    if (!btn) return;
    const key = btn.dataset.tpl;
    document.querySelectorAll('#template-tabs [data-tpl]').forEach(b => b.className = 'btn btn-sm btn-secondary');
    btn.className = 'btn btn-sm btn-primary';
    const tpl = TEMPLATES[key];
    if (tpl.subject) document.getElementById('email-subject').value = tpl.subject;
    if (tpl.body) document.getElementById('email-body').value = tpl.body;
  });

  // Recipient mode tabs
  document.getElementById('recipient-mode-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    recipientMode = btn.dataset.mode;
    document.querySelectorAll('#recipient-mode-tabs [data-mode]').forEach(b => b.className = 'btn btn-sm btn-secondary');
    btn.className = 'btn btn-sm btn-primary';
    document.getElementById('mode-all').classList.toggle('hidden', recipientMode !== 'all');
    document.getElementById('mode-select').classList.toggle('hidden', recipientMode !== 'select');
    document.getElementById('mode-manual').classList.toggle('hidden', recipientMode !== 'manual');
    updateSendSummary();
  });

  // Customer filter
  document.getElementById('customer-filter')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#customer-list .customer-row').forEach(row => {
      const match = row.dataset.name.includes(q) || row.dataset.email.includes(q);
      row.style.display = match ? '' : 'none';
    });
  });

  // Select all
  document.getElementById('select-all-customers')?.addEventListener('change', (e) => {
    document.querySelectorAll('.customer-check').forEach(cb => cb.checked = e.target.checked);
    updateSelectedCount();
    updateSendSummary();
  });

  document.getElementById('customer-list')?.addEventListener('change', () => {
    updateSelectedCount();
    updateSendSummary();
  });

  function updateSelectedCount() {
    const n = document.querySelectorAll('.customer-check:checked').length;
    document.getElementById('selected-count').textContent = `${n} selected`;
  }

  function updateSendSummary() {
    const el = document.getElementById('send-summary');
    if (recipientMode === 'all') {
      el.textContent = `Will send to all ${allCustomers.length} customers.`;
    } else if (recipientMode === 'select') {
      const n = document.querySelectorAll('.customer-check:checked').length;
      el.textContent = n === 0 ? 'No customers selected.' : `Will send to ${n} selected customer${n !== 1 ? 's' : ''}.`;
    } else {
      const raw = document.getElementById('manual-emails')?.value || '';
      const emails = parseManualEmails(raw);
      el.textContent = emails.length === 0 ? 'No emails entered.' : `Will send to ${emails.length} email address${emails.length !== 1 ? 'es' : ''}.`;
    }
  }

  document.getElementById('manual-emails')?.addEventListener('input', updateSendSummary);

  // Attachments
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    handleFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        attachments.push({ filename: file.name, content: base64, type: file.type });
        renderAttachmentList();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderAttachmentList() {
    const el = document.getElementById('attachment-list');
    el.innerHTML = attachments.map((a, i) => `
      <div style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-2) var(--space-3)">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.filename}</span>
        <button data-idx="${i}" class="remove-attachment" style="color:var(--text-muted);background:none;border:none;cursor:pointer;font-size:16px;line-height:1">×</button>
      </div>
    `).join('');
    el.querySelectorAll('.remove-attachment').forEach(btn => {
      btn.addEventListener('click', () => {
        attachments.splice(Number(btn.dataset.idx), 1);
        renderAttachmentList();
      });
    });
  }

  // Preview
  document.getElementById('preview-html-btn')?.addEventListener('click', () => {
    const rawBody = document.getElementById('email-body').value;
    let previewContent = rawBody;
    if (bodyMode === 'plain') {
      previewContent = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#a3a3a3;font-size:15px;line-height:1.7">
        <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #222;margin-bottom:24px"><span style="font-family:Arial Black,sans-serif;font-size:24px;font-weight:900;letter-spacing:0.15em;color:#f5f5f5">CENT</span></div>
        ${rawBody.split('\n').map(l => l.trim() ? `<p style="margin:0 0 14px">${l}</p>` : '').join('')}
      </div>`;
    }
    document.getElementById('preview-frame').srcdoc = previewContent;
    document.getElementById('preview-modal').classList.remove('hidden');
  });
  document.getElementById('preview-modal-close')?.addEventListener('click', () => {
    document.getElementById('preview-modal').classList.add('hidden');
  });

  // Send
  document.getElementById('send-btn')?.addEventListener('click', async () => {
    const subject = document.getElementById('email-subject').value.trim();
    const body = document.getElementById('email-body').value.trim();
    const previewText = document.getElementById('email-preview-text').value.trim();

    if (!subject || !body) { toast.error('Subject and body are required.'); return; }

    let recipients = [];
    if (recipientMode === 'all') {
      recipients = allCustomers.map(c => ({ email: c.email, name: c.name }));
    } else if (recipientMode === 'select') {
      const checked = [...document.querySelectorAll('.customer-check:checked')].map(cb => cb.value);
      if (!checked.length) { toast.error('Select at least one recipient.'); return; }
      recipients = allCustomers.filter(c => checked.includes(c.email)).map(c => ({ email: c.email, name: c.name }));
    } else {
      const raw = document.getElementById('manual-emails').value;
      const emails = parseManualEmails(raw);
      if (!emails.length) { toast.error('Enter at least one email address.'); return; }
      recipients = emails.map(e => ({ email: e, name: '' }));
    }

    // Wrap plain text in branded template
    let finalBody = body;
    if (bodyMode === 'plain') {
      finalBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden">
    <div style="padding:28px 32px;border-bottom:1px solid #1f1f1f;text-align:center">
      <span style="font-family:'Arial Black',sans-serif;font-size:28px;font-weight:900;letter-spacing:0.15em;color:#f5f5f5">CENT</span>
    </div>
    <div style="padding:32px;color:#a3a3a3;font-size:15px;line-height:1.7">
      ${body.split('\n').map(l => l.trim() ? `<p style="margin:0 0 14px">${l}</p>` : '').join('')}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#525252;font-size:12px;margin:0">CENT Streetwear — Kigali, Rwanda &middot; <a href="https://cent.rw" style="color:#777;text-decoration:none">cent.rw</a></p>
    </div>
  </div>
</div></body></html>`;
    }

    if (!confirm(`Send "${subject}" to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;

    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { subject, previewText, body: finalBody, recipients, attachments },
      });
      if (error) throw error;
      toast.success(`Sent to ${data?.sent ?? recipients.length} recipient${recipients.length !== 1 ? 's' : ''}.`);
      loadEmailLog();
    } catch (err) {
      toast.error(err.message || 'Failed to send email.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Email';
    }
  });

  loadEmailLog();
}

function parseManualEmails(raw) {
  return raw
    .split(/[\n,]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

async function loadEmailLog() {
  const el = document.getElementById('email-log');
  if (!el) return;
  const { data } = await supabase
    .from('email_logs')
    .select('id, subject, recipient_count, sent_at, status')
    .order('sent_at', { ascending: false })
    .limit(10);

  if (!data?.length) {
    el.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-muted)">No emails sent yet.</p>`;
    return;
  }

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Subject</th><th>Recipients</th><th>Status</th><th>Sent</th></tr></thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td style="font-size:var(--text-sm);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${row.subject}</td>
              <td style="font-size:var(--text-sm)">${row.recipient_count ?? '—'}</td>
              <td><span class="badge ${row.status === 'sent' ? 'badge-success' : 'badge-error'}">${row.status}</span></td>
              <td style="font-size:var(--text-xs);color:var(--text-muted)">${row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
