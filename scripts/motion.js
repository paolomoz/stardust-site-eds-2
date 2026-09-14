/*
 * Motion helpers shared by the blocks.
 *   - one IntersectionObserver adds `.in` to revealed elements (CSS in styles.css does the rest)
 *   - stagger() numbers the children of [data-stagger] parents into --i
 *   - splitLines() turns a <br>-separated heading into masked reveal lines
 *   - plus() makes the small "+" glyph used on links and buttons
 * Every animation honours prefers-reduced-motion.
 */

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* small screens get the plain layout: no pinned stages, no intro, no scroll-driven staging */
export const mobile = window.matchMedia('(width <= 900px)').matches;

/* the desktop page runs the pipeline as one scroll-driven scene (scripts/scene.js); the flag is set
   on <html> by scripts.js before any block decorates, so blocks can leave staging to the scene */
export const scene = document.documentElement.classList.contains('scene');

const callbacks = new WeakMap();
const deferred = new Set(); // reveal targets inside a scene layer that is not on stage yet
let io;

function ensureObserver() {
  if (io) return io;
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      // a layer waiting behind another screen intersects the viewport but is not seen: hold the
      // reveal until scene.js wakes the layer
      if (e.target.closest('.sc-layer.waiting')) {
        io.unobserve(e.target);
        deferred.add(e.target);
        return;
      }
      e.target.classList.add('in');
      const fn = callbacks.get(e.target);
      if (fn) fn(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  return io;
}

/**
 * Adds `.in` to `el` when it scrolls into view; `fn(el)` runs once at that moment.
 * @param {Element} el
 * @param {Function} [fn]
 */
export function observe(el, fn) {
  if (!el) return;
  if (fn) callbacks.set(el, fn);
  ensureObserver().observe(el);
}

/** Re-observes the deferred reveal targets inside `root`, so they play now (scene layers). */
export function wake(root) {
  deferred.forEach((el) => {
    if (root.contains(el)) {
      deferred.delete(el);
      ensureObserver().observe(el);
    }
  });
}

/** Observes every reveal target inside `root` (data-reveal, .lines) plus any extra selector. */
export function reveal(root, extra = '') {
  const sel = `[data-reveal], .lines${extra ? `, ${extra}` : ''}`;
  root.querySelectorAll(sel).forEach((el) => observe(el));
  if (root.matches(sel)) observe(root);
}

/** Numbers the children of each [data-stagger] inside `root` into --i. */
export function stagger(root) {
  const parents = [...root.querySelectorAll('[data-stagger]')];
  if (root.hasAttribute && root.hasAttribute('data-stagger')) parents.unshift(root);
  parents.forEach((el) => {
    const sel = el.getAttribute('data-stagger') || ':scope > *';
    [...el.querySelectorAll(sel)].forEach((c, i) => c.style.setProperty('--i', i));
  });
}

/**
 * Turns the <br>-separated content of `el` into `<span class="line"><span>…</span></span>`
 * runs and marks `el` as a `.lines` reveal target. Inline children (em, strong, code) move
 * whole; the element keeps its tag, attributes and text.
 * @param {Element} el an authored heading or paragraph
 * @param {string} [delay] optional --d for the reveal (e.g. '200ms')
 * @returns {Element} el
 */
export function splitLines(el, delay) {
  if (!el || el.querySelector(':scope > .line')) return el;
  const groups = [[]];
  [...el.childNodes].forEach((n) => {
    if (n.nodeName === 'BR') groups.push([]);
    else groups[groups.length - 1].push(n);
  });
  const lines = groups
    .filter((g) => g.some((n) => n.nodeType === 1 || n.textContent.trim()))
    .map((g, i) => {
      const line = document.createElement('span');
      line.className = 'line';
      if (i) line.style.setProperty('--i', i);
      const inner = document.createElement('span');
      inner.append(...g);
      line.append(inner);
      return line;
    });
  el.replaceChildren(...lines);
  el.classList.add('lines');
  if (delay) el.style.setProperty('--d', delay);
  return el;
}

/**
 * A drawn arrow icon in the plus icon's stroke, replacing text glyphs (→ ↓) used as icons.
 * @param {'right'|'down'} dir
 * @returns {SVGElement}
 */
export function arrow(dir = 'right') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', dir === 'down' ? 'M8 2.5v11M3.5 9 8 13.5 12.5 9' : 'M2.5 8h11M9 3.5 13.5 8 9 12.5');
  svg.append(path);
  return svg;
}

/** @returns {HTMLElement} the "+" glyph */
export function plus() {
  const i = document.createElement('i');
  i.className = 'plus';
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/**
 * Classifies the paragraphs of a cell: returns the first paragraph whose only element child is
 * `tag` (e.g. 'code', 'strong', 'em') and whose text is otherwise empty.
 */
export function onlyChild(p, tag) {
  return p && p.children.length === 1 && p.firstElementChild.matches(tag)
    && p.textContent.trim() === p.firstElementChild.textContent.trim();
}
