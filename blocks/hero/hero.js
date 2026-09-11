/*
 * hero — the opening stage: a shader half with the brand lockup and a light half with the
 * headline. Template-slotted (stardust/eds-conversion-log.md): the prototype DOM is rebuilt
 * and the authored elements are MOVED into their slots.
 *
 * Authoring rows (single cell each, classified by content, not by index):
 *   - version tag            <p>v0.19.8</p>                         (starts with v + digit)
 *   - kicker                 <p>Takes a website…<br>… <em>Or all three.</em></p>
 *   - seed line              <p><strong>seed</strong> yours alone, today only</p>
 *   - headline               <h1>Redesign<br>the Web.</h1>          (<br> = line break)
 *   - scroll link            <p><a href="#ways">Scroll</a></p>
 * The mark and the wordmark are brand assets, not copy. The seed hash is generated at load.
 */

import mountHero from './nebula.js';
import { splitLines, reduced } from '../../scripts/motion.js';
import { seedHash, todayISO } from '../../scripts/seed.js';

const MARK = `<svg class="hero-mark" viewBox="0 0 280 280" data-reveal="scale" style="--i:1" aria-hidden="true">
  <g class="f-gold">
    <rect x="128" y="34" width="24" height="24"/><rect x="128" y="62" width="24" height="24" opacity="0.7"/>
    <rect x="128" y="90" width="24" height="24" opacity="0.5"/><rect x="128" y="166" width="24" height="24" opacity="0.5"/>
    <rect x="128" y="194" width="24" height="24" opacity="0.7"/><rect x="128" y="222" width="24" height="24"/>
    <rect x="34" y="128" width="24" height="24"/><rect x="62" y="128" width="24" height="24" opacity="0.7"/>
    <rect x="90" y="128" width="24" height="24" opacity="0.5"/><rect x="166" y="128" width="24" height="24" opacity="0.5"/>
    <rect x="194" y="128" width="24" height="24" opacity="0.7"/><rect x="222" y="128" width="24" height="24"/>
  </g>
  <rect x="118" y="118" width="44" height="44" class="f-coral"/>
  <g class="f-gold" opacity="0.6">
    <rect x="82" y="82" width="18" height="18"/><rect x="180" y="82" width="18" height="18"/>
    <rect x="82" y="180" width="18" height="18"/><rect x="180" y="180" width="18" height="18"/>
  </g>
</svg>`;

const EXPAND = 1250;
const HOLD = 200;
const SLIDE = 1150;

const el = (tag, className, attrs = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

/** Wraps a trailing "." of the last text node in an accent span (the coral full stop). */
function accentPeriod(heading) {
  const last = heading.querySelector('.line:last-child > span') || heading;
  const text = [...last.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!text || !text.textContent.trimEnd().endsWith('.')) return;
  const idx = text.textContent.lastIndexOf('.');
  const tail = text.splitText(idx);
  const accent = el('span', 'accent');
  accent.append(tail);
  last.append(accent);
}

/** Inserts today's hash after the authored <strong>seed</strong> label. */
function decorateSeed(p) {
  const label = p.querySelector('strong');
  const hash = el('span', 'hash');
  hash.append(`md5("brand" · ${todayISO()}) → ${seedHash('brand')} ·`);
  const rest = [...p.childNodes].filter((n) => n !== label);
  if (rest[0] && !/^\s/.test(rest[0].textContent)) hash.append(' ');
  hash.append(...rest);
  p.append(hash);
}

function runIntro(block, visual, textHalf, onDone) {
  const lockup = visual.querySelector('.hero-lockup');
  const show = (root) => root.querySelectorAll('.lines, [data-reveal]').forEach((n) => n.classList.add('in'));
  const start = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // flush the collapsed state so the transition has a start value
      getComputedStyle(lockup).getPropertyValue('transform');
      block.classList.remove('intro-lockup'); // 1. expand
      show(visual);
      setTimeout(() => {
        block.classList.remove('intro'); // 3. slide up
        setTimeout(() => show(textHalf), 260);
        setTimeout(onDone, SLIDE);
      }, EXPAND + HOLD);
    }));
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

export default async function decorate(block) {
  const nodes = [...block.querySelectorAll(':scope > div > div')].flatMap((c) => [...c.children]);
  const heading = nodes.find((n) => /^H[1-6]$/.test(n.tagName));
  const ps = nodes.filter((n) => n.tagName === 'P');
  const version = ps.find((p) => /^v\d/.test(p.textContent.trim()));
  const seed = ps.find((p) => p.firstElementChild && p.firstElementChild.tagName === 'STRONG'
    && p.firstElementChild === p.firstChild);
  const scroll = ps.find((p) => p.querySelector('a'));
  const kicker = ps.find((p) => p !== version && p !== seed && p !== scroll);

  // visual half
  const visual = el('div', 'hero-visual');
  const canvas = el('canvas', '', { 'aria-hidden': 'true' });
  const lockup = el('div', 'hero-lockup', { 'aria-hidden': 'true' });
  lockup.innerHTML = MARK;
  const word = el('div', 'hero-word lines');
  word.style.setProperty('--d', '200ms');
  word.innerHTML = '<span class="line"><span>stardust</span></span>';
  lockup.append(word);
  const slot = el('div', 'hero-slot');
  slot.append(lockup);
  const top = el('div', 'top');
  top.append(el('span'));
  if (version) {
    const ver = el('div', 'ver mono', { 'data-reveal': 'fade' });
    ver.style.setProperty('--i', 4);
    ver.append(version);
    top.append(ver);
  }
  visual.append(canvas, slot, top);

  // text half
  const textHalf = el('div', 'hero-text');
  const bottom = el('div', 'bottom');
  const left = el('div', 'left');
  if (kicker) {
    const k = el('div', 'kicker');
    k.append(splitLines(kicker, '300ms'));
    left.append(k);
  }
  if (seed) {
    const s = el('div', 'seed-line', { 'data-reveal': '' });
    s.style.setProperty('--i', 6);
    decorateSeed(seed);
    s.append(seed);
    left.append(s);
  }
  bottom.append(left);
  if (heading) {
    const title = el('div', 'title t-hero');
    splitLines(heading, '250ms');
    accentPeriod(heading);
    title.append(heading);
    bottom.append(title);
  }
  textHalf.append(bottom);
  if (scroll) {
    const s = el('div', 'scroll', { 'data-reveal': 'fade' });
    s.style.setProperty('--i', 8);
    const a = scroll.querySelector('a');
    const arrow = el('span', 'arrow');
    arrow.textContent = '↓';
    a.append(' ', arrow);
    s.append(scroll);
    textHalf.append(s);
  }

  block.replaceChildren(visual, textHalf);
  block.classList.add('intro', 'intro-lockup');
  block.style.setProperty('--px', 0);
  block.style.setProperty('--py', 0);
  block.style.setProperty('--energy', 0);

  // the hero canvas: nebula shader, 2D fallback
  const hero = mountHero(canvas);
  if (!reduced) {
    const p = hero.pointer;
    let lx = p.x;
    let ly = p.y;
    let energy = 0;
    const sync = () => {
      block.style.setProperty('--px', ((p.x - 0.5) * 2).toFixed(4));
      block.style.setProperty('--py', ((p.y - 0.5) * 2).toFixed(4));
      let v = Math.hypot(p.x - lx, p.y - ly) * 60;
      lx = p.x;
      ly = p.y;
      if (v < 0.08) v = 0;
      energy += (Math.min(1, v) - energy) * (v > energy ? 0.18 : 0.05);
      hero.setEnergy(energy);
      block.style.setProperty('--energy', energy.toFixed(3));
      const r = lockup.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      hero.setLogo(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top + 10);
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  }

  // intro sequence: full-height shader panel → lockup expands → hold → panel slides to 50%
  const done = () => {
    document.body.classList.remove('introducing');
    document.documentElement.dataset.intro = 'done';
    document.dispatchEvent(new CustomEvent('stardust:intro-done'));
  };
  if (reduced) {
    block.classList.remove('intro', 'intro-lockup');
    block.querySelectorAll('.lines, [data-reveal]').forEach((n) => n.classList.add('in'));
    done();
  } else {
    document.body.classList.add('introducing');
    runIntro(block, visual, textHalf, done);
  }
}
