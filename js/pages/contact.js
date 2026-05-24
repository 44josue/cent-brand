import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { callEdge } from '../lib/api.js';
import { initTheme, toast } from '../lib/utils.js';
import { updateCartBadges } from '../lib/cart.js';

initTheme();
renderNav();
renderFooter();
updateCartBadges();

document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name    = document.getElementById('contact-name').value.trim();
  const email   = document.getElementById('contact-email').value.trim();
  const phone   = document.getElementById('contact-phone').value.trim();
  const subject = document.getElementById('contact-subject').value;
  const body    = document.getElementById('contact-body').value.trim();

  let valid = true;
  const fields = [
    { id: 'contact-name',    ok: name.length >= 2 },
    { id: 'contact-email',   ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) },
    { id: 'contact-subject', ok: !!subject },
    { id: 'contact-body',    ok: body.length >= 10 },
  ];

  fields.forEach(({ id, ok }) => {
    const el = document.getElementById(id);
    const grp = el?.closest('.input-group');
    if (!ok) { grp?.classList.add('has-error'); el?.classList.add('input-error'); valid = false; }
    else { grp?.classList.remove('has-error'); el?.classList.remove('input-error'); }
  });

  if (!valid) { toast.error('Please fill in all required fields.'); return; }

  const btn = document.getElementById('contact-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    await callEdge('send-contact', { fullName: name, email, phone: phone || undefined, subject, message: body });
    document.getElementById('contact-form-wrap').classList.add('hidden');
    document.getElementById('contact-success').classList.remove('hidden');
  } catch (err) {
    console.error('contact:', err);
    toast.error(err.message || 'Could not send message. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
});
