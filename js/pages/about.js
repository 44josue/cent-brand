import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { initTheme } from '../lib/utils.js';
import { updateCartBadges } from '../lib/cart.js';
import { getLiveCmsImagesBySection } from '../lib/api.js';
import { assetUrl } from '../lib/paths.js';

initTheme();
renderNav();
renderFooter();
updateCartBadges();

const DEFAULT_IMAGES = {
  about_story: assetUrl('assets/images/IMG_7361.JPG.JPEG'),
  about_mission: assetUrl('assets/images/IMG_7432.JPG.JPEG'),
};

async function loadAboutImages() {
  try {
    const live = await getLiveCmsImagesBySection();
    setAboutImage('about-story-img', live.about_story || DEFAULT_IMAGES.about_story);
    setAboutImage('about-mission-img', live.about_mission || DEFAULT_IMAGES.about_mission);
  } catch {
    setAboutImage('about-story-img', DEFAULT_IMAGES.about_story);
    setAboutImage('about-mission-img', DEFAULT_IMAGES.about_mission);
  }
}

function setAboutImage(id, src) {
  const img = document.getElementById(id);
  if (img && src) img.src = src;
}

loadAboutImages();
