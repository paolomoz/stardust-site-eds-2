/*
 * header — the fixed nav and the gold scroll progress bar. Template-slotted from the /nav
 * document (stardust/eds-conversion-log.md):
 *   section 1  brand link            <p><a href="/">stardust</a></p>
 *   section 2  link list   <ul><li><strong><a>Install</a></strong></li><li><a>…</a></li></ul>
 *              a <strong>-wrapped link is the gold CTA cell; the others are the "flyers"
 *   section 3  tools (right side)    <p><a href="https://github.com/…">GitHub</a></p>
 * Behaviour: hide on scroll down / show on scroll up, progress bar, and the arrival: after the
 * hero intro the flyers travel in from the right and crash into the CTA with a spark burst.
 */

import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { plus, reduced } from '../../scripts/motion.js';

const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><g class="f-gold">
<rect x="14" y="2" width="4" height="4"/><rect x="14" y="26" width="4" height="4"/>
<rect x="2" y="14" width="4" height="4"/><rect x="26" y="14" width="4" height="4"/>
<rect x="14" y="8" width="4" height="4" opacity=".7"/><rect x="14" y="20" width="4" height="4" opacity=".7"/>
<rect x="8" y="14" width="4" height="4" opacity=".7"/><rect x="20" y="14" width="4" height="4" opacity=".7"/>
</g><rect x="13" y="13" width="6" height="6" class="f-coral"/></svg>`;

const GAP = 380;
const DUR = 1300;

function sparks(x, y, count) {
  const box = document.createElement('div');
  box.className = 'sparks';
  box.setAttribute('data-cube-exclude', '');
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  const cs = getComputedStyle(document.documentElement);
  const tok = (n) => cs.getPropertyValue(n).trim();
  const colors = ['--gold', '--gold', '--text', '--text', '--text', '--coral'].map(tok);
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('i');
    const ang = (Math.random() * 1.6 - 0.8) * Math.PI; // mostly rightward, off the impact face
    const dist = 26 + Math.random() * 80;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist * 0.9 + 18}px`);
    p.style.setProperty('--r', `${Math.round(Math.random() * 180 - 90)}deg`);
    p.style.setProperty('--s', `${2 + Math.round(Math.random() * 2)}px`);
    p.style.setProperty('--d', `${Math.round(Math.random() * 60)}ms`);
    p.style.setProperty('--c', colors[i % colors.length]);
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2300);
}

/** Redesign + Migrate slide in from their parking spot against GitHub and crash into Install. */
function arrival(nav) {
  const flyers = [...nav.querySelectorAll('.flyer')];
  const cta = nav.querySelector('.cta');
  if (!flyers.length || reduced) return;
  const last = nav.lastElementChild !== nav.querySelector('.spacer') ? nav.lastElementChild : null;
  let parkRight = last ? last.getBoundingClientRect().left : window.innerWidth;
  const froms = [...flyers].reverse().map((f) => {
    const r = f.getBoundingClientRect();
    const from = parkRight - r.right;
    parkRight -= r.width;
    return from;
  }).reverse();
  flyers.forEach((f, k) => {
    f.style.setProperty('--from', `${Math.round(froms[k])}px`);
    f.style.animationDelay = `${k * GAP}ms`;
    f.classList.add('fly');
    setTimeout(() => {
      const target = k === 0 ? cta : flyers[k - 1];
      if (k === 0 && cta) cta.classList.add('hit');
      if (target) {
        const r = target.getBoundingClientRect();
        sparks(r.right, r.top + r.height / 2, k === 0 ? 26 : 16);
      }
    }, k * GAP + DUR * 0.7);
  });
  setTimeout(() => flyers.forEach((f) => {
    f.classList.remove('fly');
    f.style.removeProperty('--from');
    f.style.animationDelay = '';
  }), DUR + GAP * (flyers.length - 1) + 200);
}

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  block.textContent = '';
  if (!fragment) return;

  const [brandSec, linksSec, toolsSec] = [...fragment.children];
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Primary');

  const brand = brandSec && brandSec.querySelector('a');
  if (brand) {
    brand.className = 'brand';
    brand.insertAdjacentHTML('afterbegin', MARK);
    nav.append(brand);
  }
  if (linksSec) {
    linksSec.querySelectorAll('li').forEach((li) => {
      const a = li.querySelector('a');
      if (!a) return;
      a.className = a.closest('strong') ? 'cta kick' : 'flyer';
      a.append(' ', plus());
      nav.append(a);
    });
  }
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  nav.append(spacer);
  if (toolsSec) {
    toolsSec.querySelectorAll('a').forEach((a) => {
      a.className = '';
      a.append(' ', plus());
      nav.append(a);
    });
  }

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.append(document.createElement('span'));
  block.append(nav, progress);

  // hide on scroll down, show on scroll up; gold progress bar
  const bar = progress.firstElementChild;
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${Math.min(1, max > 0 ? y / max : 0)})`;
    if (y > 120 && y > lastY + 4) nav.classList.add('hide');
    else if (y < lastY - 4 || y < 120) nav.classList.remove('hide');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // the arrival plays once the hero intro releases the page
  if (document.documentElement.dataset.intro === 'done') arrival(nav);
  else document.addEventListener('stardust:intro-done', () => arrival(nav), { once: true });
}
