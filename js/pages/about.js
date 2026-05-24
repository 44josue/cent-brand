import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { initTheme } from '../lib/utils.js';
import { updateCartBadges } from '../lib/cart.js';

initTheme();
renderNav();
renderFooter();
updateCartBadges();
