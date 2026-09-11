/*
 * Motion helpers shared by the blocks.
 *   - one IntersectionObserver adds `.in` to revealed elements (CSS in styles.css does the rest)
 *   - stagger() numbers the children of [data-stagger] parents into --i
 *   - splitLines() turns a <br>-separated heading into masked reveal lines
 *   - plus() makes the small "+" glyph used on links and buttons
 * Every animation honours prefers-reduced-motion.
 */

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const callbacks = new WeakMap();
let io;

function ensureObserver() {
  if (io) return io;
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
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
