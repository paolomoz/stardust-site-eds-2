/*
 * Palette reader for the shaders. Reads the P10 tokens from <html> and notifies subscribers
 * when the cube layer changes face (it overrides the tokens on [data-cube-face]).
 */

const NAMES = ['page', 'navy', 'glow', 'gold', 'text', 'coral'];
const subscribers = new Set();
let probe;
let observing = false;

function toRGB(value) {
  if (!probe) {
    probe = document.createElement('i');
    probe.style.display = 'none';
    document.documentElement.append(probe);
  }
  probe.style.color = value;
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map((n) => Number(n) / 255);
}

/** @returns {Record<string, number[]>} token → [r, g, b] in 0..1 */
export function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const palette = {};
  NAMES.forEach((n) => {
    palette[n] = toRGB(cs.getPropertyValue(`--${n}`).trim() || '#000');
  });
  return palette;
}

/**
 * Calls `fn(palette)` now and after every palette change.
 * @returns {Function} unsubscribe
 */
export function subscribePalette(fn) {
  if (!observing) {
    observing = true;
    new MutationObserver(() => {
      const p = readPalette();
      subscribers.forEach((f) => f(p));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-cube-face', 'class', 'style'] });
  }
  subscribers.add(fn);
  fn(readPalette());
  return () => subscribers.delete(fn);
}
