import { renderAdminShell } from '../../components/admin-shell.js';
import { supabase } from '../../lib/supabase.js';
import { callEdge } from '../../lib/api.js';
import { toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Email Blast', renderPage);

async function renderPage(container) {
  // Load subscriber count
  const { count: subCount } = await supabase
    .from('subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Email Blast</h1>
      </div>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">
        Send a broadcast email to your drop list.
        <strong style="color:var(--text-primary)">${subCount ?? 0} active subscriber${subCount !== 1 ? 's' : ''}</strong> on the list.
      </p>

      <div style="max-width:640px">
        <div style="display:flex;flex-direction:column;gap:var(--space-5)">
          <div class="input-group">
            <label class="input-label">Subject *</label>
            <input type="text" class="input" id="blast-subject" placeholder="New Drop — The CENT SS25 Collection is Live">
          </div>

          <div class="input-group">
            <label class="input-label">Preview Text <span style="color:var(--text-muted);font-weight:400">(shown in inbox)</span></label>
            <input type="text" class="input" id="blast-preview" placeholder="Shop the latest pieces before they sell out...">
          </div>

          <div class="input-group">
            <label class="input-label">Body (HTML or plain text) *</label>
            <textarea class="input" id="blast-body" rows="12" style="font-family:var(--font-mono);font-size:var(--text-sm)" placeholder="<p>Hey,</p>
<p>The new collection just dropped...</p>
<p><a href='https://cent.rw/products/'>Shop Now →</a></p>"></textarea>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-4);font-size:var(--text-sm)">
            <strong>Before you send:</strong>
            <ul style="margin-top:var(--space-2);padding-left:var(--space-5);color:var(--text-muted);display:flex;flex-direction:column;gap:var(--space-1)">
              <li>Emails are sent via Resend using your configured domain.</li>
              <li>An unsubscribe link is appended automatically.</li>
              <li>This action cannot be undone.</li>
            </ul>
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <button class="btn btn-primary" id="blast-send-btn">Send to ${subCount ?? 0} Subscribers</button>
            <button class="btn btn-secondary" id="blast-preview-btn">Preview HTML</button>
          </div>
        </div>
      </div>

      <!-- HTML preview modal -->
      <div class="modal-overlay hidden" id="preview-modal">
        <div class="modal" style="max-width:680px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>HTML Preview</h3>
            <button class="modal-close" id="preview-modal-close">✕</button>
          </div>
          <iframe id="preview-frame" style="flex:1;border:none;background:#fff" title="Email preview"></iframe>
        </div>
      </div>
    </div>
  `;

  document.getElementById('blast-preview-btn')?.addEventListener('click', () => {
    const body = document.getElementById('blast-body').value;
    const frame = document.getElementById('preview-frame');
    frame.srcdoc = body;
    document.getElementById('preview-modal').classList.remove('hidden');
  });

  document.getElementById('preview-modal-close')?.addEventListener('click', () => {
    document.getElementById('preview-modal').classList.add('hidden');
  });

  document.getElementById('blast-send-btn')?.addEventListener('click', async () => {
    const subject = document.getElementById('blast-subject').value.trim();
    const previewText = document.getElementById('blast-preview').value.trim();
    const body = document.getElementById('blast-body').value.trim();

    if (!subject || !body) { toast.error('Subject and body are required.'); return; }
    if (!confirm(`Send to ${subCount ?? 0} subscribers? This cannot be undone.`)) return;

    const btn = document.getElementById('blast-send-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
      const result = await callEdge('send-email-blast', { subject, previewText, body });
      toast.success(`Sent to ${result?.sent ?? subCount} subscribers.`);
      document.getElementById('blast-subject').value = '';
      document.getElementById('blast-preview').value = '';
      document.getElementById('blast-body').value = '';
    } catch (err) {
      toast.error(err.message || 'Failed to send blast.');
    } finally {
      btn.disabled = false; btn.textContent = `Send to ${subCount ?? 0} Subscribers`;
    }
  });
}
