/* eslint-disable no-underscore-dangle */
/*
 * scene — the desktop pipeline as one scroll-driven stage.
 *
 * After the sections have loaded, the spotlight ("Two ways in"), the two chapters blocks
 * (redesign, migrate), the showcase and the install block move into a sticky stage inside a
 * tall wrapper; scrolling the wrapper plays the sequence (see stardust/flow-proto for the
 * prototype it reproduces):
 *
 *   Two ways in · Redesign slides in from the right while the stage pans left, the redesign
 *   route lane continues across the door onto the gold screen, corners and drops · Extract,
 *   Direct, Prototype, Frescopa unfold from behind one another, the lane running as a rail
 *   that ends at a station on Frescopa · the cube turns back to Two ways in · Migrate slides
 *   in and its lane repeats the same choreography · Replica, Deploy, Rollout unfold · Rollout
 *   leaves to the right and Install comes in from the left.
 *
 * Blocks keep decorating their own content; this file only positions their elements. It runs
 * on wide screens with a fine pointer and no reduced-motion preference (the `scene` class on
 * <html>, set by scripts.js); everywhere else the blocks' own layout stands.
 */

import { loadCSS } from './aem.js';
import { wake } from './motion.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const R = 28; // corner radius of the lane
const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/* ---------------------------------------------------------------- timeline */

function timeline(namesA, namesB) {
  const T = [];
  let t = 0;
  const add = (name, len) => { T.push({ name, start: t, len }); t += len; };
  add('hold', 0.6);
  add('slideA', 1.2);
  add('pauseA', 0.4);
  namesA.forEach((_, i) => add(`upA${i}`, 1));
  add('cube', 1);
  add('holdB', 0.4);
  add('slideB', 1.2);
  add('pauseB', 0.4);
  namesB.forEach((_, i) => add(`upB${i}`, 1));
  add('exit', 1);
  add('end', 0.6);
  const at = (name) => T.find((k) => k.name === name);
  return {
    T,
    total: t,
    at,
    prog: (name, y) => { const k = at(name); return clamp((y - k.start) / k.len, 0, 1); },
  };
}

/* ---------------------------------------------------------------- build */

export default async function init(main) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/scene.css`);
  const spot = main.querySelector('.spotlight.block');
  const chA = main.querySelector('.chapters.redesign.block');
  const show = main.querySelector('.showcase.block');
  const chB = main.querySelector('.chapters.migrate.block');
  const install = main.querySelector('.install.block');
  if (!spot || !chA || !chB || !install) return;

  // the stage: sticky inside a wrapper as tall as the sequence
  const wrap = el('div', 'sc-wrap');
  const stage = el('div', 'sc-stage');
  wrap.append(stage);
  spot.closest('.section').before(wrap);

  const sections = [spot, chA, show, chB, install].filter(Boolean).map((b) => b.closest('.section'));
  const move = (block, cls) => { block.classList.add(...cls); stage.append(block); };
  move(spot, ['sc-layer', 'sc-spot']);
  move(chA, ['sc-group']);
  if (show) move(show, ['sc-layer', 'sc-panel', 'sc-show']);
  move(chB, ['sc-group']);
  move(install, ['sc-layer', 'sc-panel', 'sc-install']);
  sections.forEach((s) => s.remove());

  const introA = chA.querySelector('.ch-intro-block');
  const introB = chB.querySelector('.ch-intro-block');
  const panelsA = [...chA.querySelectorAll('.chapter'), ...(show ? [show] : [])];
  const panelsB = [...chB.querySelectorAll('.chapter')];
  [introA, introB].forEach((n) => n.classList.add('sc-layer', 'sc-intro'));
  [...panelsA, ...panelsB].forEach((n) => n.classList.add('sc-layer', 'sc-panel'));
  const chainA = [introA, ...panelsA];
  const chainB = [introB, ...panelsB];
  const all = [spot, ...chainA, ...chainB, install];

  // the intro screens take the door's word as their title
  const doorWord = (hash) => {
    const a = spot.querySelector(`a.door[href$="#${hash}"] .word`);
    return a ? a.textContent.trim() : hash.charAt(0).toUpperCase() + hash.slice(1);
  };
  [['redesign', introA], ['migrate', introB]].forEach(([hash, intro]) => {
    const title = el('div', 'sc-title', doorWord(hash));
    title.setAttribute('aria-hidden', 'true');
    intro.prepend(title);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sc-lane');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'sc-lane-path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');
    svg.append(path);
    const tab = el('i', 'sc-tab', `<b>${doorWord(hash)}</b>`);
    tab.setAttribute('aria-hidden', 'true');
    intro.prepend(svg, tab);
  });

  // rails: a line in two segments (ink per screen) and the step chip
  const probe = el('i', 'sc-probe');
  const railA = el('div', 'sc-rail lane-a', `<i class="line"></i><i class="line line2"></i><i class="step"><b>${doorWord('redesign')}</b></i>`);
  const railB = el('div', 'sc-rail lane-b', `<i class="line"></i><i class="line line2"></i><i class="step"><b>${doorWord('migrate')}</b></i>`);
  [probe, railA, railB].forEach((n) => { n.setAttribute('aria-hidden', 'true'); stage.append(n); });
  // the end station on the last redesign panel
  const station = el('div', 'sc-station', '<i class="node"></i>');
  station.setAttribute('aria-hidden', 'true');
  if (show) show.append(station);

  const tl = timeline(panelsA, panelsB);
  wrap.style.setProperty('--sc-screens', tl.total + 1);

  /* ---- geometry ---- */
  const themeOf = (node) => {
    if (node === introA) return 'gold';
    if (node === introB) return 'light';
    return node.dataset.theme || 'dark';
  };
  const lanes = {
    A: {
      intro: introA, branch: '.route-svg .branch:not(.b2)', edge: 'top', rail: railA, ink: (n) => (themeOf(n) === 'gold' ? 'var(--navy)' : 'var(--gold)'),
    },
    B: {
      intro: introB, branch: '.route-svg .branch.b2', edge: 'bottom', rail: railB, ink: (n) => (themeOf(n) === 'light' ? 'var(--navy)' : 'var(--text)'),
    },
  };
  Object.values(lanes).forEach((L) => {
    L.svg = L.intro.querySelector('.sc-lane');
    L.path = L.intro.querySelector('.sc-lane-path');
    L.tab = L.intro.querySelector('.sc-tab');
  });
  let stationY = 0;
  const build = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // everything is measured relative to the stage: it is viewport-sized but, until the wrapper
    // pins it, sits below the hero
    const st = stage.getBoundingClientRect();
    const keep = spot.style.transform;
    spot.style.transform = 'none';
    // the tiles may still be slid out and the diagram zoomed (approach state): measure the
    // tiles from their layout box and the branches with the zoom neutralised
    const pin = spot.querySelector('.spot-pin');
    const keepMs = pin ? pin.style.getPropertyValue('--ms') : '';
    if (pin) pin.style.setProperty('--ms', 1);
    const tiles = spot.querySelector('.spot-tiles');
    const pinRect = pin ? pin.getBoundingClientRect() : st;
    const tilesX = tiles ? pinRect.right - st.left - tiles.offsetWidth : vw * 0.64;
    const railX = probe.getBoundingClientRect().left - st.left;
    Object.values(lanes).forEach((L) => {
      const branch = spot.querySelector(L.branch);
      const bb = branch ? branch.getBoundingClientRect() : null;
      const br = bb
        ? { top: bb.top - st.top, bottom: bb.bottom - st.top }
        : { top: vh * 0.3, bottom: vh * 0.6 };
      const laneY = L.edge === 'top' ? br.top + 1 : br.bottom - 1;
      const cx = vw + railX;
      L.svg.setAttribute('viewBox', `0 0 ${2 * vw} ${vh}`);
      L.path.setAttribute('d', `M ${tilesX} ${laneY} H ${cx - R} A ${R} ${R} 0 0 1 ${cx} ${laneY + R} V ${vh}`);
      L.total = L.path.getTotalLength();
      L.toCorner = (cx - R - tilesX) + (Math.PI * R) / 2;
      L.laneY = laneY;
      L.path.style.strokeDasharray = `${L.total}`;
      L.tab.style.top = `${laneY + R + 22}px`;
    });
    spot.style.transform = keep;
    if (pin) pin.style.setProperty('--ms', keepMs);
    if (show) {
      const keepS = show.style.transform;
      show.style.transform = 'none';
      const h2 = show.querySelector('h2, h3');
      stationY = (h2 ? h2.getBoundingClientRect().top - st.top : vh * 0.3) - 34;
      station.style.top = `${stationY}px`;
      show.style.transform = keepS;
    }
  };

  /* ---- helpers ---- */
  const z = (node, v) => { node.style.zIndex = v; };
  const revealPair = (above, behind, u) => {
    const e = easeInOut(u);
    above.style.transform = `translateY(${(-100 * e).toFixed(2)}%)`;
    behind.style.transform = `scale(${(0.94 + 0.06 * e).toFixed(4)}) translateY(${((1 - e) * 28).toFixed(1)}px)`;
    behind.style.filter = `brightness(${(0.72 + 0.28 * e).toFixed(3)})`;
  };
  const chainReveal = (chain, ups) => {
    for (let i = 0; i < chain.length - 1; i += 1) {
      const above = chain[i];
      const behind = chain[i + 1];
      const u = ups[i];
      if (u === 0) {
        behind.style.transform = 'scale(0.94) translateY(28px)';
        behind.style.filter = 'brightness(0.72)';
      } else if (u < 1) revealPair(above, behind, u);
      else {
        above.style.transform = 'translateY(-100%)';
        behind.style.transform = 'translateY(0)';
        behind.style.filter = '';
      }
    }
  };
  // a layer is "waiting" until it starts to show; waking it plays its deferred reveals
  const waiting = (node, isWaiting) => {
    if (isWaiting) node.classList.add('waiting');
    else if (node.classList.contains('waiting')) {
      node.classList.remove('waiting');
      wake(node);
    }
  };
  const seg = (node, from, to, ink) => {
    const h = Math.max(0, to - from);
    node.style.display = h > 0.5 ? 'block' : 'none';
    node.style.top = `${from}px`;
    node.style.height = `${h}px`;
    node.style.background = ink;
  };
  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56;
  const chipY = navH + 51;

  const laneUpdate = (L, chain, ups, slide, pause, active, endAt) => {
    const vh = window.innerHeight;
    L.rail.style.display = active ? '' : 'none';
    L.svg.style.display = active ? '' : 'none';
    const step = L.rail.querySelector('.step');
    if (!active) { step.classList.remove('on'); return; }
    const drawn = L.toCorner * slide + (L.total - L.toCorner) * easeOut(pause);
    L.path.style.strokeDashoffset = `${L.total - drawn}`;
    const line1 = L.rail.querySelector('.line:not(.line2)');
    const line2 = L.rail.querySelector('.line2');
    let top = 0;
    for (let i = 0; i < ups.length; i += 1) if (easeInOut(ups[i]) * vh > chipY) top = i + 1;
    let act = -1;
    for (let i = 0; i < ups.length; i += 1) if (ups[i] > 0 && ups[i] < 1) act = i;
    const limit = (k) => (endAt != null && k === endAt ? stationY : vh);
    const cornerY = L.laneY + R - vh * easeInOut(ups[0]);
    if (ups[0] === 0) {
      line1.style.display = 'none';
      line2.style.display = 'none';
    } else if (act >= 0) {
      const edgeY = vh * (1 - easeInOut(ups[act]));
      seg(line1, act === 0 ? Math.max(0, cornerY) : 0, edgeY, L.ink(chain[act]));
      seg(line2, edgeY, limit(act + 1), L.ink(chain[act + 1]));
    } else {
      seg(line1, 0, limit(top), L.ink(chain[top]));
      line2.style.display = 'none';
    }
    const onPanel = top > 0 && chain[top].classList.contains('chapter');
    step.classList.toggle('on', onPanel);
    step.classList.toggle('inverted', onPanel && themeOf(chain[top]) === (L === lanes.A ? 'gold' : 'light'));
  };

  /* ---- the frame ---- */
  let progress = 0;
  const update = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const y = clamp(-wrap.getBoundingClientRect().top / vh, 0, tl.total);
    progress = y;
    const P = (n) => tl.prog(n, y);
    const sA = easeInOut(P('slideA'));
    const sB = easeInOut(P('slideB'));
    const cube = P('cube');
    const ex = easeInOut(P('exit'));
    const upA = panelsA.map((_, i) => P(`upA${i}`));
    const upB = panelsB.map((_, i) => P(`upB${i}`));
    all.forEach((n) => { n.style.transform = ''; n.style.filter = ''; n.classList.remove('parked'); });
    stage.classList.remove('cubing');
    stage.style.perspective = '';

    if (cube === 0) {
      spot.style.transform = `translateX(${(-sA * 100).toFixed(2)}%)`;
      introA.style.transform = `translateX(${((1 - sA) * 100).toFixed(2)}%)`;
      chainReveal(chainA, upA);
      if (upA[0] > 0) introA.style.transform = `translateY(${(-100 * easeInOut(upA[0])).toFixed(2)}%)`;
      z(spot, upA[0] > 0 ? 0 : 20);
      z(introA, 21);
      panelsA.forEach((p, i) => z(p, 19 - i));
      [introB, ...panelsB, install].forEach((n) => { z(n, 0); n.classList.add('parked'); });
    } else if (cube < 1) {
      // the cube turns back: the last redesign screen is the front face, Two ways in the left face
      const front = chainA[chainA.length - 1];
      const half = vw / 2;
      const angle = 90 * easeInOut(cube);
      const pull = vw * 0.3 * Math.sin((Math.PI * angle) / 90) ** 0.6;
      stage.classList.add('cubing');
      stage.style.perspective = `${Math.max(vw, vh) * 1.6}px`;
      const c = `translateZ(${-pull}px) translateZ(${-half}px) rotateY(${angle}deg)`;
      front.style.transform = `${c} translateZ(${half}px)`;
      spot.style.transform = `${c} rotateY(-90deg) translateZ(${half}px)`;
      all.forEach((n) => { if (n !== front && n !== spot) n.classList.add('parked'); });
      z(front, 20);
      z(spot, 20);
    } else {
      spot.style.transform = `translateX(${(-sB * 100).toFixed(2)}%)`;
      introB.style.transform = `translateX(${((1 - sB) * 100).toFixed(2)}%)`;
      chainReveal(chainB, upB);
      if (upB[0] > 0) introB.style.transform = `translateY(${(-100 * easeInOut(upB[0])).toFixed(2)}%)`;
      const last = panelsB[panelsB.length - 1];
      if (P('exit') > 0) {
        last.style.transform = `translateX(${(100 * ex).toFixed(2)}%)`;
        install.style.transform = `translateX(${(-100 * (1 - ex)).toFixed(2)}%)`;
      } else install.style.transform = 'translateX(-100%)';
      z(spot, sB >= 1 ? 0 : 20);
      z(introB, 21);
      panelsB.forEach((p, i) => z(p, 19 - i));
      z(install, 10);
      [introA, ...panelsA].forEach((n) => { z(n, 0); n.classList.add('parked'); });
    }

    // waiting layers: reveals inside play only once the layer starts to show
    waiting(introA, sA === 0);
    panelsA.forEach((p, i) => waiting(p, upA[i] === 0));
    waiting(introB, sB === 0);
    panelsB.forEach((p, i) => waiting(p, upB[i] === 0));
    waiting(install, P('exit') === 0);

    // lanes and the station
    laneUpdate(lanes.A, chainA, upA, sA, P('pauseA'), cube === 0, show ? chainA.length - 1 : null);
    laneUpdate(lanes.B, chainB, upB, sB, P('pauseB'), cube >= 1 && P('exit') < 1, null);
    railB.style.transform = `translateX(${(100 * ex).toFixed(2)}%)`;
    if (show) {
      const uShow = upA[panelsA.length - 1];
      const shown = uShow > 0 && vh * (1 - easeInOut(uShow)) <= stationY;
      station.classList.toggle('on', shown && cube === 0);
    }
  };

  /* ---- anchors: the section ids now mean positions in the sequence ---- */
  const targets = {
    ways: 0,
    redesign: tl.at('pauseA').start,
    migrate: tl.at('pauseB').start,
    install: tl.at('end').start,
  };
  const scrollToPhase = (hash) => {
    const t = targets[hash];
    if (t == null) return false;
    const top = wrap.getBoundingClientRect().top + window.scrollY + t * window.innerHeight;
    if (window.__lenis) window.__lenis.scrollTo(top, { immediate: false });
    else window.scrollTo({ top, behavior: 'smooth' });
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, window.location.href);
    if (url.pathname !== window.location.pathname) return;
    const hash = url.hash.slice(1);
    if (scrollToPhase(hash)) {
      e.preventDefault();
      e.stopPropagation(); // keeps the smooth-scroll library's own anchor handling out of it
      window.history.replaceState(null, '', `#${hash}`);
      document.dispatchEvent(new CustomEvent('stardust:nav-jump'));
    }
  }, true);
  window.addEventListener('hashchange', () => scrollToPhase(window.location.hash.slice(1)));

  build();
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => { build(); update(); });
  if (window.location.hash) {
    requestAnimationFrame(() => scrollToPhase(window.location.hash.slice(1)));
  }
  window.__scene = {
    get progress() { return progress; },
    timeline: tl,
    scrollToPhase,
  };
}
