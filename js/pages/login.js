import { renderNav } from '../components/nav.js';
import { signIn, signUp, sendPasswordReset, getUser } from '../lib/auth.js';
import { initTheme, getParam, toast, initPasswordToggles } from '../lib/utils.js';
import { mergeCartOnLogin as mergeCart } from '../lib/cart.js';
import { pageUrl } from '../lib/paths.js';

initTheme();
initPasswordToggles();
renderNav();

const redirectTo = getParam('redirect') || pageUrl();
const mode = getParam('mode');

// Already logged in?
getUser().then(user => {
  if (user) window.location.href = redirectTo;
});

setupTabs();
setupSignIn();
setupSignUp();
setupForgotPassword();

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

function setupSignIn() {
  const form = document.getElementById('signin-form');
  const btn = document.getElementById('signin-btn');
  const errorEl = document.getElementById('signin-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    if (!email || !password) { toast.error('Please fill in all fields.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';
    if (errorEl) errorEl.classList.add('hidden');

    try {
      const { user } = await signIn(email, password);
      await mergeCart(user?.id);
      window.location.href = redirectTo;
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Invalid email or password.';
        errorEl.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function setupSignUp() {
  const form = document.getElementById('signup-form');
  const btn = document.getElementById('signup-btn');
  const errorEl = document.getElementById('signup-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    let valid = true;
    if (!name) { markErr('signup-name'); valid = false; } else clearErr('signup-name');
    if (!email || !email.includes('@')) { markErr('signup-email'); valid = false; } else clearErr('signup-email');
    if (!password || password.length < 8) { markErr('signup-password'); valid = false; } else clearErr('signup-password');
    if (password !== confirm) { markErr('signup-confirm'); valid = false; } else clearErr('signup-confirm');

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account...';
    if (errorEl) errorEl.classList.add('hidden');

    try {
      const { user } = await signUp(email, password, name);
      if (user) await mergeCart(user.id);
      toast.success('Account created! Welcome to CENT.');
      window.location.href = redirectTo;
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Could not create account.';
        errorEl.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

function setupForgotPassword() {
  document.getElementById('forgot-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('signin-email').value.trim();
    if (!email) {
      toast.error('Enter your email address first, then click Forgot.');
      return;
    }
    try {
      await sendPasswordReset(email);
      toast.success('Password reset email sent. Check your inbox.');
    } catch (err) {
      toast.error(err.message || 'Could not send reset email.');
    }
  });
}

function markErr(id) {
  document.getElementById(id)?.closest('.input-group')?.classList.add('has-error');
  document.getElementById(id)?.classList.add('input-error');
}
function clearErr(id) {
  document.getElementById(id)?.closest('.input-group')?.classList.remove('has-error');
  document.getElementById(id)?.classList.remove('input-error');
}
