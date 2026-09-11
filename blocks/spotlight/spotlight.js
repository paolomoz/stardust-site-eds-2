/**
 * spotlight — "Two ways in": a pinned stage with the warp shader, a route diagram rooted on the
 * mark, the section copy, and the door tiles that slide in on pin.
 *
 * Authoring rows (single cell each, classified by content):
 *   1. <h2> section title + lede <p>
 *   2..n one row per door: <h3> word, first plain <p> description, <p><code>route → …</code></p>,
 *        optional <p><strong>label</strong></p> + <p><code>shortcut</code></p> + plain <p> small
 *        line, and a <p><a href="#…">Follow …</a></p> that becomes the tile's target.
 * The route diagram is drawn from the doors' route lines (one branch per door). The mark and the
 * A→B mini mock are fixed brand illustration in this file. Sets the section id `ways`.
 */

import {
  reveal, stagger, splitLines, onlyChild, reduced,
} from '../../scripts/motion.js';
import mountWarp from './warp.js';

const MARK = '<g class="f-gold"> <rect x="128" y="34" width="24" height="24"/> <rect x="128" y="62" width="24" height="24" opacity="0.7"/> <rect x="128" y="90" width="24" height="24" opacity="0.5"/> <rect x="128" y="166" width="24" height="24" opacity="0.5"/> <rect x="128" y="194" width="24" height="24" opacity="0.7"/> <rect x="128" y="222" width="24" height="24"/> <rect x="34" y="128" width="24" height="24"/> <rect x="62" y="128" width="24" height="24" opacity="0.7"/> <rect x="90" y="128" width="24" height="24" opacity="0.5"/> <rect x="166" y="128" width="24" height="24" opacity="0.5"/> <rect x="194" y="128" width="24" height="24" opacity="0.7"/> <rect x="222" y="128" width="24" height="24"/> </g> <rect x="118" y="118" width="44" height="44" class="f-coral"/> <g class="f-gold" opacity="0.6"> <rect x="82" y="82" width="18" height="18"/> <rect x="180" y="82" width="18" height="18"/> <rect x="82" y="180" width="18" height="18"/> <rect x="180" y="180" width="18" height="18"/> </g>';

const LABEL_FONT = 'font-family="SF Mono, ui-monospace, Menlo, monospace" font-size="19" letter-spacing="1.5"';

// branch geometry per lane: lane 0 goes up, lane 1 goes down
const LANES = [
  {
    cls: 'branch s-gold', fill: 'f-gold', path: 'M236 300 C 300 300, 320 160, 400 160 H 2600', nodeY: 151, labelY: 126, extra: '',
  },
  {
    cls: 'branch b2 s-text', fill: 'f-text', path: 'M236 300 C 300 300, 320 440, 400 440 H 2600', nodeY: 431, labelY: 490, extra: ' opacity=".85"',
  },
];

const PRESET_X = { 4: [392, 580, 768, 982], 3: [392, 687, 982] };

function labelXs(n) {
  if (PRESET_X[n]) return PRESET_X[n];
  if (n === 1) return [982];
  return Array.from({ length: n }, (_, i) => Math.round(392 + (i * (982 - 392)) / (n - 1)));
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function routeSvg(routes) {
  const lanes = routes.slice(0, 2).map((steps, k) => {
    const L = LANES[k];
    const xs = labelXs(steps.length);
    const b2 = k ? ' b2' : '';
    const nodes = xs.map((x) => `<rect x="${x}" y="${L.nodeY}" width="18" height="18"/>`).join('');
    const labels = steps.map((s, i) => {
      const last = i === steps.length - 1;
      const x = last ? xs[i] + 18 : xs[i];
      return `<text x="${x}" y="${L.labelY}"${last ? ' text-anchor="end"' : ''}>${esc(s)}</text>`;
    }).join('');
    return `<path class="${L.cls}" d="${L.path}" fill="none" stroke-width="2"${L.extra}/>`
      + `<g class="nodes${b2} ${L.fill}">${nodes}</g>`
      + `<g class="labels${b2} ${L.fill}" ${LABEL_FONT}>${labels}</g>`;
  }).join('');
  return '<svg class="route-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMinYMin meet" aria-hidden="true">'
    + `<g class="root"><svg x="0" y="184" width="232" height="232" viewBox="0 0 280 280">${MARK}</svg></g>${lanes}</svg>`;
}

const PG = '<i class="n"></i><i class="h"></i><i class="r"></i><i class="t"></i>';
const abMock = (variant) => `<div class="pg a">${PG}<b>A</b></div><span class="arrow">&rarr;</span><div class="pg b ${variant}">${PG}<b>B</b></div>`;

const el = (tag, className) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
};

/** Classifies a door cell into { heading, desc, route, label, shortcut, small, link, steps }. */
function readDoor(cell) {
  const door = { route: null, codes: [], plain: [] };
  [...cell.children].forEach((node) => {
    if (/^H[1-6]$/.test(node.tagName)) door.heading = node;
    else if (node.tagName === 'P' && node.querySelector('a')) door.link = node;
    else if (onlyChild(node, 'code')) door.codes.push(node);
    else if (onlyChild(node, 'strong')) door.label = node;
    else if (node.tagName === 'P' || node.tagName === 'UL') door.plain.push(node);
  });
  [door.route, door.shortcut] = door.codes;
  [door.desc, door.small] = door.plain;
  door.steps = door.route
    ? door.route.textContent.split(/\s*(?:→|->|&rarr;)\s*/).map((s) => s.trim()).filter(Boolean) : [];
  return door;
}

function buildDoor(d, index) {
  const tile = el('a', `stile door ${index % 2 ? 'light' : 'gold'}`);
  const target = d.link && d.link.querySelector('a');
  if (target) tile.href = target.getAttribute('href');
  if (d.heading) {
    // the pipeline slugs the heading into an id ("Redesign" → #redesign) that would shadow the
    // series anchor of the same name
    d.heading.removeAttribute('id');
    const word = el('div', 'word');
    word.append(d.heading);
    tile.append(word);
  }
  if (d.desc) tile.append(d.desc);
  if (d.route) {
    const r = el('div', 'mono-line route');
    r.append(d.route);
    tile.append(r);
  }
  const ab = el('div', 'ab');
  ab.setAttribute('aria-hidden', 'true');
  ab.innerHTML = abMock(index % 2 ? 'same' : 'redesign');
  tile.append(ab);
  if (d.label || d.shortcut || d.small) {
    const short = el('div', 'short');
    if (d.label) {
      const lab = el('div', 'label');
      lab.append(d.label);
      short.append(lab);
    }
    if (d.shortcut) {
      const m = el('div', 'mono-line');
      m.append(d.shortcut);
      short.append(m);
    }
    if (d.small) {
      const s = el('div', 'small');
      s.append(d.small);
      short.append(s);
    }
    tile.append(short);
  }
  if (target) {
    const go = el('span', 'door-go');
    // the authored paragraph keeps its identity; the inner anchor is unwrapped (no nested links)
    target.replaceWith(...target.childNodes);
    go.append(d.link);
    const arr = el('span', 'arr');
    arr.textContent = '↓';
    go.append(arr);
    tile.append(go);
  }
  return tile;
}

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const section = block.closest('.section');
  if (section) section.id = 'ways';

  const headCell = rows[0].firstElementChild || rows[0];
  const doors = rows.slice(1).map((r) => readDoor(r.firstElementChild || r));

  const wrap = el('div', 'spot-wrap');
  const pin = el('div', 'spot-pin');
  wrap.append(pin);

  // media: warp canvas + route diagram
  const media = el('div', 'spot-media routes');
  const canvas = el('canvas', 'warp');
  canvas.setAttribute('aria-hidden', 'true');
  media.append(canvas);
  const svgHost = el('div');
  svgHost.innerHTML = routeSvg(doors.map((d) => d.steps).filter((s) => s.length));
  media.append(svgHost.firstElementChild);
  pin.append(media);

  // copy
  const copy = el('div', 'spot-copy');
  const heading = headCell.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('t-xl');
    copy.append(splitLines(heading));
  }
  [...headCell.querySelectorAll('p')].forEach((p, i) => {
    p.classList.add('t-lede');
    p.setAttribute('data-reveal', '');
    p.style.setProperty('--i', i + 1);
    copy.append(p);
  });
  pin.append(copy);

  // doors
  const tiles = el('div', 'spot-tiles doors');
  doors.forEach((d, i) => tiles.append(buildDoor(d, i)));
  pin.append(tiles);

  block.replaceChildren(wrap);
  reveal(block);
  stagger(block);

  // warp shader aimed at the mark
  const warp = mountWarp(canvas, { speed: 1.2 });
  const root = media.querySelector('.route-svg .root svg');
  const aim = () => {
    if (!root) return;
    const r = root.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    warp.setFocus(r.left + r.width / 2 - c.left, r.top + r.height / 2 - c.top);
  };

  // approach zoom-out (scroll-driven) + pin tween (class, time-based in CSS)
  const easeOut = (x) => 1 - (1 - x) ** 3;
  const update = () => {
    const vh = window.innerHeight;
    const { top } = wrap.getBoundingClientRect();
    const a = Math.min(1, Math.max(0, (vh - top) / (vh * 0.85)));
    pin.style.setProperty('--ms', reduced ? 1 : (1.5 - 0.5 * easeOut(a)).toFixed(4));
    pin.classList.toggle('in', top <= 0);
    aim();
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  requestAnimationFrame(update);
}
