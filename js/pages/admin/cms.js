import { renderAdminShell } from '../../components/admin-shell.js';
import { getAllSiteSections, updateSiteSection, getAllFaqItems, upsertFaqItem, deleteFaqItem } from '../../lib/api.js';
import { toast, modal, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('CMS', renderPage);

const SKELETON_FORM = `<div style="max-width:560px"><div class="skeleton skeleton-title" style="width:40%;margin-bottom:var(--space-4)"></div><div class="skeleton skeleton-rows"></div></div>`;

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header"><h1>CMS & Content</h1></div>

      <div class="tabs" id="cms-tabs" style="margin-bottom:var(--space-6)">
        <button class="tab-btn active" data-tab="layout">Home Layout</button>
        <button class="tab-btn" data-tab="sections">Site Sections</button>
        <button class="tab-btn" data-tab="contact">Contact Info</button>
        <button class="tab-btn" data-tab="faq">FAQ</button>
      </div>

      <div class="tab-panel active" id="tab-layout">${SKELETON_FORM}</div>
      <div class="tab-panel" id="tab-sections">${SKELETON_FORM}</div>
      <div class="tab-panel" id="tab-contact">${SKELETON_FORM}</div>
      <div class="tab-panel" id="tab-faq">${SKELETON_FORM}</div>
    </div>
  `;

  const loaders = {
    layout: loadHomeLayout,
    sections: loadSections,
    contact: loadContactInfo,
    faq: loadFaq,
  };

  // Track which tabs have already loaded so we don't re-fetch on re-click
  const loaded = new Set();

  function activateTab(tab) {
    container.querySelectorAll('#cms-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    if (!loaded.has(tab)) {
      loaded.add(tab);
      loaders[tab]?.();
    }
  }

  container.querySelectorAll('#cms-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // Load only the first (active) tab immediately
  loaded.add('layout');
  loadHomeLayout();
}

// ── HOME LAYOUT ───────────────────────────────────────────────────────────────

async function loadHomeLayout() {
  const el = document.getElementById('tab-layout');

  let cfg = { show_featured: true };
  try {
    const { supabase } = await import('../../lib/supabase.js');
    const { data } = await supabase
      .from('site_sections')
      .select('body')
      .eq('key', 'home_layout')
      .maybeSingle();
    if (data?.body) cfg = { ...cfg, ...JSON.parse(data.body) };
  } catch { /* use defaults */ }

  const toggle = (id, checked) => `
    <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;padding:var(--space-4);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg)">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
      <div style="flex:1">
        <div style="font-weight:600;font-size:var(--text-sm)">${id === 'layout-featured' ? 'Show Featured Products section' : 'Show Collaborations section'}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${id === 'layout-featured' ? 'The "Featured Products" grid on the home page' : 'The collabs strip on the home page (auto-hides when no active collabs)'}</div>
      </div>
    </label>
  `;

  el.innerHTML = `
    <div class="card" style="max-width:560px">
      <h3 style="margin-bottom:var(--space-2)">Home Page Layout</h3>
      <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-6)">
        Control which sections appear on the home page. When a collab drop is the focus, you can hide featured products to avoid overlap.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${toggle('layout-featured', cfg.show_featured !== false)}
      </div>
      <button class="btn btn-primary w-full" style="margin-top:var(--space-6)" id="layout-save-btn">Save Layout</button>
    </div>
  `;

  document.getElementById('layout-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('layout-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const show_featured = document.getElementById('layout-featured').checked;
    try {
      await updateSiteSection('home_layout', { body: JSON.stringify({ show_featured }) });
      toast.success('Layout saved. Changes appear on the home page.');
    } catch (err) {
      toast.error(err.message || 'Could not save.');
    }
    btn.disabled = false; btn.textContent = 'Save Layout';
  });
}

// ── SITE SECTIONS ─────────────────────────────────────────────────────────────

async function loadSections() {
  const el = document.getElementById('tab-sections');
  try {
    const sections = await getAllSiteSections();
    el.innerHTML = `
      <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-6)">
        These sections control text displayed across the storefront.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${sections.map(s => `
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
              <div>
                <div style="font-weight:600;font-size:var(--text-sm)">${s.key}</div>
                ${s.title ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${s.title}</div>` : ''}
              </div>
              <button class="btn btn-secondary btn-sm section-save" data-key="${s.key}">Save</button>
            </div>
            <textarea class="input section-body" data-key="${s.key}" rows="4" style="width:100%;resize:vertical">${s.body || ''}</textarea>
            ${s.image_url !== undefined ? `
              <input type="text" class="input section-image" data-key="${s.key}" placeholder="Image URL (optional)" value="${s.image_url || ''}" style="margin-top:var(--space-2)">
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.section-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.key;
        const body = el.querySelector(`.section-body[data-key="${key}"]`)?.value || '';
        const image_url = el.querySelector(`.section-image[data-key="${key}"]`)?.value || null;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        try {
          await updateSiteSection(key, { body, image_url });
          toast.success('Section updated.');
        } catch (err) {
          toast.error(err.message || 'Could not save.');
        }
        btn.disabled = false;
        btn.textContent = 'Save';
      });
    });
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load sections.</p>';
  }
}

// ── CONTACT INFO ──────────────────────────────────────────────────────────────

async function loadContactInfo() {
  const el = document.getElementById('tab-contact');
  try {
    const sections = await getAllSiteSections();
    const contact = sections.find(s => s.key === 'contact_info') || {};
    let data = {};
    try { data = JSON.parse(contact.body || '{}'); } catch { /* empty */ }

    el.innerHTML = `
      <div class="card" style="max-width:540px">
        <h3 style="margin-bottom:var(--space-6)">Contact Information</h3>
        <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-6)">
          This information appears in the footer and contact page.
        </p>
        <div class="input-group">
          <label class="input-label">Email Address</label>
          <input type="email" class="input" id="ci-email" value="${data.email || 'info@cent.rw'}" placeholder="info@cent.rw">
        </div>
        <div class="input-group" style="margin-top:var(--space-4)">
          <label class="input-label">Phone Number</label>
          <input type="text" class="input" id="ci-phone" value="${data.phone || '+250 788 123 456'}" placeholder="+250 788 123 456">
        </div>
        <div class="input-group" style="margin-top:var(--space-4)">
          <label class="input-label">WhatsApp Number</label>
          <input type="text" class="input" id="ci-whatsapp" value="${data.whatsapp || ''}" placeholder="+250788123456 (no spaces)">
        </div>
        <div class="input-group" style="margin-top:var(--space-4)">
          <label class="input-label">Location</label>
          <input type="text" class="input" id="ci-location" value="${data.location || 'Kigali, Rwanda'}" placeholder="Kigali, Rwanda">
        </div>
        <div class="input-group" style="margin-top:var(--space-4)">
          <label class="input-label">Instagram URL</label>
          <input type="url" class="input" id="ci-instagram" value="${data.instagram || ''}" placeholder="https://instagram.com/centbrand">
        </div>
        <div class="input-group" style="margin-top:var(--space-4)">
          <label class="input-label">TikTok URL</label>
          <input type="url" class="input" id="ci-tiktok" value="${data.tiktok || ''}" placeholder="https://tiktok.com/@centbrand">
        </div>
        <button class="btn btn-primary w-full" style="margin-top:var(--space-6)" id="save-contact-btn">Save Contact Info</button>
      </div>
    `;

    document.getElementById('save-contact-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-contact-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const data = {
        email: document.getElementById('ci-email').value.trim(),
        phone: document.getElementById('ci-phone').value.trim(),
        whatsapp: document.getElementById('ci-whatsapp').value.trim(),
        location: document.getElementById('ci-location').value.trim(),
        instagram: document.getElementById('ci-instagram').value.trim(),
        tiktok: document.getElementById('ci-tiktok').value.trim(),
      };
      try {
        await updateSiteSection('contact_info', { body: JSON.stringify(data) });
        toast.success('Contact info saved!');
      } catch (err) { toast.error(err.message || 'Could not save.'); }
      btn.disabled = false; btn.textContent = 'Save Contact Info';
    });
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load contact info.</p>';
  }
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

let faqItems = [];

async function loadFaq() {
  const el = document.getElementById('tab-faq');
  try {
    faqItems = await getAllFaqItems();
    renderFaqList(el);
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load FAQ.</p>';
  }
}

function renderFaqList(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6)">
      <p style="font-size:var(--text-sm);color:var(--text-muted)">Manage frequently asked questions shown on the FAQ page.</p>
      <button class="btn btn-primary btn-sm" id="add-faq-btn">+ Add Question</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-3)" id="faq-list-admin">
      ${faqItems.map((item, i) => `
        <div class="card faq-item-card" data-id="${item.id}" data-sort="${item.sort_order}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)">
            <div style="flex:1">
              <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-2)">${item.question}</div>
              <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5">${item.answer?.slice(0, 120)}${item.answer?.length > 120 ? '...' : ''}</div>
            </div>
            <div style="display:flex;gap:var(--space-2);flex-shrink:0">
              <button class="btn btn-secondary btn-sm edit-faq-btn" data-index="${i}">Edit</button>
              <button class="btn btn-ghost btn-sm delete-faq-btn" data-id="${item.id}" style="color:var(--error)">Delete</button>
            </div>
          </div>
        </div>
      `).join('')}
      ${!faqItems.length ? `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h3>No FAQ items yet</h3>
            <p>Add questions and answers that customers commonly ask.</p>
          </div>
        </div>` : ''}
    </div>

    <!-- FAQ Modal -->
    <div class="modal-overlay hidden" id="faq-modal">
      <div class="modal">
        <div class="modal-header">
          <h3 id="faq-modal-title">Add Question</h3>
          <button class="modal-close" id="faq-modal-close">✕</button>
        </div>
        <div style="padding:var(--space-6)">
          <input type="hidden" id="faq-edit-id">
          <div class="input-group">
            <label class="input-label">Question *</label>
            <input type="text" class="input" id="faq-question" placeholder="e.g. How do I track my order?">
          </div>
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Answer *</label>
            <textarea class="input" id="faq-answer" rows="5" placeholder="Full answer..." style="width:100%;resize:vertical"></textarea>
          </div>
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Sort Order</label>
            <input type="number" class="input" id="faq-sort" value="0" min="0">
          </div>
          <button class="btn btn-primary w-full" style="margin-top:var(--space-6)" id="faq-save-btn">Save</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-faq-btn')?.addEventListener('click', () => openFaqModal(null, el));
  document.getElementById('faq-modal-close')?.addEventListener('click', () => document.getElementById('faq-modal').classList.add('hidden'));

  el.querySelectorAll('.edit-faq-btn').forEach(btn => {
    btn.addEventListener('click', () => openFaqModal(faqItems[parseInt(btn.dataset.index)], el));
  });

  el.querySelectorAll('.delete-faq-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this FAQ item?')) return;
      try {
        await deleteFaqItem(btn.dataset.id);
        toast.success('FAQ item deleted.');
        faqItems = await getAllFaqItems();
        renderFaqList(el);
      } catch (err) { toast.error(err.message || 'Could not delete.'); }
    });
  });
}

function openFaqModal(item, el) {
  document.getElementById('faq-modal-title').textContent = item ? 'Edit Question' : 'Add Question';
  document.getElementById('faq-edit-id').value = item?.id || '';
  document.getElementById('faq-question').value = item?.question || '';
  document.getElementById('faq-answer').value = item?.answer || '';
  document.getElementById('faq-sort').value = item?.sort_order ?? faqItems.length;
  document.getElementById('faq-modal').classList.remove('hidden');

  document.getElementById('faq-save-btn').onclick = async () => {
    const question = document.getElementById('faq-question').value.trim();
    const answer = document.getElementById('faq-answer').value.trim();
    const sort_order = parseInt(document.getElementById('faq-sort').value) || 0;
    const id = document.getElementById('faq-edit-id').value || undefined;

    if (!question || !answer) { toast.error('Question and answer are required.'); return; }

    const btn = document.getElementById('faq-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await upsertFaqItem({ id, question, answer, sort_order, is_active: true });
      toast.success('FAQ saved!');
      document.getElementById('faq-modal').classList.add('hidden');
      faqItems = await getAllFaqItems();
      renderFaqList(el);
    } catch (err) { toast.error(err.message || 'Could not save FAQ.'); }

    btn.disabled = false; btn.textContent = 'Save';
  };
}
