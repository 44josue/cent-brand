import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { initTheme } from '../lib/utils.js';
import { pageUrl } from '../lib/paths.js';

initTheme();
renderNav();
renderFooter();

document.getElementById('main-content').innerHTML = `
  <div style="max-width:780px;margin:0 auto;padding:var(--space-16) var(--space-6)">
    <h1 style="font-size:var(--text-4xl);font-weight:900;margin-bottom:var(--space-2)">Terms of Use</h1>
    <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-12)">Last updated: May 2026</p>

    <div class="legal-body">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the CENT website (cent.rw), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our site.</p>
      </section>

      <section>
        <h2>2. Products & Pricing</h2>
        <p>All prices are displayed in Rwandan Francs (RWF). We reserve the right to update prices at any time. Orders are confirmed at the price displayed at the time of checkout. We make every effort to accurately display product colors, but we cannot guarantee your screen will reproduce colors exactly.</p>
      </section>

      <section>
        <h2>3. Orders & Payment</h2>
        <p>Placing an order constitutes an offer to purchase. Orders are confirmed only after payment verification by our team. We accept MTN Mobile Money, Airtel Money, and bank transfer. Payment must be completed within 24 hours of placing an order, or the order may be cancelled.</p>
      </section>

      <section>
        <h2>4. Shipping & Delivery</h2>
        <p>We deliver within Rwanda. Estimated delivery times are provided at checkout and are not guaranteed. CENT is not responsible for delays caused by third-party delivery services. Risk of loss passes to you upon delivery.</p>
      </section>

      <section>
        <h2>5. Returns & Exchanges</h2>
        <p>We accept exchanges on unworn, unwashed items with tags attached within 7 days of delivery. Items must be returned in original packaging. Sale items are final sale. To initiate an exchange, contact us at <a href="mailto:hello@cent.rw">hello@cent.rw</a>.</p>
      </section>

      <section>
        <h2>6. Intellectual Property</h2>
        <p>All content on this site — including logos, product imagery, copy, and design — is owned by CENT and protected by copyright. You may not reproduce, distribute, or use our content without written permission.</p>
      </section>

      <section>
        <h2>7. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. CENT is not liable for losses resulting from unauthorized use of your account.</p>
      </section>

      <section>
        <h2>8. Prohibited Conduct</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the site for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Interfere with the proper functioning of the site</li>
          <li>Submit false or fraudulent orders</li>
          <li>Resell CENT products without written authorization</li>
        </ul>
      </section>

      <section>
        <h2>9. Limitation of Liability</h2>
        <p>CENT's liability to you for any cause whatsoever shall not exceed the amount you paid for the order in question. We are not liable for indirect, incidental, or consequential damages.</p>
      </section>

      <section>
        <h2>10. Governing Law</h2>
        <p>These terms are governed by the laws of the Republic of Rwanda. Any disputes shall be resolved in the courts of Kigali, Rwanda.</p>
      </section>

      <section>
        <h2>11. Changes to Terms</h2>
        <p>We may modify these terms at any time. Changes will be posted on this page with an updated date. Continued use of the site constitutes acceptance of the revised terms.</p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>Questions about these terms? Email us at <a href="mailto:hello@cent.rw">hello@cent.rw</a> or visit our <a href="${pageUrl('contact/')}">contact page</a>.</p>
      </section>
    </div>
  </div>

  <style>
    .legal-body { display: flex; flex-direction: column; gap: var(--space-8); }
    .legal-body section h2 {
      font-size: var(--text-lg);
      font-weight: 700;
      margin-bottom: var(--space-3);
      color: var(--text-primary);
    }
    .legal-body p, .legal-body li {
      font-size: var(--text-base);
      color: var(--text-secondary);
      line-height: 1.8;
    }
    .legal-body ul {
      padding-left: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-top: var(--space-2);
    }
    .legal-body a { color: var(--accent); text-decoration: underline; }
  </style>
`;
