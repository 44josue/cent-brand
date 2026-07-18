// ── FORMAT ──────────────────────────────────────────────────────────────────

export function formatRWF(cents) {
  return new Intl.NumberFormat('en-RW').format(Math.floor(cents / 100)) + ' RWF';
}

export function formatDate(iso, opts = {}) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortToken(token) {
  return token ? token.replace(/-/g, '').slice(0, 6).toUpperCase() : '';
}

export function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── PASSWORD VISIBILITY TOGGLE ─────────────────────────────────────────────

const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>`;

/** Adds an eye-toggle button to every `input[type=password]` in the document (or a given root). Safe to call repeatedly — already-wrapped inputs are skipped. */
export function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggleInit) return;
    input.dataset.toggleInit = '1';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.paddingRight = '42px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle-btn';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = EYE_ICON;
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });
}

// ── TOAST ───────────────────────────────────────────────────────────────────

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'info', title = '') {
  const container = ensureToastContainer();

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div>${message}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">✕</button>
  `;

  el.querySelector('.toast-close').addEventListener('click', () => removeToast(el));
  container.appendChild(el);

  setTimeout(() => removeToast(el), 4000);
  return el;
}

function removeToast(el) {
  if (!el || el._removing) return;
  el._removing = true;
  el.classList.add('out');
  setTimeout(() => el.remove(), 200);
}

export const toast = {
  success: (msg, title) => showToast(msg, 'success', title),
  error:   (msg, title) => showToast(msg, 'error', title),
  info:    (msg, title) => showToast(msg, 'info', title),
  warning: (msg, title) => showToast(msg, 'warning', title),
};

// ── MODAL ───────────────────────────────────────────────────────────────────

export const modal = {
  open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    el.querySelector('.modal-close')?.focus();
    el.addEventListener('click', (e) => {
      if (e.target === el) modal.close(id);
    }, { once: true });
    const closeKey = (e) => {
      if (e.key === 'Escape') { modal.close(id); document.removeEventListener('keydown', closeKey); }
    };
    document.addEventListener('keydown', closeKey);
  },
  close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    document.body.style.overflow = '';
  },
};

// ── SKELETON ─────────────────────────────────────────────────────────────────

export function showSkeleton(container, html) {
  container.innerHTML = html;
}

export function skeletonCards(count = 4) {
  return Array(count).fill('<div class="skeleton skeleton-card"></div>').join('');
}

export function skeletonRows(count = 5) {
  return Array(count).fill(`
    <tr>
      <td colspan="10"><div class="skeleton skeleton-text" style="height:32px;border-radius:var(--radius)"></div></td>
    </tr>
  `).join('');
}

// ── CLIPBOARD ────────────────────────────────────────────────────────────────

export async function copyToClipboard(text, triggerEl = null) {
  try {
    await navigator.clipboard.writeText(text);
    if (triggerEl) {
      triggerEl.classList.add('copied');
      setTimeout(() => triggerEl.classList.remove('copied'), 1800);
    }
    return true;
  } catch {
    return false;
  }
}

// ── DEBOUNCE ──────────────────────────────────────────────────────────────────

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ── THEME ─────────────────────────────────────────────────────────────────────

export function initTheme() {
  const saved = localStorage.getItem('cent_theme') || 'dark';
  setTheme(saved);
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  localStorage.setItem('cent_theme', theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

// ── STATUS HELPERS ────────────────────────────────────────────────────────────

export function statusBadge(status) {
  const map = {
    draft: 'draft',
    awaiting_payment_submission: 'pending',
    awaiting_payment_verification: 'pending',
    payment_verified: 'verified',
    packed: 'packed',
    out_for_delivery: 'delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  const cls = map[status] || 'draft';
  const labels = {
    draft: 'Draft',
    awaiting_payment_submission: 'Awaiting Payment',
    awaiting_payment_verification: 'Verifying Payment',
    payment_verified: 'Payment Verified',
    packed: 'Packed',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return `<span class="badge badge-${cls}">${labels[status] || status}</span>`;
}

export function paymentBadge(status) {
  const map = { none: 'none', submitted: 'submitted', verified: 'verified', rejected: 'rejected' };
  const labels = { none: 'Not Paid', submitted: 'Submitted', verified: 'Verified', rejected: 'Rejected' };
  const cls = map[status] || 'none';
  return `<span class="badge badge-${cls}">${labels[status] || status}</span>`;
}

// ── URL PARAMS ────────────────────────────────────────────────────────────────

export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export function setParams(obj) {
  const url = new URL(window.location.href);
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === '' || v === undefined) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  history.replaceState(null, '', url.toString());
}

// ── PLACEHOLDER IMG ───────────────────────────────────────────────────────────

export function imgFallback(el) {
  el.onerror = null;
  el.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"%3E%3Crect width="400" height="533" fill="%23161616"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" fill="%23444444" font-size="36" letter-spacing="4" font-family="system-ui"%3Ecent%3C/text%3E%3C/svg%3E';
}

// ── DISTRICTS & SECTORS ───────────────────────────────────────────────────────

export const districts = [
  'Bugesera', 'Burera', 'Gakenke', 'Gasabo', 'Gatsibo',
  'Gicumbi', 'Gisagara', 'Huye', 'Kamonyi', 'Karongi',
  'Kayonza', 'Kicukiro', 'Kirehe', 'Muhanga', 'Musanze',
  'Ngoma', 'Ngororero', 'Nyabihu', 'Nyagatare', 'Nyamagabe',
  'Nyamasheke', 'Nyanza', 'Nyarugenge', 'Nyaruguru', 'Rubavu',
  'Ruhango', 'Rulindo', 'Rusizi', 'Rutsiro', 'Rwamagana',
];

export const districtSectors = {
  Bugesera: ['Gashora','Juru','Kamabuye','Mareba','Mayange','Musenyi','Mwogo','Ngeruka','Ntarama','Nyamata','Nyarugenge','Rilima','Ruhuha','Rweru','Shyara'],
  Burera: ['Bungwe','Butaro','Cyanika','Cyeru','Gahunga','Gatebe','Gitovu','Kagogo','Kinoni','Kinyababa','Kivuye','Nemba','Rugarama','Rugendabari','Ruhunde','Rusarabuye','Rwerere'],
  Gakenke: ['Busengo','Coko','Cyabingo','Gakenke','Gashenyi','Janja','Kamubuga','Karambo','Kivuruga','Mataba','Minazi','Muhondo','Muyongwe','Muzo','Nemba','Ruli','Rusasa','Rushashi'],
  Gasabo: ['Bumbogo','Gatsata','Gikomero','Gisozi','Jabana','Jali','Kacyiru','Kimihurura','Kimironko','Kinyinya','Ndera','Nduba','Remera','Rusororo','Rutunga'],
  Gatsibo: ['Gasange','Gatsibo','Gitoki','Kabarore','Kageyo','Kiramuruzi','Kiziguro','Muhura','Murambi','Ngarama','Nyagihanga','Remera','Rugarama','Rwimbogo'],
  Gicumbi: ['Bukure','Bungwe','Byumba','Cyumba','Gicumbi','Kaniga','Manyagiro','Miyove','Mukarange','Muko','Mutete','Nyamiyaga','Nyankenke','Rubaya','Rukomo','Rushaki','Rutare','Ruvune','Rwamiko','Shangasha'],
  Gisagara: ['Gikonko','Gishubi','Kansi','Kibilizi','Kigembe','Mamba','Muganza','Mugombwa','Mukindo','Musha','Ndora','Ninahara','Save'],
  Huye: ['Gishamvu','Huye','Karama','Kigoma','Kinazi','Maraba','Mbazi','Mukura','Ngoma','Ruhashya','Rusatira','Rwaniro','Simbi','Tumba'],
  Kamonyi: ['Gacurabwenge','Karama','Kayenzi','Kayumbu','Mugina','Musambira','Ngamba','Nyamiyaga','Nyarubaka','Rugalika','Rukoma','Runda'],
  Karongi: ['Bwishyura','Gishyita','Gitesi','Mubuga','Murambi','Murundi','Mutuntu','Rubengera','Rugabano','Ruganda','Rwankuba','Twumba'],
  Kayonza: ['Gahini','Kabare','Kabarondo','Mukarange','Murama','Murundi','Mwiri','Ndego','Nyamirama','Rukara','Ruramira','Rwinkwavu'],
  Kicukiro: ['Gahanga','Gatenga','Gikondo','Kagarama','Kanombe','Kicukiro','Kigarama','Masaka','Niboye','Nyarugunga'],
  Kirehe: ['Gahara','Gatore','Kigarama','Kigina','Kirehe','Mahama','Mpanga','Musaza','Mushikiri','Nasho','Nyamugari','Nyarubuye'],
  Muhanga: ['Cyeza','Kabacuzi','Kibangu','Kiyumba','Muhanga','Mushishiro','Nyamabuye','Nyamiyaga','Rongi','Rugendabari'],
  Musanze: ['Busogo','Cyuve','Gacaca','Gashaki','Gataraga','Kimonyi','Kinigi','Muhoza','Muko','Musanze','Nkotsi','Nyange','Remera','Rwaza','Shingiro'],
  Ngoma: ['Gashanda','Jarama','Karembo','Kazo','Kibungo','Mugesera','Murama','Mutenderi','Remera','Rukira','Rukumberi','Rurenge','Sake','Zaza'],
  Ngororero: ['Bwira','Gatumba','Hindiro','Kabaya','Kageyo','Kavumu','Matyazo','Muhanda','Muhororo','Ndaro','Ngororero','Nyange','Sovu'],
  Nyabihu: ['Bigogwe','Jenda','Jomba','Kabatwa','Karago','Kintobo','Mukamira','Muringa','Rambura','Rugera','Rurembo','Shyira'],
  Nyagatare: ['Gatunda','Karama','Karangazi','Katabagemu','Kiyombe','Matimba','Mimuli','Mukama','Musheri','Nyagatare','Orukamba','Rwempasha','Rwimiyaga','Tabagwe'],
  Nyamagabe: ['Buruhukiro','Cyanika','Gasaka','Gatare','Kaduha','Kamegeri','Kibirizi','Kibumbwe','Kitabi','Mbazi','Mugano','Nkomane','Tare','Uwinkingi'],
  Nyamasheke: ['Bushekeri','Bushenge','Cyato','Gihombo','Kagano','Kanjongo','Karambi','Karengera','Kirimbi','Macuba','Mahembe','Nyabitekeri','Rangiro','Ruharambuga','Shangi'],
  Nyanza: ['Busasamana','Cyabakamyi','Kibilizi','Kigoma','Mukingo','Muyira','Ntyazo','Nyagisozi','Rwabicuma'],
  Nyarugenge: ['Gitega','Kanyinya','Kigali','Kimisagara','Mageragere','Muhima','Nyakabanda','Nyamirambo','Nyarugenge','Rwezamenyo'],
  Nyaruguru: ['Busanze','Cyahinda','Kibeho','Kivu','Mata','Muganza','Munini','Ngera','Ngoma','Nyabimata','Nyagisozi','Ruheru','Ruramba','Rusenge'],
  Rubavu: ['Bugeshi','Busasamana','Cyanzarwe','Gisenyi','Kanama','Kanzenze','Mudende','Nyakiliba','Nyamyumba','Nyundo','Rubavu','Rugerero'],
  Ruhango: ['Byimana','Kabagali','Kinazi','Kinihira','Mbuye','Mpanga','Muhanga','Mwendo','Ntongwe','Ruhango'],
  Rulindo: ['Base','Burega','Bushoki','Buyoga','Cyinzuzi','Cyungo','Kinihira','Kisaro','Masoro','Mbogo','Murambi','Ngoma','Ntarabana','Rukozo','Rusiga','Shyorongi','Tumba'],
  Rusizi: ['Bugarama','Butare','Bweyeye','Giheke','Gihundwe','Gikundamvura','Gimbi','Gisuma','Mahama','Nkanka','Nkungu','Nyakarenzo','Nzahaha','Rwimbogo'],
  Rutsiro: ['Boneza','Gihango','Kigeyo','Kivumu','Manihira','Mukura','Murunda','Musasa','Mushonyi','Mushubati','Nyabirasi','Ruhango','Rusebeya'],
  Rwamagana: ['Fumbwe','Gahengeri','Gishari','Karenge','Kigabiro','Muhazi','Munyaga','Munyiginya','Musha','Muyumbu','Mwulire','Nyakaliro','Nzige','Rubona'],
};

// ── RENDER MARKDOWN (basic) ───────────────────────────────────────────────────

export function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/m, '<p>$1</p>');
}
