/*
 * Cube layer — entry point
 *
 * The only cube script in head.html. It keeps the page light: the engine, the triggers and the
 * puzzle (scripts/cube.js, cube-ui.js, cube-rubik.js with cube.css, cube-ui.css, cube-rubik.css)
 * load on the first activation, not on every page view. Until then the cube cannot be turned
 * from anywhere; the tag is the way in.
 *
 *   - Restores the face of the session before first paint (cube-palettes.css stays in head.html
 *     for that) and, since a stored orientation means the visitor already turned the cube in this
 *     session, loads the whole layer at once.
 *   - Draws the closed tag after load: the strip of face colours and the chevron on the right
 *     edge, styled by styles/cube-tag.css. Hovering, focusing or tapping it opens it and loads
 *     the layer; scripts/cube-ui.js takes the tag over. The panel stays open until its collapse
 *     arrow is clicked.
 *   - Prefetches the layer when the pointer approaches the right edge, so the tag opens without
 *     a wait: stylesheets are applied (they only style cube elements) and the modules are
 *     preloaded but not run.
 *   - Alt + arrow keys work from the start: they load the layer and turn.
 *
 * Small screens and touch devices get nothing but the face restore (see scripts/cube-ui.js).
 */

const STORAGE_KEY = 'cube-orientation';
const STYLES = ['cube', 'cube-ui', 'cube-rubik'];
const SCRIPTS = ['cube', 'cube-ui', 'cube-rubik']; // in dependency order
const APPROACH = 160; // px from the right edge that starts the prefetch
const LOOK = {
  ArrowLeft: 'right', ArrowRight: 'left', ArrowUp: 'down', ArrowDown: 'up',
};

const base = new URL('.', import.meta.url); // /scripts/
const styleHref = (name) => new URL(`../styles/${name}.css`, base).href;
const scriptHref = (name) => new URL(`./${name}.js`, base).href;

/* ---------------------------------------------------------------- face restore */

let storedFront = null;
try {
  const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (stored && typeof stored.front === 'string') storedFront = stored.front;
} catch (e) {
  // no storage, default face
}
if (storedFront && storedFront !== 'front') {
  document.documentElement.setAttribute('data-cube-face', storedFront);
}

/* ---------------------------------------------------------------- loading */

const links = {};
function loadStyle(href) {
  if (!links[href]) {
    links[href] = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    });
  }
  return links[href];
}

let prefetched = false;
function prefetch() {
  if (prefetched) return;
  prefetched = true;
  STYLES.forEach((n) => loadStyle(styleHref(n)));
  SCRIPTS.forEach((n) => {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = scriptHref(n);
    document.head.append(link);
  });
}

let loading = null;
let loaded = false;
function loadLayer() {
  if (!loading) {
    loading = (async () => {
      await Promise.all(STYLES.map((n) => loadStyle(styleHref(n))));
      // one after the other: cube-ui.js and cube-rubik.js read window.cube on evaluation
      await SCRIPTS.reduce((p, n) => p.then(() => import(scriptHref(n))), Promise.resolve());
      loaded = true;
    })();
  }
  return loading;
}

/* ---------------------------------------------------------------- the tag */

/* the panel opens when the pointer or focus arrives and stays open: only its arrow (or Escape)
   slides it back. scripts/cube-ui.js builds the same pair when it draws the tag itself. */
function openOn(box) {
  const open = () => box.classList.add('open');
  box.addEventListener('pointerenter', open);
  box.addEventListener('focusin', open);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') box.classList.remove('open');
  });
}

function closeArrow(box) {
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cube-tag-close';
  close.setAttribute('data-cube-exclude', '');
  close.setAttribute('aria-label', 'Put the cube away');
  close.title = 'Put the cube away';
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    box.classList.remove('open');
  });
  return close;
}

function tag() {
  const el = (t, className) => {
    const node = document.createElement(t);
    node.className = className;
    node.setAttribute('data-cube-exclude', '');
    return node;
  };
  const box = el('div', 'cube-tag');
  const strip = el('div', 'cube-tag-strip');
  ['right', 'left', 'top', 'bottom', 'back'].forEach((name) => {
    const swatch = el('i', 'cube-tag-swatch');
    swatch.setAttribute('data-cube-face', name);
    strip.append(swatch);
  });
  box.append(strip, el('i', 'cube-tag-arrow'), closeArrow(box));
  openOn(box);
  box.tabIndex = 0;
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Turn the page');
  box.title = 'Turn the page';
  ['pointerenter', 'pointerdown', 'focus'].forEach((t) => {
    box.addEventListener(t, loadLayer, { once: true });
  });
  document.body.append(box);
  return box;
}

function keyboard() {
  const onKey = (e) => {
    if (loaded) {
      // scripts/cube-ui.js listens now
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (!e.altKey || e.metaKey || e.ctrlKey || !LOOK[e.key]) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    document.removeEventListener('keydown', onKey);
    const { key } = e;
    loadLayer().then(() => {
      document.dispatchEvent(new CustomEvent('cube:rotate', { detail: { direction: LOOK[key] } }));
    });
  };
  document.addEventListener('keydown', onKey);
}

function approach() {
  const onMove = (e) => {
    if (window.innerWidth - e.clientX > APPROACH) return;
    window.removeEventListener('pointermove', onMove);
    prefetch();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
}

/* ---------------------------------------------------------------- init */

if (!window.matchMedia('(width <= 900px), (pointer: coarse)').matches) {
  if (storedFront) {
    loadLayer();
  } else {
    const init = async () => {
      await loadStyle(styleHref('cube-tag'));
      const box = tag();
      keyboard();
      approach();
      const show = () => box.classList.add('show');
      if (document.readyState === 'complete') show();
      else window.addEventListener('load', show, { once: true });
    };
    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });
  }
}
