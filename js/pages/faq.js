import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { getFaqItems } from '../lib/api.js';
import { initTheme } from '../lib/utils.js';
import { updateCartBadges } from '../lib/cart.js';

initTheme();
renderNav();
renderFooter();
updateCartBadges();
loadFaqs();

async function loadFaqs() {
  const list = document.getElementById('faq-list');
  if (!list) return;

  try {
    const items = await getFaqItems();

    if (!items.length) {
      list.innerHTML = '<p style="color:var(--text-muted)">No FAQ items yet.</p>';
      return;
    }

    list.innerHTML = items.map((item, i) => `
      <div class="accordion-item" id="faq-${item.id}">
        <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-body-${item.id}">
          <span>${item.question}</span>
          <svg class="accordion-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7"/>
          </svg>
        </button>
        <div class="accordion-body" id="faq-body-${item.id}" role="region">
          <div class="accordion-body-inner">${item.answer}</div>
        </div>
      </div>
    `).join('');

    initAccordion();
  } catch (err) {
    console.error('loadFaqs:', err);
    list.innerHTML = '<p style="color:var(--text-muted)">Could not load FAQ.</p>';
  }
}

function initAccordion() {
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const body = item.querySelector('.accordion-body');
      const bodyInner = body.querySelector('.accordion-body-inner');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.accordion-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
        openItem.querySelector('.accordion-body').style.maxHeight = '0';
      });

      // Open clicked if it was closed
      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        body.style.maxHeight = bodyInner.scrollHeight + 'px';
      }
    });
  });
}
