import { renderAdminShell } from '../../components/admin-shell.js';
import { supabase } from '../../lib/supabase.js';
import { formatDate, toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Messages', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Contact Messages</h1>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-secondary btn-sm" id="mark-all-read-btn">Mark All Read</button>
          <button class="btn btn-ghost btn-sm" id="delete-read-btn" style="color:var(--error)">Delete Read</button>
        </div>
      </div>
      <div id="messages-list"></div>

      <!-- Thread modal -->
      <div class="modal-overlay hidden" id="msg-modal">
        <div class="modal" style="max-width:600px">
          <div class="modal-header">
            <h3 id="msg-modal-title">Message</h3>
            <button class="modal-close" id="msg-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6)" id="msg-modal-body"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('msg-modal-close')?.addEventListener('click', () => {
    document.getElementById('msg-modal').classList.add('hidden');
  });

  document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
    await supabase.from('contact_messages').update({ is_read: true }).eq('is_read', false);
    toast.success('All marked as read.'); loadMessages();
  });

  document.getElementById('delete-read-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete all read messages?')) return;
    await supabase.from('contact_messages').delete().eq('is_read', true);
    toast.success('Deleted read messages.'); loadMessages();
  });

  loadMessages();
}

async function loadMessages() {
  const el = document.getElementById('messages-list');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';
  try {
    const { data: msgs } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (!msgs?.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No messages yet.</p>';
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th></th><th>From</th><th>Subject</th><th>Date</th><th></th></tr></thead>
          <tbody>
            ${msgs.map(m => `
              <tr style="${!m.is_read ? 'background:var(--bg-hover)' : ''}">
                <td>
                  ${!m.is_read ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>' : ''}
                </td>
                <td>
                  <div style="font-weight:${!m.is_read ? '700' : '400'};font-size:var(--text-sm)">${m.name || '—'}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted)">${m.email || ''}</div>
                </td>
                <td style="font-size:var(--text-sm);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${m.subject || '(No subject)'}
                </td>
                <td style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(m.created_at)}</td>
                <td>
                  <div style="display:flex;gap:var(--space-2)">
                    <button class="btn btn-secondary btn-sm view-msg-btn" data-id="${m.id}">View</button>
                    <button class="btn btn-ghost btn-sm del-msg-btn" data-id="${m.id}" style="color:var(--error)">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.view-msg-btn').forEach(btn => {
      const msg = msgs.find(m => m.id === btn.dataset.id);
      btn.addEventListener('click', () => viewMessage(msg));
    });
    document.querySelectorAll('.del-msg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this message?')) return;
        await supabase.from('contact_messages').delete().eq('id', btn.dataset.id);
        toast.success('Deleted.'); loadMessages();
      });
    });
  } catch {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load messages.</p>';
  }
}

async function viewMessage(msg) {
  // Mark as read
  if (!msg.is_read) {
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id);
    msg.is_read = true;
  }

  document.getElementById('msg-modal-title').textContent = msg.subject || '(No subject)';
  document.getElementById('msg-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4);font-size:var(--text-sm);margin-bottom:var(--space-6);color:var(--text-muted)">
      <span>From</span><span style="color:var(--text-primary)">${msg.name || '—'} &lt;${msg.email || '—'}&gt;</span>
      ${msg.phone ? `<span>Phone</span><span style="color:var(--text-primary)">${msg.phone}</span>` : ''}
      <span>Date</span><span style="color:var(--text-primary)">${formatDate(msg.created_at)}</span>
    </div>
    <div style="background:var(--bg-base);border-radius:var(--radius);padding:var(--space-4);font-size:var(--text-sm);line-height:1.7;white-space:pre-wrap;border:1px solid var(--border)">${msg.message || ''}</div>
    <div style="margin-top:var(--space-6);display:flex;gap:var(--space-3)">
      <a href="mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || '')}" class="btn btn-primary btn-sm">Reply via Email</a>
      ${msg.phone ? `<a href="https://wa.me/${msg.phone.replace(/\D/g,'')}" target="_blank" class="btn btn-secondary btn-sm">WhatsApp</a>` : ''}
    </div>
  `;
  document.getElementById('msg-modal').classList.remove('hidden');

  // Refresh list to reflect read state
  loadMessages();
}
