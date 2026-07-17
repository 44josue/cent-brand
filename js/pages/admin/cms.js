import { renderAdminShell } from '../../components/admin-shell.js';
import {
  getAllSiteSections,
  updateSiteSection,
  getAllFaqItems,
  upsertFaqItem,
  deleteFaqItem,
  getCmsMediaLibrary,
  saveCmsMediaLibrary,
  uploadCmsImage,
  CMS_IMAGE_SECTIONS,
} from '../../lib/api.js';
import { toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('CMS', renderPage);

const SKELETON_FORM = `<div class="skeleton skeleton-title" style="width:40%;margin-bottom:var(--space-4)"></div><div class="skeleton skeleton-rows"></div>`;

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1>CMS & Content</h1>
        <p>Manage storefront images, copy, contact info, and FAQ.</p>
      </div>
    </div>

    <div class="tabs" id="cms-tabs" style="margin-bottom:var(--space-6)">
      <button class="tab-btn active" data-tab="images">Site Images</button>
      <button class="tab-btn" data-tab="layout">Home Layout</button>
      <button class="tab-btn" data-tab="sections">Site Sections</button>
      <button class="tab-btn" data-tab="contact">Contact Info</button>
      <button class="tab-btn" data-tab="faq">FAQ</button>
    </div>

    <div class="tab-panel active" id="tab-images">${SKELETON_FORM}</div>
    <div class="tab-panel" id="tab-layout">${SKELETON_FORM}</div>
    <div class="tab-panel" id="tab-sections">${SKELETON_FORM}</div>
    <div class="tab-panel" id="tab-contact">${SKELETON_FORM}</div>
    <div class="tab-panel" id="tab-faq">${SKELETON_FORM}</div>
  `;

  const loaders = {
    layout: loadHomeLayout,
    images: loadSiteImages,
    sections: loadSections,
    contact: loadContactInfo,
    faq: loadFaq,
  };

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

  loaded.add('images');
  loadSiteImages();
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

  el.innerHTML = `
    <div class="card" style="max-width:560px">
      <h3 style="margin-bottom:var(--space-2)">Home Page Layout</h3>
      <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-6)">
        Control which sections appear on the home page.
      </p>
      <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;padding:var(--space-4);background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg)">
        <input type="checkbox" id="layout-featured" ${cfg.show_featured !== false ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--text-sm)">Show Featured Products section</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">The featured products carousel on the home page</div>
        </div>
      </label>
      <button class="btn btn-primary w-full" style="margin-top:var(--space-6)" id="layout-save-btn">Save Layout</button>
    </div>
  `;

  document.getElementById('layout-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('layout-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const show_featured = document.getElementById('layout-featured').checked;
    try {
      await updateSiteSection('home_layout', { body: JSON.stringify({ show_featured }) });
      toast.success('Layout saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save.');
    }
    btn.disabled = false;
    btn.textContent = 'Save Layout';
  });
}

// ── SITE IMAGES ─────────────────────────────────────────────────────────────

let cmsImages = [];
const MAX_LIVE_CMS = 3;

function cmsImageId() {
  return crypto.randomUUID?.() || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loadSiteImages() {
  const el = document.getElementById('tab-images');
  if (!el) return;
  try {
    cmsImages = await getCmsMediaLibrary();
    renderSiteImages(el);
  } catch (err) {
    console.error('loadSiteImages:', err);
    el.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <h3>Could not load site images</h3>
          <p>${err.message || 'Check your connection and try again.'}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:var(--space-4)" type="button" id="cms-retry-btn">Retry</button>
        </div>
      </div>
    `;
    document.getElementById('cms-retry-btn')?.addEventListener('click', () => loadSiteImages());
  }
}

function renderSiteImages(el) {
  const liveCount = cmsImages.filter(i => i.is_live).length;
  const sectionOptions = (selected, disabled) => `
    <option value="">— Choose section —</option>
    ${CMS_IMAGE_SECTIONS.map(s => `
      <option value="${s.key}" ${selected === s.key ? 'selected' : ''}>${s.label}</option>
    `).join('')}
  `;

  el.innerHTML = `
    <div class="cms-section-pills" aria-hidden="true">
      ${CMS_IMAGE_SECTIONS.map(s => `<span class="cms-section-pill">${s.label}</span>`).join('')}
    </div>

    <div class="card" style="margin-bottom:var(--space-6)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-4)">
        <div>
          <h3 style="margin-bottom:var(--space-1)">Site section images</h3>
          <p style="font-size:var(--text-sm);color:var(--text-muted);max-width:520px">
            Upload photos for the home and about pages. Turn on <strong>Live</strong> for up to ${MAX_LIVE_CMS} images and assign each to a section.
          </p>
        </div>
        <span class="cms-live-badge ${liveCount ? 'is-live' : ''}" id="cms-live-count">
          ${liveCount} / ${MAX_LIVE_CMS} live
        </span>
      </div>

      <label class="cms-upload-zone" id="cms-upload-zone" for="cms-upload-input">
        <div class="cms-upload-zone-icon" aria-hidden="true">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
          </svg>
        </div>
        <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-1)">Click or drop an image to upload</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted)">JPG, PNG, or WebP · stored in cms-images bucket</div>
        <input type="file" id="cms-upload-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      </label>
    </div>

    <div id="cms-images-list" style="display:flex;flex-direction:column;gap:var(--space-4)">
      ${cmsImages.length ? cmsImages.map((img, i) => `
        <div class="card cms-image-row" data-index="${i}">
          <div class="cms-image-card">
            <div class="cms-image-card-preview">
              <img src="${img.url}" alt="" loading="lazy" onerror="this.style.opacity='0.3'">
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4)">
                <label class="toggle">
                  <input type="checkbox" class="cms-live-toggle" data-index="${i}" ${img.is_live ? 'checked' : ''}>
                  <div class="toggle-track"><div class="toggle-thumb"></div></div>
                  <span style="font-size:var(--text-sm);font-weight:600;margin-left:var(--space-2)">Live on site</span>
                </label>
                <button type="button" class="btn btn-ghost btn-sm cms-remove-btn" data-index="${i}" style="color:var(--error)">Remove</button>
              </div>
              <div class="input-group">
                <label class="input-label">Storefront section</label>
                <select class="input cms-section-select" data-index="${i}" ${img.is_live ? '' : 'disabled'}>
                  ${sectionOptions(img.section_key || '', !img.is_live)}
                </select>
                <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-2)">
                  ${img.is_live ? 'This image will show on the selected page section after you save.' : 'Enable Live to assign a section.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z"/></svg>
            </div>
            <h3>No images yet</h3>
            <p>Upload your first image using the drop zone above.</p>
          </div>
        </div>
      `}
    </div>

    <button class="btn btn-primary" id="cms-images-save-btn" style="margin-top:var(--space-6);min-width:200px" ${cmsImages.length ? '' : 'disabled'}>
      Save site images
    </button>
  `;

  bindSiteImagesEvents(el);
}

function bindSiteImagesEvents(el) {
  const zone = document.getElementById('cms-upload-zone');
  const input = document.getElementById('cms-upload-input');

  zone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) handleCmsUpload(file, el);
  });

  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await handleCmsUpload(file, el);
  });

  el.querySelectorAll('.cms-live-toggle').forEach(input => {
    input.addEventListener('change', () => {
      const i = parseInt(input.dataset.index, 10);
      const enabling = input.checked;
      const liveCount = cmsImages.filter(img => img.is_live).length;
      if (enabling && !cmsImages[i].is_live && liveCount >= MAX_LIVE_CMS) {
        input.checked = false;
        toast.error(`Only ${MAX_LIVE_CMS} images can be live at once.`);
        return;
      }
      cmsImages[i].is_live = enabling;
      if (!enabling) cmsImages[i].section_key = null;
      renderSiteImages(el);
    });
  });

  el.querySelectorAll('.cms-section-select').forEach(select => {
    select.addEventListener('change', () => {
      const i = parseInt(select.dataset.index, 10);
      const key = select.value || null;
      if (key) {
        const taken = cmsImages.findIndex((img, j) => j !== i && img.is_live && img.section_key === key);
        if (taken >= 0) {
          toast.warning('That section already has a live image. Save will fail until you reassign.');
        }
      }
      cmsImages[i].section_key = key;
    });
  });

  el.querySelectorAll('.cms-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      if (!confirm('Remove this image from the library?')) return;
      cmsImages.splice(i, 1);
      renderSiteImages(el);
    });
  });

  document.getElementById('cms-images-save-btn')?.addEventListener('click', async () => {
    const saveBtn = document.getElementById('cms-images-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';
    try {
      await saveCmsMediaLibrary(cmsImages);
      toast.success('Site images saved — storefront updated.');
      cmsImages = await getCmsMediaLibrary();
      renderSiteImages(el);
    } catch (err) {
      toast.error(err.message || 'Could not save.');
    }
    saveBtn.disabled = !cmsImages.length;
    saveBtn.textContent = 'Save site images';
  });
}

async function handleCmsUpload(file, el) {
  const zone = document.getElementById('cms-upload-zone');
  if (zone) {
    zone.style.pointerEvents = 'none';
    zone.style.opacity = '0.7';
  }
  try {
    const { url, storage_path } = await uploadCmsImage(file);
    cmsImages.push({
      id: cmsImageId(),
      url,
      storage_path,
      is_live: false,
      section_key: null,
    });
    toast.success('Uploaded. Toggle Live, pick a section, then Save.');
    renderSiteImages(el);
  } catch (err) {
    toast.error(err.message || 'Upload failed. Are you signed in as admin?');
  } finally {
    if (zone) {
      zone.style.pointerEvents = '';
      zone.style.opacity = '';
    }
  }
}

// ── SITE SECTIONS ─────────────────────────────────────────────────────────────

async function loadSections() {
  const el = document.getElementById('tab-sections');
  try {
    const sections = await getAllSiteSections();
    const filtered = sections.filter(s => s.key !== 'cms_media_library' && s.key !== 'home_layout');
    el.innerHTML = `
      <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-6)">
        Text content for storefront sections. Use <strong>Site Images</strong> for home/about photos.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${filtered.map(s => `
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
              <div>
                <div style="font-weight:600;font-size:var(--text-sm)">${s.key}</div>
                ${s.title ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${s.title}</div>` : ''}
              </div>
              <button class="btn btn-secondary btn-sm section-save" data-key="${s.key}">Save</button>
            </div>
            <textarea class="input section-body" data-key="${s.key}" rows="4" style="width:100%;resize:vertical">${s.body || ''}</textarea>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.section-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.key;
        const body = el.querySelector(`.section-body[data-key="${key}"]`)?.value || '';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        try {
          await updateSiteSection(key, { body });
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
          Shown in the footer and contact page.
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
          <input type="text" class="input" id="ci-whatsapp" value="${data.whatsapp || ''}" placeholder="+250788123456">
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
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      const payload = {
        email: document.getElementById('ci-email').value.trim(),
        phone: document.getElementById('ci-phone').value.trim(),
        whatsapp: document.getElementById('ci-whatsapp').value.trim(),
        location: document.getElementById('ci-location').value.trim(),
        instagram: document.getElementById('ci-instagram').value.trim(),
        tiktok: document.getElementById('ci-tiktok').value.trim(),
      };
      try {
        await updateSiteSection('contact_info', { body: JSON.stringify(payload) });
        toast.success('Contact info saved!');
      } catch (err) { toast.error(err.message || 'Could not save.'); }
      btn.disabled = false;
      btn.textContent = 'Save Contact Info';
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
      <p style="font-size:var(--text-sm);color:var(--text-muted)">FAQ items on the public FAQ page.</p>
      <button class="btn btn-primary btn-sm" id="add-faq-btn">+ Add Question</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-3)" id="faq-list-admin">
      ${faqItems.map((item, i) => `
        <div class="card faq-item-card" data-id="${item.id}">
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
            <h3>No FAQ items yet</h3>
            <p>Add questions customers commonly ask.</p>
          </div>
        </div>` : ''}
    </div>

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
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await upsertFaqItem({ id, question, answer, sort_order, is_active: true });
      toast.success('FAQ saved!');
      document.getElementById('faq-modal').classList.add('hidden');
      faqItems = await getAllFaqItems();
      renderFaqList(el);
    } catch (err) { toast.error(err.message || 'Could not save FAQ.'); }

    btn.disabled = false;
    btn.textContent = 'Save';
  };
}
