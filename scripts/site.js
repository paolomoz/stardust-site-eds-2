/* eslint-disable no-underscore-dangle */
/*
 * Site-wide behaviour loaded after the sections: Lenis smooth wheel scrolling (the native scroll
 * position stays the source of truth) and the scroll-driven anchors. Coarse pointers keep native
 * scrolling so the small-screen scroll snap works.
 */

import { reduced } from './motion.js';

async function initLenis() {
  if (reduced || window.matchMedia('(pointer: coarse)').matches) return;
  try {
    await import('./lenis.min.js');
  } catch (e) {
    return;
  }
  if (!window.Lenis || window.__lenis) return;
  window.__lenis = new window.Lenis({
    autoRaf: true, anchors: true, lerp: 0.09, wheelMultiplier: 1, smoothWheel: true,
  });
  // the hero intro locks the page until it is done
  if (document.body.classList.contains('introducing')) {
    window.__lenis.stop();
    document.addEventListener('stardust:intro-done', () => window.__lenis.start(), { once: true });
  }
}

initLenis();
