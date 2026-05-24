// Register service worker and handle PWA install prompt
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(() => {}); // Fail silently — SW is a progressive enhancement
  });
}

// PWA install prompt — capture and surface as a button
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show install button if it exists on the page
  const btn = document.getElementById('pwa-install-btn');
  if (btn) {
    btn.classList.remove('hidden');
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') btn.classList.add('hidden');
    }, { once: true });
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('pwa-install-btn')?.classList.add('hidden');
});
