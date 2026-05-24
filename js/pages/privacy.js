import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { initTheme } from '../lib/utils.js';

initTheme();
renderNav();
renderFooter();

document.getElementById('main-content').innerHTML = `
  <div style="max-width:780px;margin:0 auto;padding:var(--space-16) var(--space-6)">
    <h1 style="font-size:var(--text-4xl);font-weight:900;margin-bottom:var(--space-2)">Privacy Policy</h1>
    <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-12)">Last updated: May 2026</p>

    <div class="legal-body">
      <section>
        <h2>1. Information We Collect</h2>
        <p>When you use CENT, we collect information you provide directly — such as your name, email address, phone number, and delivery address when you create an account or place an order. We also collect order history and payment confirmation details (we do not store full payment credentials).</p>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Process and fulfill your orders</li>
          <li>Send order confirmations and status updates</li>
          <li>Respond to customer service requests</li>
          <li>Send marketing emails if you have subscribed (you can unsubscribe at any time)</li>
          <li>Improve our site and product offerings</li>
        </ul>
      </section>

      <section>
        <h2>3. Sharing Your Information</h2>
        <p>We do not sell your personal information. We may share it with third-party service providers who help us operate our business (e.g. email delivery via Resend, database hosting via Supabase). These providers are bound by confidentiality agreements and may only use your data to perform services on our behalf.</p>
      </section>

      <section>
        <h2>4. Payment Information</h2>
        <p>CENT processes payments via MTN Mobile Money, Airtel Money, and bank transfer. When you submit a payment, we receive a confirmation reference number only. We do not store your full MoMo PIN, bank account details, or card numbers.</p>
      </section>

      <section>
        <h2>5. Cookies & Local Storage</h2>
        <p>We use browser-based storage to make the site work properly. Here is exactly what we store:</p>
        <ul>
          <li><strong>Essential (always on):</strong> Authentication tokens managed by Supabase (sb-* cookies), your cart session ID, and order tracking tokens. These are required for the site to function.</li>
          <li><strong>Functional (with your consent):</strong> Your theme preference (dark/light) and wishlist, stored in localStorage. These make the site more convenient but are not required.</li>
        </ul>
        <p style="margin-top:var(--space-3)">We do not use Google Analytics, Facebook Pixel, advertising networks, or any cross-site tracking. No data is sold to third parties.</p>
        <p style="margin-top:var(--space-3)">
          When you first visit CENT, we ask for your cookie preference.
          You can reset your choice at any time by clearing your browser's site data for cent.rw, or by clicking
          <button onclick="try{localStorage.removeItem('cent_cookies');window.location.reload()}catch{}" style="background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;font-size:inherit;padding:0">reset my cookie preference</button>.
        </p>
      </section>

      <section>
        <h2>6. Data Retention</h2>
        <p>We retain your account information for as long as your account is active. Order records are retained for at least 3 years for accounting purposes. You may request deletion of your account and personal data at any time by contacting us.</p>
      </section>

      <section>
        <h2>7. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:hello@cent.rw">hello@cent.rw</a>. We will respond within 14 days.</p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>We use industry-standard security measures including HTTPS, row-level security on our database, and secure authentication. However, no method of transmission over the internet is 100% secure.</p>
      </section>

      <section>
        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify registered users of significant changes via email. Continued use of the site after changes constitutes acceptance of the updated policy.</p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>For any privacy-related questions, contact us at <a href="mailto:hello@cent.rw">hello@cent.rw</a> or visit our <a href="/contact/">contact page</a>.</p>
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
